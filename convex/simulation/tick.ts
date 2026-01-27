import { mutation, internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import {
  calculateResourceChanges,
  calculateTradeBonus,
  calculateWarEffects,
  generateRandomEvent,
  applyAllianceBenefits,
} from "./resources";
import { processResourceProduction, processMarketPrices } from "./economy";
import { processBuildingMaintenance } from "./buildings";
import { processCaravans } from "./trade";
import { processDemographics, processImmigration } from "./demographics";
import { processSocialClasses, processFactions, processRebellions } from "./society";
import { processDiseases, checkDiseaseRisk, createDiseaseOutbreak } from "./disease";
import { processArmyUpkeep } from "./military";
import { checkForBattles, updateWarStatus, processRetreatingArmies } from "./combat";
import { processSieges } from "./siege";
import { getCurrentEra, TECHNOLOGY_ERAS } from "./technology";

// System interconnection effects
const SYSTEM_TRIGGERS = {
  // Famine effects
  FAMINE_THRESHOLD: 20,
  FAMINE_DEATH_RATE_MODIFIER: 1.5,
  FAMINE_REBELLION_MODIFIER: 0.3,

  // War exhaustion effects
  WAR_EXHAUSTION_THRESHOLD: 70,
  WAR_EXHAUSTION_HAPPINESS_PENALTY: -2,
  WAR_EXHAUSTION_REBELLION_MODIFIER: 0.05,

  // Prosperity effects
  PROSPERITY_WEALTH_THRESHOLD: 70,
  PROSPERITY_FOOD_THRESHOLD: 70,
  PROSPERITY_BIRTH_RATE_MODIFIER: 1.2,
  PROSPERITY_IMMIGRATION_MODIFIER: 1.1,

  // Disease outbreak thresholds
  DISEASE_FOOD_THRESHOLD: 25,
  DISEASE_POPULATION_THRESHOLD: 50,
};

// Main tick processor - advances the simulation by one tick
export const processTick = internalMutation({
  args: {},
  handler: async (ctx) => {
    const world = await ctx.db.query("world").first();
    if (!world) {
      throw new Error("World not initialized");
    }

    if (world.status !== "running") {
      return { skipped: true, reason: "World is not running" };
    }

    const newTick = world.tick + 1;

    // Calculate new date (1 tick = 1 month)
    let newMonth = world.month + 1;
    let newYear = world.year;
    if (newMonth > 12) {
      newMonth = 1;
      newYear += 1;
    }

    // Update world state
    await ctx.db.patch(world._id, {
      tick: newTick,
      month: newMonth,
      year: newYear,
      lastTickAt: Date.now(),
    });

    // Get all territories
    const territories = await ctx.db.query("territories").collect();

    // =============================================
    // PHASE 1: ECONOMY & RESOURCES
    // =============================================

    for (const territory of territories) {
      // Apply passive resource changes
      const changes = calculateResourceChanges(territory);
      await ctx.db.patch(territory._id, changes);

      // Process building-based resource production
      await processResourceProduction(ctx, territory._id, newTick);

      // Process building maintenance costs
      await processBuildingMaintenance(ctx, territory._id);

      // Update market prices based on supply/demand
      await processMarketPrices(ctx, territory._id, newTick);
    }

    // =============================================
    // PHASE 2: TRADE SYSTEM
    // =============================================

    // Process all traveling caravans
    const caravanResults = await processCaravans(ctx, newTick);

    // Log significant caravan events
    for (const arrival of caravanResults.arrivals) {
      // Caravan arrivals are handled internally, no need for events
    }

    for (const raid of caravanResults.raids) {
      await ctx.db.insert("events", {
        tick: newTick,
        type: "trade",
        title: "Caravan Raided",
        description: `A caravan traveling from ${raid.originName} to ${raid.destName} was attacked by bandits.`,
        severity: "negative",
        createdAt: Date.now(),
      });
    }

    // =============================================
    // PHASE 3: DEMOGRAPHICS & SOCIETY
    // =============================================

    for (const territory of territories) {
      // Process population changes (births, deaths, aging)
      const demoResult = await processDemographics(ctx, territory._id, newTick);

      // Log significant demographic events
      for (const event of demoResult.events) {
        if (event.type === "famine" || event.type === "high_mortality") {
          await ctx.db.insert("events", {
            tick: newTick,
            type: event.type === "famine" ? "disaster" : "crisis",
            territoryId: territory._id,
            title: event.type === "famine" ? "Famine Conditions" : "High Mortality",
            description: event.description,
            severity: "negative",
            createdAt: Date.now(),
          });
        }
      }

      // Process immigration/emigration
      await processImmigration(ctx, territory._id, newTick);

      // Process social class dynamics
      const socialResult = await processSocialClasses(ctx, territory._id, newTick);

      // Process faction dynamics
      const factionResult = await processFactions(ctx, territory._id, newTick);

      // Log faction events
      for (const event of factionResult.events) {
        await ctx.db.insert("events", {
          tick: newTick,
          type: event.type === "rebellion_started" ? "crisis" : "decision",
          territoryId: territory._id,
          title: event.type === "rebellion_started" ? "Rebellion!" : "Faction Unrest",
          description: event.description,
          severity: event.type === "rebellion_started" ? "critical" : "negative",
          createdAt: Date.now(),
        });
      }

      // Process active rebellions
      await processRebellions(ctx, territory._id, newTick);

      // Check for disease risk
      const diseaseRisk = await checkDiseaseRisk(ctx, territory._id, newTick);
      if (diseaseRisk.atRisk && diseaseRisk.riskType && Math.random() < 0.1) {
        await createDiseaseOutbreak(ctx, territory._id, diseaseRisk.riskType, newTick);
      }
    }

    // Process active diseases globally
    const diseaseResults = await processDiseases(ctx, newTick);

    // =============================================
    // PHASE 4: MILITARY & WARFARE
    // =============================================

    for (const territory of territories) {
      // Process army upkeep
      await processArmyUpkeep(ctx, territory._id, newTick);
    }

    // Process ongoing sieges
    await processSieges(ctx, newTick);

    // Check for battles where opposing armies meet
    const battles = await checkForBattles(ctx, newTick);

    // Process retreating armies (return them to home territory)
    await processRetreatingArmies(ctx, newTick);

    // Log battles
    for (const battle of battles) {
      await ctx.db.insert("events", {
        tick: newTick,
        type: "war",
        title: `Battle at ${battle.location}`,
        description: `${battle.attacker} clashed with ${battle.defender} at ${battle.location}.`,
        severity: "critical",
        createdAt: Date.now(),
      });
    }

    // =============================================
    // RELATIONSHIP & WAR PROCESSING
    // =============================================

    const relationships = await ctx.db.query("relationships").collect();

    // Count allies for each territory
    const allyCount = new Map<string, number>();
    for (const rel of relationships) {
      if (rel.hasAlliance) {
        const t1Id = rel.territory1Id.toString();
        const t2Id = rel.territory2Id.toString();
        allyCount.set(t1Id, (allyCount.get(t1Id) || 0) + 1);
        allyCount.set(t2Id, (allyCount.get(t2Id) || 0) + 1);
      }
    }

    for (const rel of relationships) {
      const t1 = territories.find((t) => t._id === rel.territory1Id);
      const t2 = territories.find((t) => t._id === rel.territory2Id);

      // Apply trade agreement bonuses
      if (rel.hasTradeAgreement && t1 && t2) {
        const { territory1Bonus, territory2Bonus } = calculateTradeBonus(t1, t2);

        await ctx.db.patch(rel.territory1Id, {
          wealth: Math.min(100, t1.wealth + territory1Bonus),
        });
        await ctx.db.patch(rel.territory2Id, {
          wealth: Math.min(100, t2.wealth + territory2Bonus),
        });
      }

      // Apply alliance benefits (military, happiness, wealth boost)
      if (rel.hasAlliance && t1 && t2) {
        const t1Benefits = applyAllianceBenefits(t1, true);
        const t2Benefits = applyAllianceBenefits(t2, true);

        if (Object.keys(t1Benefits).length > 0) {
          await ctx.db.patch(rel.territory1Id, t1Benefits);
        }
        if (Object.keys(t2Benefits).length > 0) {
          await ctx.db.patch(rel.territory2Id, t2Benefits);
        }
      }

      // Apply war effects
      if (rel.status === "at_war" && t1 && t2) {
        // Increment war exhaustion
        const newExhaustion = Math.min(100, (rel.warExhaustion || 0) + 2);
        await ctx.db.patch(rel._id, {
          warExhaustion: newExhaustion,
        });

        // Get ally counts for war calculation
        const t1AllyCount = allyCount.get(rel.territory1Id.toString()) || 0;
        const t2AllyCount = allyCount.get(rel.territory2Id.toString()) || 0;

        const warEffects = calculateWarEffects(t1, t2, t1AllyCount, t2AllyCount);

        // Apply costs
        await ctx.db.patch(rel.territory1Id, {
          wealth: Math.max(0, t1.wealth + (warEffects.attackerCosts.wealth || 0)),
          food: Math.max(0, t1.food + (warEffects.attackerCosts.food || 0)),
          happiness: Math.max(
            0,
            t1.happiness + (warEffects.attackerCosts.happiness || 0)
          ),
          population: Math.max(
            1,
            t1.population + (warEffects.attackerCosts.population || 0)
          ),
          military: Math.max(
            0,
            t1.military + (warEffects.attackerCosts.military || 0)
          ),
        });

        await ctx.db.patch(rel.territory2Id, {
          wealth: Math.max(0, t2.wealth + (warEffects.defenderCosts.wealth || 0)),
          food: Math.max(0, t2.food + (warEffects.defenderCosts.food || 0)),
          happiness: Math.max(
            0,
            t2.happiness + (warEffects.defenderCosts.happiness || 0)
          ),
          population: Math.max(
            1,
            t2.population + (warEffects.defenderCosts.population || 0)
          ),
          military: Math.max(
            0,
            t2.military + (warEffects.defenderCosts.military || 0)
          ),
        });

        // War exhaustion effects
        if (newExhaustion >= SYSTEM_TRIGGERS.WAR_EXHAUSTION_THRESHOLD) {
          // Apply additional penalties
          await ctx.db.patch(rel.territory1Id, {
            happiness: Math.max(0, t1.happiness + SYSTEM_TRIGGERS.WAR_EXHAUSTION_HAPPINESS_PENALTY),
          });
          await ctx.db.patch(rel.territory2Id, {
            happiness: Math.max(0, t2.happiness + SYSTEM_TRIGGERS.WAR_EXHAUSTION_HAPPINESS_PENALTY),
          });
        }

        // Log war event with power comparison
        const allianceNote = (t1AllyCount > 0 || t2AllyCount > 0)
          ? ` (${t1.name}: ${t1AllyCount} allies, ${t2.name}: ${t2AllyCount} allies)`
          : "";
        const exhaustionNote = newExhaustion >= 50 ? ` War exhaustion is taking its toll.` : "";

        await ctx.db.insert("events", {
          tick: newTick,
          type: "war",
          territoryId: rel.territory1Id,
          targetTerritoryId: rel.territory2Id,
          title: "War Continues",
          description: `The war between ${t1.name} and ${t2.name} rages on. Both sides suffer losses.${allianceNote}${exhaustionNote}`,
          severity: "critical",
          createdAt: Date.now(),
        });
      }
    }

    // =============================================
    // RANDOM EVENTS & ERA CHECKS
    // =============================================

    const refreshedTerritories = await ctx.db.query("territories").collect();

    for (const territory of refreshedTerritories) {
      // Check for era transitions
      const currentEra = getCurrentEra(territory.technology);
      // Era transitions are handled when technologies are researched

      // Generate random events
      const event = generateRandomEvent(territory);
      if (event) {
        // Apply event effects
        await ctx.db.patch(territory._id, event.effects);

        // Log the event
        await ctx.db.insert("events", {
          tick: newTick,
          type: event.type,
          territoryId: territory._id,
          title: event.title,
          description: event.description,
          severity: event.type === "breakthrough" || event.type === "population_boom"
            ? "positive"
            : "negative",
          createdAt: Date.now(),
        });
      }

      // System interconnection: Famine triggers
      if (territory.food < SYSTEM_TRIGGERS.FAMINE_THRESHOLD) {
        // Increase death rate through demographics system
        // This is handled in processDemographics
      }

      // System interconnection: Prosperity triggers
      if (territory.food > SYSTEM_TRIGGERS.PROSPERITY_FOOD_THRESHOLD &&
        territory.wealth > SYSTEM_TRIGGERS.PROSPERITY_WEALTH_THRESHOLD) {
        // Prosperity bonus - small happiness boost
        await ctx.db.patch(territory._id, {
          happiness: Math.min(100, territory.happiness + 1),
        });
      }
    }

    // =============================================
    // SCHEDULE AI DECISIONS
    // =============================================

    const agents = await ctx.db.query("agents").collect();
    for (let i = 0; i < agents.length; i++) {
      // Stagger by 2 seconds to avoid rate limits
      const delay = i * 2000;
      await ctx.scheduler.runAfter(delay, internal.ai.decisions.makeDecision, {
        agentId: agents[i]._id,
        tick: newTick,
      });
    }

    return { tick: newTick, year: newYear, month: newMonth };
  },
});

// Schedule the next tick based on speed setting
export const scheduleNextTick = internalMutation({
  args: {},
  handler: async (ctx) => {
    const world = await ctx.db.query("world").first();
    if (!world) return;

    if (world.status !== "running" || world.speed === "paused") {
      return;
    }

    // Calculate delay based on speed
    let delayMs: number;
    switch (world.speed) {
      case "1x":
        delayMs = 60000; // 60 seconds
        break;
      case "10x":
        delayMs = 6000; // 6 seconds
        break;
      case "100x":
        delayMs = 600; // 0.6 seconds
        break;
      default:
        return; // Paused, don't schedule
    }

    // Schedule the next tick
    await ctx.scheduler.runAfter(delayMs, internal.simulation.tick.processTick, {});
    // And schedule the next scheduling after that tick completes
    await ctx.scheduler.runAfter(delayMs + 100, internal.simulation.tick.scheduleNextTick, {});
  },
});
