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
import { processResourceProduction, processMarketPrices, initializeTreasury, processEconomy } from "./economy";
import { processBuildingMaintenance } from "./buildings";
import { processCaravans } from "./trade";
import { processDemographics, processImmigration } from "./demographics";
import { processSocialClasses, processFactions, processRebellions } from "./society";
import { processDiseases, checkDiseaseRisk, createDiseaseOutbreak } from "./disease";
import { processArmyUpkeep } from "./military";
import { checkForBattles, updateWarStatus, processRetreatingArmies } from "./combat";
import { processSieges } from "./siege";
import { getCurrentEra, TECHNOLOGY_ERAS } from "./technology";
// Engagement system imports
import { processCharacterAging, applyCharacterProsperityEffects, checkForAccidents, processExiledCharacters, processDynastyBirths, processRisingStars, processCharacterMaturation } from "./characters";
import { processPlots, checkPlotOpportunities } from "./plots";
import { updateActiveWars, recordBattle } from "./warChronicles";
import { updateLeaderboards } from "./leaderboards";
import { updateStreaks, recordPopulationPeak } from "./streaks";
import { calculateTensions } from "./tensions";
import { processWarEmergence } from "./warEmergence";
import { processExpansion, processExpeditionReturns } from "./expansion";
import { processRivalries } from "./rivalries";
import { generateYearlyChronicle } from "./recaps";
import { updateProsperityTier, applyProsperityEffects, initializeProsperityTier } from "./prosperity";
import { processSurvival, getSeason, processInstinctiveSurvival } from "./survival";
import { processAllSurvivalNeeds } from "./survivalNeeds";
import { processDiscovery, detectCurrentCrisis } from "./survivalDiscovery";
// Competition system imports
import { checkVictoryConditions, checkElimination, startMatch, endMatch, recordKeyMoment } from "./victory";
import { recordPowerScores, getPowerRankings } from "./scoring";
// Personality evolution - traits evolve based on events
import { evolvePersonalityFromEvent, evolvePersonalityFromOutcome } from "./personalityEvolution";
// Organic AI Growth - Memory, Bonds, Goals
import { decayMemories, getRelevantMemories, recordMemory } from "./memory";
import { processBonds, inheritBonds, createBond, getBonds } from "./bonds";
import { checkForGoalTriggers, updateGoalProgress, checkGoalAchievement, pruneImpossibleGoals } from "./goals";
import { processRulerLegitimacy } from "./rulerLegitimacy";
// Society Systems - Professions, Education, Religion, Guilds, Judicial
import { processProfessions, autoAssignProfessions } from "./professions";
import { processEducation } from "./education";
import { processReligion, processOrganicReligionEmergence } from "./religion";
import { processGuilds } from "./guilds";
import { processImprisoned } from "./judicial";
// Organic Knowledge Progression System
import { aggregatePopulationSkills, checkTechRequirements, calculateSkillBonus, getKnowledgeSummary } from "./collectiveKnowledge";
// Knowledge Transfer System (Education)
import { processKnowledgeTransfer } from "./knowledgeTransfer";
import { TECH_TREE, TechSkillRequirement } from "../data/techTree";
// Viewer Engagement Systems
import { checkAndAwardMilestones, getMilestonePoints } from "./milestones";
import { processWorldEvents } from "./worldEvents";
import { processRiseAndFall, getRiseAndFallStatus } from "./riseAndFall";
// Endgame Tensions
import { processEndgameTensions } from "./endgameTensions";
// Human Life Systems - New imports
import { processWeather, initializeWeather, getWeather } from "./weatherSystem";
import { processInfrastructure, getInfrastructureBonuses } from "./infrastructureSystem";
import { checkForRandomDisaster, processActiveDisasters } from "./disastersSystem";
import { processFriendships } from "./friendship";
import { processRomances } from "./romance";
import { processMarriages } from "./marriage";
import { processDynasties } from "./dynasties";
import { processMentalHealth } from "./mentalHealth";
import { processAddictions } from "./addiction";
import { processEspionage } from "./espionage";
// Sabotage is now AI-driven - see sabotageMotive.ts for context building
import { processExpeditions } from "./exploration";
import { processGenderDynamics, initializeGenderRoles } from "./gender";
import { processWarDemographics, initializeFightingPopulation } from "./warDemographics";

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

    // Calculate season from month
    const newSeason = getSeason(newMonth);

    // Update world state
    await ctx.db.patch(world._id, {
      tick: newTick,
      month: newMonth,
      year: newYear,
      season: newSeason,
      lastTickAt: Date.now(),
    });

    // Get all territories
    const territories = await ctx.db.query("territories").collect();

    // =============================================
    // PHASE 1: ECONOMY & RESOURCES
    // =============================================

    for (const territory of territories) {
      // Apply passive resource changes (with seasonal modifiers)
      const changes = calculateResourceChanges(territory, newSeason);
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

          // Evolve personality from famine - hardship shapes civilizations!
          if (event.type === "famine") {
            const agent = await ctx.db
              .query("agents")
              .withIndex("by_territory", (q) => q.eq("territoryId", territory._id))
              .first();
            if (agent) {
              await evolvePersonalityFromEvent(ctx as any, agent._id, "famine");

              // =============================================
              // ORGANIC AI GROWTH - Record famine memory
              // =============================================
              await recordMemory(ctx, agent._id, {
                type: "crisis",
                description: `Famine struck our people! ${event.description} Hunger and desperation spread.`,
                emotionalWeight: -55, // Famine is deeply traumatic
              });
            }
          }
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

      // =============================================
      // INSTINCTIVE SURVIVAL BEHAVIOR
      // =============================================
      // People naturally try to survive - foraging when hungry,
      // building makeshift shelters when exposed, gathering wood when cold.
      // This provides ~30-50% of what's needed - AI must still make good decisions!
      const instinctResult = await processInstinctiveSurvival(ctx, territory._id, newTick, newSeason);

      // Log instinctive survival events
      for (const event of instinctResult.events) {
        await ctx.db.insert("events", {
          tick: newTick,
          type: "decision",
          territoryId: territory._id,
          title: "Survival Instinct",
          description: event.description,
          severity: "info",
          createdAt: Date.now(),
        });
      }

      // Process survival mechanics (shelter, warmth, exposure)
      // Now calculated AFTER instincts have improved resources
      const survivalResult = await processSurvival(ctx, territory._id, newTick, newSeason);

      // Log survival events
      for (const event of survivalResult.events) {
        await ctx.db.insert("events", {
          tick: newTick,
          type: event.type === "exposure_deaths" ? "disaster" : "crisis",
          territoryId: territory._id,
          title: event.title,
          description: event.description,
          severity: event.type === "exposure_deaths" ? "critical" : "negative",
          createdAt: Date.now(),
        });
      }

      // Process comprehensive survival needs (water, clothing, sanitation, preservation, medicine)
      const survivalNeeds = await processAllSurvivalNeeds(ctx, territory._id, newTick, newSeason);
      if (survivalNeeds.criticalNeeds.length > 0) {
        console.log(`[SURVIVAL] ${territory.name} critical needs: ${survivalNeeds.criticalNeeds.join(", ")}`);
      }

      // Process organic technology discovery - crises drive innovation!
      const currentCrisis = detectCurrentCrisis(territory);
      const discoveryResult = await processDiscovery(ctx, territory._id, newTick, currentCrisis);
      if (discoveryResult.discovered) {
        console.log(`[DISCOVERY] ${territory.name} discovered ${discoveryResult.discovered.name}!`);
      }

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

      // Evolve personalities based on battle - war shapes civilizations!
      // Find the agents for both sides and evolve their personalities
      const allAgents = await ctx.db.query("agents").collect();
      for (const agent of allAgents) {
        const territory = await ctx.db.get(agent.territoryId);
        if (territory && (territory.name === battle.attacker || territory.name === battle.defender)) {
          await evolvePersonalityFromEvent(ctx as any, agent._id, "invasion");
        }
      }
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

      // Apply trade agreement bonuses (no caps - wealth can grow naturally)
      if (rel.hasTradeAgreement && t1 && t2) {
        const { territory1Bonus, territory2Bonus } = calculateTradeBonus(t1, t2);

        await ctx.db.patch(rel.territory1Id, {
          wealth: t1.wealth + territory1Bonus,
        });
        await ctx.db.patch(rel.territory2Id, {
          wealth: t2.wealth + territory2Bonus,
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

        // =============================================
        // ORGANIC AI GROWTH - Record random event memories
        // =============================================
        const randomEventAgent = await ctx.db
          .query("agents")
          .withIndex("by_territory", (q) => q.eq("territoryId", territory._id))
          .first();

        if (randomEventAgent) {
          if (event.type === "breakthrough") {
            // Discovery/breakthrough - positive memory
            await recordMemory(ctx, randomEventAgent._id, {
              type: "victory", // Breakthroughs are victories of knowledge
              description: event.description,
              emotionalWeight: 45, // Positive but not as strong as military victory
            });
          } else if (event.type === "population_boom") {
            // New life - joyful memory
            await recordMemory(ctx, randomEventAgent._id, {
              type: "gift", // New life is a gift
              description: event.description,
              emotionalWeight: 35, // Warm positive memory
            });
          } else if (event.type === "disaster") {
            // Natural hardship - crisis memory
            await recordMemory(ctx, randomEventAgent._id, {
              type: "crisis",
              description: event.description,
              emotionalWeight: -35, // Negative but survivable
            });
          } else if (event.type === "crisis" && event.title.includes("Death")) {
            // Character death - somber memory
            await recordMemory(ctx, randomEventAgent._id, {
              type: "character_death",
              description: event.description,
              emotionalWeight: -40, // Loss of community member
            });
          }
        }
      }

      // System interconnection: Famine triggers
      if (territory.food < SYSTEM_TRIGGERS.FAMINE_THRESHOLD) {
        // Increase death rate through demographics system
        // This is handled in processDemographics
      }

      // System interconnection: Prosperity triggers (no cap on happiness)
      if (territory.food > SYSTEM_TRIGGERS.PROSPERITY_FOOD_THRESHOLD &&
        territory.wealth > SYSTEM_TRIGGERS.PROSPERITY_WEALTH_THRESHOLD) {
        // Prosperity bonus - small happiness boost
        await ctx.db.patch(territory._id, {
          happiness: territory.happiness + 1,
        });
      }
    }

    // =============================================
    // PHASE 6: ENGAGEMENT SYSTEMS
    // =============================================

    // Process character aging and natural deaths
    const agingEvents = await processCharacterAging(ctx, newTick);
    for (const event of agingEvents) {
      if (event.type === "death") {
        await ctx.db.insert("events", {
          tick: newTick,
          type: "crisis",
          title: "Character Death",
          description: event.description,
          severity: "critical",
          createdAt: Date.now(),
        });
      }
    }

    // Process exiled characters (they may die in exile)
    const exileEvents = await processExiledCharacters(ctx, newTick);
    for (const event of exileEvents) {
      await ctx.db.insert("events", {
        tick: newTick,
        type: "crisis",
        title: "Death in Exile",
        description: event.description,
        severity: "negative",
        createdAt: Date.now(),
      });
    }

    // Check for random accidents per territory
    for (const territory of territories) {
      const accidentEvents = await checkForAccidents(ctx, territory._id, newTick);
      for (const event of accidentEvents) {
        await ctx.db.insert("events", {
          tick: newTick,
          type: event.type === "death" ? "crisis" : "decision",
          territoryId: territory._id,
          title: event.type === "death" ? "Tragic Accident" : "Accident",
          description: event.description,
          severity: event.type === "death" ? "critical" : "negative",
          createdAt: Date.now(),
        });
      }

      // =============================================
      // CHARACTER SPAWNING FROM POPULATION
      // =============================================

      // Process dynasty births (rulers/heirs having children)
      const birthEvents = await processDynastyBirths(ctx, territory._id, newTick);
      for (const event of birthEvents) {
        await ctx.db.insert("events", {
          tick: newTick,
          type: "breakthrough",
          territoryId: territory._id,
          title: "Royal Birth!",
          description: event.description,
          severity: "positive",
          createdAt: Date.now(),
        });
      }

      // Process rising stars (talented individuals from population)
      const risingStarEvents = await processRisingStars(ctx, territory._id, newTick);
      for (const event of risingStarEvents) {
        await ctx.db.insert("events", {
          tick: newTick,
          type: "breakthrough",
          territoryId: territory._id,
          title: "Rising Star",
          description: event.description,
          severity: "positive",
          createdAt: Date.now(),
        });
      }

      // Process character maturation (children coming of age)
      const maturationEvents = await processCharacterMaturation(ctx, territory._id, newTick);
      for (const event of maturationEvents) {
        await ctx.db.insert("events", {
          tick: newTick,
          type: event.type === "coming_of_age" ? "breakthrough" : "decision",
          territoryId: territory._id,
          title: event.type === "coming_of_age" ? "Coming of Age" :
                 event.type === "heir_named" ? "Heir Named" : "Elder Wisdom",
          description: event.description,
          severity: "positive",
          createdAt: Date.now(),
        });
      }
    }

    // Process prosperity tiers and their effects
    for (const territory of territories) {
      // Initialize prosperity tier if it doesn't exist
      const existingProsperity = await ctx.db
        .query("prosperityTiers")
        .withIndex("by_territory", (q) => q.eq("territoryId", territory._id))
        .first();

      if (!existingProsperity) {
        await initializeProsperityTier(ctx, territory._id, newTick);
      }

      // Update prosperity tier
      const prosperityResult = await updateProsperityTier(ctx, territory._id, newTick);

      // Log prosperity tier changes
      if (prosperityResult.events) {
        for (const eventDesc of prosperityResult.events) {
          await ctx.db.insert("events", {
            tick: newTick,
            type: "breakthrough",
            territoryId: territory._id,
            title: "Prosperity Change",
            description: eventDesc,
            severity: eventDesc.includes("Golden Age") ? "positive" : "info",
            createdAt: Date.now(),
          });
        }
      }

      // Apply prosperity benefits
      await applyProsperityEffects(ctx, territory._id, newTick);

      // Get prosperity tier for plot opportunities
      const prosperity = await ctx.db
        .query("prosperityTiers")
        .withIndex("by_territory", (q) => q.eq("territoryId", territory._id))
        .first();

      // Check if characters should start plotting (prosperity breeds intrigue)
      if (prosperity) {
        await checkPlotOpportunities(
          ctx,
          territory._id,
          newTick,
          prosperity.currentTier,
          prosperity.decadenceLevel
        );

        // Apply prosperity effects on characters (complacency, etc.)
        await applyCharacterProsperityEffects(
          ctx,
          territory._id,
          prosperity.currentTier,
          newTick
        );
      }

      // Process active plots
      const plotEvents = await processPlots(ctx, territory._id, newTick);

      // Log plot events
      for (const event of plotEvents) {
        await ctx.db.insert("events", {
          tick: newTick,
          type: event.severity === "critical" ? "crisis" : "decision",
          territoryId: territory._id,
          title: event.type === "plot_discovered" ? "Plot Discovered!" :
                 event.type === "plot_executed" ? "Scheme Executed!" :
                 event.type === "plotter_executed" ? "Traitor Executed" : "Court Intrigue",
          description: event.description,
          severity: event.severity,
          createdAt: Date.now(),
        });
      }

      // Process ruler legitimacy and popular trust
      await processRulerLegitimacy(ctx, territory._id, newTick);

      // =============================================
      // PHASE 6b: SOCIETY SYSTEMS
      // =============================================

      // Auto-assign professions to characters without one (once per year)
      if (newTick % 12 === 0) {
        await autoAssignProfessions(ctx, territory._id, newTick);
      }

      // Process professions (skill growth, production)
      const professionOutput = await processProfessions(ctx, territory._id, newTick);
      // Add food from farmer professions to territory
      if (professionOutput.foodProduced > 0) {
        const currentTerritory = await ctx.db.get(territory._id);
        if (currentTerritory) {
          await ctx.db.patch(territory._id, {
            food: Math.min(200, currentTerritory.food + professionOutput.foodProduced * 0.1),
          });
        }
      }

      // Process education (student learning, graduations)
      const educationEvents = await processEducation(ctx, territory._id, newTick);
      for (const event of educationEvents) {
        if (event.type === "graduation") {
          await ctx.db.insert("events", {
            tick: newTick,
            type: "breakthrough",
            territoryId: territory._id,
            title: "Graduation",
            description: event.description,
            severity: "positive",
            createdAt: Date.now(),
          });
        }
      }

      // Process knowledge transfer (libraries, schools, apprenticeships, community learning)
      // This allows new generations to learn skills without going through crises!
      const knowledgeResult = await processKnowledgeTransfer(ctx, territory._id, newTick);
      for (const event of knowledgeResult.events) {
        await ctx.db.insert("events", {
          tick: newTick,
          type: event.type === "graduation" || event.type === "apprentice_promotion" ? "breakthrough" : "decision",
          territoryId: territory._id,
          title: event.type === "graduation" ? "Graduation!" :
                 event.type === "apprentice_promotion" ? "Apprentice Promoted!" : "Education",
          description: event.description,
          severity: "positive",
          createdAt: Date.now(),
        });
      }

      // Check for organic religion emergence (religion emerges naturally from experiences)
      const religionEmergence = await processOrganicReligionEmergence(ctx, territory._id, newTick);
      if (religionEmergence.emerged && religionEmergence.message) {
        await ctx.db.insert("events", {
          tick: newTick,
          type: "breakthrough",
          territoryId: territory._id,
          title: "A New Faith Emerges!",
          description: religionEmergence.message,
          severity: "positive",
          createdAt: Date.now(),
        });
      }

      // Process religion (conversions, tithes, religious events)
      const religionEvents = await processReligion(ctx, territory._id, newTick);
      for (const event of religionEvents) {
        await ctx.db.insert("events", {
          tick: newTick,
          type: event.type === "miracle" ? "breakthrough" : "decision",
          territoryId: territory._id,
          title: event.type === "miracle" ? "Religious Miracle!" : "Religious Event",
          description: event.description,
          severity: event.type === "miracle" ? "positive" : "info",
          createdAt: Date.now(),
        });
      }

      // Process guilds (apprentice training, promotions)
      const guildEvents = await processGuilds(ctx, territory._id, newTick);
      for (const event of guildEvents) {
        await ctx.db.insert("events", {
          tick: newTick,
          type: "breakthrough",
          territoryId: territory._id,
          title: "Guild Promotion",
          description: event.description,
          severity: "positive",
          createdAt: Date.now(),
        });
      }

      // Process judicial system (prison releases, deaths)
      const judicialEvents = await processImprisoned(ctx, territory._id, newTick);
      for (const event of judicialEvents) {
        await ctx.db.insert("events", {
          tick: newTick,
          type: event.type === "death" ? "crisis" : "decision",
          territoryId: territory._id,
          title: event.type === "death" ? "Prison Death" :
                 event.type === "escape" ? "Prison Escape!" : "Prisoner Released",
          description: event.description,
          severity: event.type === "death" ? "negative" :
                   event.type === "escape" ? "negative" : "info",
          createdAt: Date.now(),
        });
      }

      // =============================================
      // PHASE 6c: ORGANIC KNOWLEDGE PROGRESSION
      // =============================================
      // Technologies emerge organically when enough of your population
      // has practical skill in related areas. No explicit "research" needed!

      // 1. Aggregate all character skills into population-level statistics
      await aggregatePopulationSkills(ctx, territory._id, newTick);

      // 2. Check each unresearched tech for skill requirements
      const territoryTechs = await ctx.db
        .query("technologies")
        .withIndex("by_territory", (q) => q.eq("territoryId", territory._id))
        .collect();

      const researchedTechIds = new Set(
        territoryTechs.filter((t) => t.researched).map((t) => t.techId)
      );

      // Get all population skills for this territory
      const popSkillsArray = await ctx.db
        .query("populationSkills")
        .withIndex("by_territory", (q) => q.eq("territoryId", territory._id))
        .collect();

      const popSkillsMap = new Map(
        popSkillsArray.map((ps) => [ps.skillType, ps])
      );

      // Find technologies that can be researched (prerequisites met)
      for (const tech of TECH_TREE) {
        // Skip if already researched
        if (researchedTechIds.has(tech.techId)) continue;

        // Skip if missing prerequisites
        const hasAllPrereqs = tech.prerequisites.every((prereq) =>
          researchedTechIds.has(prereq)
        );
        if (!hasAllPrereqs) continue;

        // Get or create technology record
        let techRecord = territoryTechs.find((t) => t.techId === tech.techId);
        if (!techRecord) {
          const newId = await ctx.db.insert("technologies", {
            territoryId: territory._id,
            techId: tech.techId,
            researched: false,
            researchProgress: 0,
          });
          techRecord = {
            _id: newId,
            _creationTime: Date.now(),
            territoryId: territory._id,
            techId: tech.techId,
            researched: false,
            researchProgress: 0,
          };
        }

        // For innate technologies, auto-complete them
        if (tech.isInnate) {
          await ctx.db.patch(techRecord._id, {
            researched: true,
            researchProgress: 100,
            researchedAtTick: newTick,
          });
          continue;
        }

        // Check skill requirements
        const requirements = await checkTechRequirements(
          ctx,
          territory._id,
          tech.requiredSkills || []
        );

        if (requirements.met) {
          // Requirements met! Calculate progress based on collective skill
          const skillBonus = calculateSkillBonus(
            tech.requiredSkills || [],
            popSkillsMap
          );

          // Mark research as started if not already
          if (!techRecord.researchStartedTick) {
            await ctx.db.patch(techRecord._id, {
              researchStartedTick: newTick,
            });
          }

          // Add progress (base + skill bonus)
          const newProgress = Math.min(
            100,
            (techRecord.researchProgress || 0) + skillBonus
          );
          await ctx.db.patch(techRecord._id, {
            researchProgress: newProgress,
          });

          // Check for breakthrough (random chance when progress > 80%)
          if (newProgress >= 80 && !techRecord.researched) {
            const breakthroughChance = (newProgress - 80) * 0.03; // 3% per point over 80
            if (Math.random() < breakthroughChance || newProgress >= 100) {
              // EUREKA! Technology discovered!
              await ctx.db.patch(techRecord._id, {
                researched: true,
                researchProgress: 100,
                researchedAtTick: newTick,
              });

              // Log the breakthrough
              await ctx.db.insert("events", {
                tick: newTick,
                type: "breakthrough",
                territoryId: territory._id,
                title: `Discovery: ${tech.name}!`,
                description: `Through years of practice and accumulated knowledge, your people have discovered ${tech.name}! ${tech.description}`,
                severity: "positive",
                createdAt: Date.now(),
              });

              // Record as memory for the agent
              const agent = await ctx.db
                .query("agents")
                .withIndex("by_territory", (q) => q.eq("territoryId", territory._id))
                .first();
              if (agent) {
                await recordMemory(ctx, agent._id, {
                  type: "victory",
                  description: `Our people discovered ${tech.name}! Their accumulated knowledge and practice finally yielded a breakthrough.`,
                  emotionalWeight: 50,
                });
              }
            }
          }
        }
      }

      // =============================================
      // PHASE 6d: HUMAN LIFE SYSTEMS
      // =============================================

      // Initialize gender roles if not present
      if (!territory.genderRoles) {
        await initializeGenderRoles(ctx, territory._id);
      }

      // Initialize fighting population if not present
      if (!territory.fightingPopulation) {
        await initializeFightingPopulation(ctx, territory._id);
      }

      // Initialize treasury if not present
      const existingTreasury = await ctx.db
        .query("treasury")
        .withIndex("by_territory", (q: any) => q.eq("territoryId", territory._id))
        .first();
      if (!existingTreasury) {
        await initializeTreasury(ctx, territory._id);
      }

      // Initialize weather if not present
      const existingWeather = await ctx.db
        .query("weather")
        .withIndex("by_territory", (q) => q.eq("territoryId", territory._id))
        .first();
      if (!existingWeather) {
        await initializeWeather(ctx, territory._id, newSeason, newTick);
      }

      // Process weather (changes, effects)
      const weatherResult = await processWeather(ctx, territory._id, newTick, newSeason);
      for (const event of weatherResult.events) {
        await ctx.db.insert("events", {
          tick: newTick,
          type: event.type === "extreme_weather" ? "disaster" : "decision",
          territoryId: territory._id,
          title: event.type === "extreme_weather" ? "Extreme Weather!" : "Weather Change",
          description: event.description,
          severity: event.type === "extreme_weather" ? "negative" : "info",
          createdAt: Date.now(),
        });
      }

      // Get current weather for disaster checks
      const currentWeather = await getWeather(ctx, territory._id);

      // INTERCONNECTION: Apply weather effects to food production and happiness
      if (currentWeather) {
        const currentTerr = await ctx.db.get(territory._id);
        if (currentTerr) {
          // Weather affects food production (farming modifier as percentage)
          const farmingEffect = currentWeather.farmingModifier / 100;
          const baseFoodChange = 2; // Base food production per tick
          const weatherFoodChange = Math.floor(baseFoodChange * (1 + farmingEffect));

          // Weather affects mood/happiness
          const moodEffect = currentWeather.moodModifier / 10; // Scaled down

          // Apply weather effects
          const newFood = Math.max(0, Math.min(200, currentTerr.food + weatherFoodChange));
          const newHappiness = Math.max(0, Math.min(100, currentTerr.happiness + moodEffect));

          await ctx.db.patch(territory._id, {
            food: newFood,
            happiness: newHappiness,
          });

          // Extreme weather events trigger additional effects
          if (currentWeather.isExtreme) {
            // Extreme weather causes stress/trauma to population
            if (currentWeather.currentWeather === "drought" && currentTerr.food < 50) {
              // Famine conditions - happiness drops faster
              await ctx.db.patch(territory._id, {
                happiness: Math.max(0, newHappiness - 5),
              });
            }
          }
        }
      }

      // Process infrastructure (construction, maintenance, decay)
      const infraResult = await processInfrastructure(ctx, territory._id, newTick);
      for (const event of infraResult.events) {
        await ctx.db.insert("events", {
          tick: newTick,
          type: event.type === "construction_complete" ? "breakthrough" : "decision",
          territoryId: territory._id,
          title: event.type === "construction_complete" ? "Construction Complete!" :
                 event.type === "infrastructure_collapsed" ? "Infrastructure Collapsed!" : "Infrastructure",
          description: event.description,
          severity: event.type === "infrastructure_collapsed" ? "negative" : "positive",
          createdAt: Date.now(),
        });
      }

      // Process economy (taxes, loans, inflation, wages)
      const economyResult = await processEconomy(ctx, territory._id, newTick);
      for (const event of economyResult.events) {
        await ctx.db.insert("events", {
          tick: newTick,
          type: event.type === "bankruptcy" || event.type === "loan_default" ? "crisis" :
                event.type === "economic_boom" || event.type === "phase_upgrade" ? "breakthrough" : "decision",
          territoryId: territory._id,
          title: event.type === "bankruptcy" ? "Economic Collapse!" :
                 event.type === "loan_default" ? "Loan Default!" :
                 event.type === "economic_boom" ? "Economic Boom!" :
                 event.type === "phase_upgrade" ? "Economic Advancement!" :
                 event.type === "hyperinflation" ? "Hyperinflation Crisis!" : "Treasury Update",
          description: event.description,
          severity: event.type === "bankruptcy" || event.type === "hyperinflation" ? "critical" :
                   event.type === "loan_default" ? "negative" :
                   event.type === "economic_boom" || event.type === "phase_upgrade" ? "positive" : "info",
          createdAt: Date.now(),
        });
      }

      // Check for natural disasters
      const disasterResult = await checkForRandomDisaster(
        ctx,
        territory._id,
        newTick,
        currentWeather?.currentWeather,
        newSeason
      );
      if (disasterResult.occurred && disasterResult.message) {
        await ctx.db.insert("events", {
          tick: newTick,
          type: "disaster",
          territoryId: territory._id,
          title: "Natural Disaster!",
          description: disasterResult.message,
          severity: "critical",
          createdAt: Date.now(),
        });
      }

      // Process active disasters (recovery progress)
      const activeDisasterResult = await processActiveDisasters(ctx, territory._id, newTick);
      for (const event of activeDisasterResult.events) {
        await ctx.db.insert("events", {
          tick: newTick,
          type: event.type === "recovery_complete" ? "breakthrough" : "decision",
          territoryId: territory._id,
          title: event.type === "recovery_complete" ? "Disaster Recovery Complete" : "Disaster Update",
          description: event.description,
          severity: event.type === "recovery_complete" ? "positive" : "info",
          createdAt: Date.now(),
        });
      }

      // Process gender dynamics (workforce changes)
      const genderResult = await processGenderDynamics(ctx, territory._id, newTick);
      for (const event of genderResult.events) {
        await ctx.db.insert("events", {
          tick: newTick,
          type: "decision",
          territoryId: territory._id,
          title: "Social Change",
          description: event.description,
          severity: "info",
          createdAt: Date.now(),
        });
      }

      // Process war demographics (fighting population)
      const warDemoResult = await processWarDemographics(ctx, territory._id, newTick);
      for (const event of warDemoResult.events) {
        await ctx.db.insert("events", {
          tick: newTick,
          type: event.type.includes("critical") ? "crisis" : "decision",
          territoryId: territory._id,
          title: event.type === "war_widows_crisis" ? "War Widow Crisis" :
                 event.type === "war_orphan_crisis" ? "Orphan Crisis" : "Military Update",
          description: event.description,
          severity: event.type.includes("crisis") ? "negative" : "info",
          createdAt: Date.now(),
        });
      }

      // Process friendships (bond growth/decay)
      const friendshipResult = await processFriendships(ctx, territory._id, newTick);
      for (const event of friendshipResult.events) {
        await ctx.db.insert("events", {
          tick: newTick,
          type: event.type === "friendship_ended" ? "crisis" : "breakthrough",
          territoryId: territory._id,
          title: event.type === "sworn_brothers" ? "Sworn Brotherhood!" :
                 event.type === "friendship_ended" ? "Friendship Ended" : "Friendship",
          description: event.description,
          severity: event.type === "friendship_ended" ? "negative" : "positive",
          createdAt: Date.now(),
        });
      }

      // Process romances (attraction, courtship, affairs)
      const romanceResult = await processRomances(ctx, territory._id, newTick);
      for (const event of romanceResult.events) {
        await ctx.db.insert("events", {
          tick: newTick,
          type: event.type.includes("scandal") ? "crisis" : "decision",
          territoryId: territory._id,
          title: event.type === "affair_discovered" ? "Scandal!" :
                 event.type === "courtship_success" ? "Love Blooms" : "Romance",
          description: event.description,
          severity: event.type.includes("scandal") || event.type.includes("discovered")
            ? "negative" : "info",
          createdAt: Date.now(),
        });
      }

      // Process marriages (alliances, divorces)
      const marriageResult = await processMarriages(ctx, territory._id, newTick);
      for (const event of marriageResult.events) {
        await ctx.db.insert("events", {
          tick: newTick,
          type: event.type === "marriage_dissolved" ? "crisis" : "breakthrough",
          territoryId: territory._id,
          title: event.type === "marriage_dissolved" ? "Marriage Ended" :
                 event.type === "child_born" ? "Birth!" : "Marriage",
          description: event.description,
          severity: event.type === "marriage_dissolved" ? "negative" : "positive",
          createdAt: Date.now(),
        });
      }

      // Process dynasties (succession, prestige)
      const dynastyResult = await processDynasties(ctx, territory._id, newTick);
      for (const event of dynastyResult.events) {
        await ctx.db.insert("events", {
          tick: newTick,
          type: event.type === "succession" ? "crisis" : "decision",
          territoryId: territory._id,
          title: event.type === "succession" ? "Succession!" :
                 event.type === "succession_tension" ? "Succession Crisis Brewing" : "Dynasty",
          description: event.description,
          severity: event.type === "succession" ? "critical" : "negative",
          createdAt: Date.now(),
        });
      }

      // Process mental health (trauma, recovery)
      const mentalHealthResult = await processMentalHealth(ctx, territory._id, newTick);
      for (const event of mentalHealthResult.events) {
        await ctx.db.insert("events", {
          tick: newTick,
          type: event.type.includes("death") ? "crisis" :
                event.type.includes("recovery") ? "breakthrough" : "decision",
          territoryId: territory._id,
          title: event.type === "tragic_death" ? "Tragic Loss" :
                 event.type.includes("madness") ? "Madness!" :
                 event.type.includes("recovery") ? "Mental Health Recovery" : "Mental Health",
          description: event.description,
          severity: event.type.includes("death") ? "critical" :
                   event.type.includes("madness") ? "negative" :
                   event.type.includes("recovery") ? "positive" : "info",
          createdAt: Date.now(),
        });
      }

      // Process addictions
      const addictionResult = await processAddictions(ctx, territory._id, newTick);
      for (const event of addictionResult.events) {
        await ctx.db.insert("events", {
          tick: newTick,
          type: event.type.includes("death") ? "crisis" : "decision",
          territoryId: territory._id,
          title: event.type.includes("death") ? "Tragic Death" :
                 event.type === "addiction_worsened" ? "Addiction Worsened" :
                 event.type === "addiction_discovered" ? "Secret Revealed" : "Addiction",
          description: event.description,
          severity: event.type.includes("death") ? "critical" :
                   event.type === "addiction_worsened" ? "negative" : "info",
          createdAt: Date.now(),
        });
      }

      // Process espionage
      const espionageResult = await processEspionage(ctx, territory._id, newTick);
      for (const event of espionageResult.events) {
        await ctx.db.insert("events", {
          tick: newTick,
          type: event.type.includes("captured") || event.type.includes("detected") ? "crisis" : "decision",
          territoryId: territory._id,
          title: event.type === "spy_captured" ? "Spy Captured!" :
                 event.type === "spy_detected" ? "Enemy Spy Caught!" :
                 event.type.includes("sabotage") ? "Sabotage!" :
                 event.type.includes("assassinate") ? "Assassination!" : "Intelligence",
          description: event.description,
          severity: event.type.includes("captured") ? "critical" :
                   event.type.includes("assassinate") ? "critical" :
                   event.type.includes("sabotage") ? "negative" : "info",
          createdAt: Date.now(),
        });
      }

      // NOTE: Sabotage is AI-driven, not automatic
      // The AI sees sabotage motivations (desperation, grudges, rivalry, etc.) in their prompt
      // and chooses when to execute sabotage actions based on circumstances

      // Calculate tension indicators
      await calculateTensions(ctx, territory._id, newTick);

      // Process organic war emergence (border incidents, escalation)
      const warEmergence = await processWarEmergence(ctx, territory._id, newTick);
      if (warEmergence.warDeclared && warEmergence.description) {
        // War event already created in processWarEmergence
        console.log(`[WAR] ${territory.name} - ${warEmergence.description}`);
      }

      // Process organic expansion (migration, raids when desperate, colonization)
      const expansion = await processExpansion(ctx, territory._id, newTick);
      if (expansion.actionTaken && expansion.description) {
        console.log(`[EXPANSION] ${territory.name} - ${expansion.description}`);
      }

      // Process returning expeditions
      await processExpeditionReturns(ctx, territory._id, newTick);

      // Update streaks
      const streakEvents = await updateStreaks(ctx, territory._id, newTick);
      for (const eventDesc of streakEvents) {
        await ctx.db.insert("events", {
          tick: newTick,
          type: "breakthrough",
          territoryId: territory._id,
          title: "Streak Achievement",
          description: eventDesc,
          severity: "positive",
          createdAt: Date.now(),
        });
      }

      // Check for population records
      const refreshedTerritory = await ctx.db.get(territory._id);
      if (refreshedTerritory) {
        await recordPopulationPeak(
          ctx,
          territory._id,
          refreshedTerritory.name,
          refreshedTerritory.population,
          newTick
        );
      }
    }

    // =============================================
    // PHASE 6e: GLOBAL EXPEDITIONS
    // =============================================

    // Process all active expeditions (global, not per-territory)
    const expeditionEvents = await processExpeditions(ctx, newTick);
    for (const event of expeditionEvents.events) {
      await ctx.db.insert("events", {
        tick: newTick,
        type: event.type.includes("returned") || event.type.includes("discovery") ? "breakthrough" :
              event.type.includes("lost") || event.type.includes("crisis") ? "crisis" : "decision",
        title: event.type.includes("returned") ? "Expedition Returns!" :
               event.type.includes("discovery") ? "Discovery!" :
               event.type.includes("lost") ? "Expedition Lost" :
               event.type.includes("crisis") ? "Expedition Crisis" : "Expedition Update",
        description: event.description,
        severity: event.type.includes("returned") ? "positive" :
                 event.type.includes("lost") ? "critical" :
                 event.type.includes("discovery") ? "positive" : "info",
        createdAt: Date.now(),
      });
    }

    // Update active wars
    const warEvents = await updateActiveWars(ctx, newTick);
    for (const eventDesc of warEvents) {
      await ctx.db.insert("events", {
        tick: newTick,
        type: "war",
        title: "War Update",
        description: eventDesc,
        severity: "info",
        createdAt: Date.now(),
      });
    }

    // Process rivalries
    const rivalryEvents = await processRivalries(ctx, newTick);
    for (const eventDesc of rivalryEvents) {
      await ctx.db.insert("events", {
        tick: newTick,
        type: "crisis",
        title: "Rivalry",
        description: eventDesc,
        severity: "negative",
        createdAt: Date.now(),
      });
    }

    // =============================================
    // PHASE 6B: ORGANIC AI GROWTH - MEMORY, BONDS, GOALS
    // =============================================

    // Process memory decay, bonds, and goals for each agent
    const organicGrowthAgents = await ctx.db.query("agents").collect();
    for (const agent of organicGrowthAgents) {
      // Skip eliminated territories
      const territory = await ctx.db.get(agent.territoryId);
      if (!territory || (territory as any).isEliminated) continue;

      // 1. Decay memories over time
      await decayMemories(ctx, agent._id, newTick);

      // 2. Get recent memories for goal triggers
      const recentMemories = await getRelevantMemories(
        ctx,
        agent._id,
        { limit: 20 }
      );

      // 3. Check for new emergent goals based on experiences
      await checkForGoalTriggers(ctx, agent._id, territory, recentMemories);

      // 4. Update goal progress
      await updateGoalProgress(ctx, agent._id, territory);

      // 5. Check if any goals have been achieved
      const achievements = await checkGoalAchievement(ctx, agent._id);
      for (const achievement of achievements) {
        await ctx.db.insert("events", {
          tick: newTick,
          type: "breakthrough",
          territoryId: territory._id,
          title: "Goal Achieved!",
          description: achievement,
          severity: "positive",
          createdAt: Date.now(),
        });
      }

      // 6. Prune impossible goals
      await pruneImpossibleGoals(ctx, agent._id);
    }

    // =============================================
    // ALLIANCE DURATION BONDS - Reward long alliances
    // =============================================
    // Every 10 ticks, check for long-standing alliances and create gratitude bonds
    if (newTick % 10 === 0) {
      const allRelationships = await ctx.db.query("relationships").collect();

      for (const rel of allRelationships) {
        // Check for long alliances (hasAlliance = true for extended period)
        if (rel.hasAlliance && rel.status === "allied") {
          // Check if alliance has existed for 10+ ticks by looking at lastInteractionTick
          // or just create bond if they've been allied (the bond system handles duplicates)

          // Check if we already have an alliance bond
          const existingBonds = await getBonds(ctx, rel.territory1Id, rel.territory2Id);
          const hasAllianceBond = existingBonds.some(b => b.bondType === "alliance_bond");

          if (!hasAllianceBond) {
            const territory1 = await ctx.db.get(rel.territory1Id);
            const territory2 = await ctx.db.get(rel.territory2Id);

            if (territory1 && territory2 && !(territory1 as any).isEliminated && !(territory2 as any).isEliminated) {
              // Create mutual alliance bonds
              await createBond(
                ctx,
                rel.territory1Id,
                rel.territory2Id,
                "alliance_bond",
                40,
                `Our alliance with ${territory2.name} has proven true through the seasons.`,
                true // Hereditary - good alliances are remembered
              );

              await createBond(
                ctx,
                rel.territory2Id,
                rel.territory1Id,
                "alliance_bond",
                40,
                `Our alliance with ${territory1.name} has stood the test of time.`,
                true
              );
            }
          }
        }

        // Also check for long trade partnerships
        if (rel.hasTradeAgreement && !rel.hasAlliance) {
          const existingBonds = await getBonds(ctx, rel.territory1Id, rel.territory2Id);
          const hasTradeBond = existingBonds.some(b => b.bondType === "trade_bond");

          if (!hasTradeBond) {
            const territory1 = await ctx.db.get(rel.territory1Id);
            const territory2 = await ctx.db.get(rel.territory2Id);

            if (territory1 && territory2 && !(territory1 as any).isEliminated && !(territory2 as any).isEliminated) {
              // Create mutual trade bonds (weaker than alliance)
              await createBond(
                ctx,
                rel.territory1Id,
                rel.territory2Id,
                "trade_bond",
                25,
                `Our trade with ${territory2.name} has brought prosperity to both peoples.`,
                false // Trade bonds are not hereditary
              );

              await createBond(
                ctx,
                rel.territory2Id,
                rel.territory1Id,
                "trade_bond",
                25,
                `Our trade with ${territory1.name} enriches us both.`,
                false
              );
            }
          }
        }
      }
    }

    // Process civilization bonds globally (decay over time)
    await processBonds(ctx, newTick);

    // Update leaderboards (every year, at start of year)
    if (newMonth === 1) {
      const leaderboardEvents = await updateLeaderboards(ctx, newTick);
      for (const eventDesc of leaderboardEvents) {
        await ctx.db.insert("events", {
          tick: newTick,
          type: "system",
          title: "Leaderboard Update",
          description: eventDesc,
          severity: "info",
          createdAt: Date.now(),
        });
      }
    }

    // =============================================
    // PHASE 6D: VIEWER ENGAGEMENT SYSTEMS
    // =============================================

    // Process world events (global plagues, famines, disasters, boons)
    const worldEventResults = await processWorldEvents(
      ctx,
      refreshedTerritories,
      world,
      newTick
    );

    // Log world event state changes
    for (const eventId of worldEventResults.endedEvents) {
      // Already logged in processWorldEvents
    }

    // Process rise and fall mechanics (decadence, golden ages, crises)
    const riseAndFallResults = await processRiseAndFall(
      ctx,
      refreshedTerritories,
      newTick
    );

    // Log rise and fall events
    for (const change of riseAndFallResults.statusChanges) {
      const territory = await ctx.db.get(change.territoryId);
      if (territory) {
        await ctx.db.insert("events", {
          tick: newTick,
          type: "system",
          territoryId: change.territoryId,
          title: `Status Change: ${change.newStatus}`,
          description: `${territory.tribeName || territory.name} has transitioned from ${change.oldStatus} to ${change.newStatus}.`,
          severity: change.newStatus === "collapsing" ? "critical" :
                   change.newStatus === "golden_age" ? "positive" :
                   change.newStatus === "crisis" ? "negative" : "info",
          createdAt: Date.now(),
        });
      }
    }

    // Check and award milestones for each territory
    for (const territory of refreshedTerritories) {
      if (territory.isEliminated) continue;

      // Gather extras for milestone checking
      const territoryTechs = await ctx.db
        .query("technologies")
        .withIndex("by_territory", (q) => q.eq("territoryId", territory._id))
        .collect();

      const researchedTechIds = territoryTechs
        .filter((t) => t.researched)
        .map((t) => t.techId);

      // Determine current era from researched techs
      let currentEra = "stone_age";
      const eraOrder = ["stone_age", "bronze_age", "iron_age", "medieval", "renaissance", "industrial", "modern", "atomic"];
      for (const tech of TECH_TREE) {
        if (researchedTechIds.includes(tech.techId)) {
          const techEraIndex = eraOrder.indexOf(tech.era);
          const currentEraIndex = eraOrder.indexOf(currentEra);
          if (techEraIndex > currentEraIndex) {
            currentEra = tech.era;
          }
        }
      }

      // Get rise and fall status for golden age check
      const riseAndFall = await getRiseAndFallStatus(ctx, territory._id);

      // Count trade routes
      const tradeRoutes = await ctx.db
        .query("tradeRoutes")
        .filter((q) => q.or(
          q.eq(q.field("territory1Id"), territory._id),
          q.eq(q.field("territory2Id"), territory._id)
        ))
        .collect();
      const activeTradeRoutes = tradeRoutes.filter((tr) => tr.isActive).length;

      // Check for religion
      const hasReligion = await ctx.db
        .query("religions")
        .withIndex("by_territory", (q) => q.eq("foundingTerritoryId", territory._id))
        .first();

      // Count wars won/lost from ruler record
      const ruler = await ctx.db
        .query("characters")
        .withIndex("by_territory", (q) => q.eq("territoryId", territory._id))
        .filter((q) => q.and(
          q.eq(q.field("role"), "ruler"),
          q.eq(q.field("isAlive"), true)
        ))
        .first();

      const warsWon = ruler?.trustRecord?.warsWon || 0;
      const warsLost = ruler?.trustRecord?.warsLost || 0;

      // Check for university
      const hasUniversity = await ctx.db
        .query("schools")
        .withIndex("by_territory", (q) => q.eq("territoryId", territory._id))
        .filter((q) => q.eq(q.field("schoolType"), "university"))
        .first();

      // Check milestones
      await checkAndAwardMilestones(ctx, territory, world, newTick, {
        techs: researchedTechIds,
        era: currentEra,
        warsWon,
        warsLost,
        hasReligion: !!hasReligion,
        hasUniversity: !!hasUniversity,
        inGoldenAge: riseAndFall?.status === "golden_age",
        tradeRoutes: activeTradeRoutes,
      });
    }

    // =============================================
    // PHASE 6E: ENDGAME TENSIONS (NUCLEAR DYNAMICS)
    // =============================================

    // Only process endgame tensions if any civ has reached atomic era
    const atomicTechs = await ctx.db
      .query("technologies")
      .filter((q) => q.and(
        q.eq(q.field("techId"), "nuclear_fission"),
        q.eq(q.field("researched"), true)
      ))
      .collect();

    if (atomicTechs.length > 0) {
      const endgameResults = await processEndgameTensions(
        ctx,
        refreshedTerritories,
        newTick
      );

      // Log doomsday clock movements
      if (endgameResults.doomsdayMovement) {
        // Already logged in processEndgameTensions
      }

      // Log new nuclear powers
      for (const territoryId of endgameResults.newArsenals) {
        // Already logged in processEndgameTensions
      }
    }

    // Generate yearly chronicle (at end of each year)
    if (newMonth === 1 && newYear > 0) {
      const prevYear = newYear - 1;
      const startTick = prevYear * 12;
      const endTick = (prevYear + 1) * 12 - 1;

      await generateYearlyChronicle(ctx, prevYear, startTick, endTick);
    }

    // =============================================
    // PHASE 7: COMPETITION SYSTEM - ELIMINATION & VICTORY
    // =============================================

    // Ensure a match is running
    const match = await ctx.db
      .query("matches")
      .withIndex("by_status", (q) => q.eq("status", "running"))
      .first();

    if (!match) {
      // Start a new match if none exists
      await startMatch(ctx as any, newTick);
    }

    // Refresh territories for competition checks
    const competitionTerritories = await ctx.db.query("territories").collect();

    // Check for eliminations (population < 5 for 12 consecutive ticks)
    const eliminationResults = await checkElimination(ctx as any, competitionTerritories, newTick);
    for (const elimination of eliminationResults) {
      if (elimination.eliminated && elimination.description) {
        await ctx.db.insert("events", {
          tick: newTick,
          type: "system",
          territoryId: elimination.territoryId,
          title: `ELIMINATION: ${elimination.territoryName}`,
          description: elimination.description,
          severity: "critical",
          createdAt: Date.now(),
        });

        // Record as key moment
        await recordKeyMoment(
          ctx as any,
          `${elimination.territoryName} Eliminated`,
          elimination.description,
          newTick
        );
      }
    }

    // Check for victory conditions
    const activeMatch = await ctx.db
      .query("matches")
      .withIndex("by_status", (q) => q.eq("status", "running"))
      .first();

    if (activeMatch) {
      const victoryResult = await checkVictoryConditions(
        ctx as any,
        competitionTerritories,
        newTick
      );

      if (victoryResult.hasWinner) {
        // End the match with the victory
        await endMatch(ctx as any, activeMatch, victoryResult, competitionTerritories, newTick);

        // Log victory event (already done in endMatch, but also add to events)
        await ctx.db.insert("events", {
          tick: newTick,
          type: "system",
          territoryId: victoryResult.winnerId,
          title: `VICTORY!`,
          description: victoryResult.description || "A civilization has won!",
          severity: "critical",
          createdAt: Date.now(),
        });

        // Pause the simulation
        await ctx.db.patch(world._id, {
          status: "paused",
          speed: "paused",
        });

        return {
          tick: newTick,
          year: newYear,
          month: newMonth,
          victory: {
            winner: victoryResult.winnerName,
            type: victoryResult.victoryType,
          },
        };
      }
    }

    // Record power scores every 3 ticks (quarterly) for history
    if (newTick % 3 === 0) {
      await recordPowerScores(ctx as any, newTick);
    }

    // Record key moments for significant events
    // Check for first-place changes
    const scoringRelationships = await ctx.db.query("relationships").collect();
    const rankings = await getPowerRankings(ctx as any, competitionTerritories, scoringRelationships);
    const activeTerritoryCount = competitionTerritories.filter(t => !t.isEliminated).length;

    // Record if a new leader emerges (check every 12 ticks = yearly)
    if (newTick % 12 === 0 && rankings.length > 0 && activeMatch) {
      const leader = rankings[0];
      if (!leader.isEliminated) {
        await recordKeyMoment(
          ctx as any,
          `${leader.territoryName} leads`,
          `${leader.territoryName} holds the lead with a power score of ${leader.powerScore}. ${activeTerritoryCount} civilizations remain.`,
          newTick
        );
      }
    }

    // =============================================
    // SCHEDULE AI DECISIONS
    // =============================================

    // Only schedule AI decisions for non-eliminated territories
    const agents = await ctx.db.query("agents").collect();
    const eliminatedTerritoryIds = new Set(
      competitionTerritories.filter(t => t.isEliminated).map(t => t._id.toString())
    );

    let decisionIndex = 0;
    for (const agent of agents) {
      // Skip eliminated territories
      if (eliminatedTerritoryIds.has(agent.territoryId.toString())) {
        continue;
      }

      // Stagger by 2 seconds to avoid rate limits
      const delay = decisionIndex * 2000;
      await ctx.scheduler.runAfter(delay, internal.ai.decisions.makeDecision, {
        agentId: agent._id,
        tick: newTick,
      });
      decisionIndex++;
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
