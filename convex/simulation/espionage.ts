/**
 * Espionage System
 *
 * Handles spies, intelligence gathering, sabotage, counter-intelligence,
 * and covert operations.
 */

import { MutationCtx, QueryCtx } from "../_generated/server";
import { Id, Doc } from "../_generated/dataModel";

// Spy covers (disguises)
export type SpyCover = "merchant" | "diplomat" | "servant" | "scholar" | "traveler";

// Mission types
export type SpyMission =
  | "gather_intel"
  | "sabotage"
  | "assassinate"
  | "steal_tech"
  | "incite_rebellion";

// Spy status
export type SpyStatus = "active" | "extracted" | "captured" | "executed" | "turned";

// Mission difficulty modifiers
const MISSION_DIFFICULTY: Record<SpyMission, number> = {
  gather_intel: 1,
  sabotage: 1.5,
  steal_tech: 2,
  incite_rebellion: 2.5,
  assassinate: 3,
};

// Cover effectiveness
const COVER_EFFECTIVENESS: Record<SpyCover, { blending: number; access: string[] }> = {
  merchant: { blending: 70, access: ["markets", "trade_routes", "merchants"] },
  diplomat: { blending: 50, access: ["court", "nobles", "politics"] },
  servant: { blending: 90, access: ["households", "private_areas", "secrets"] },
  scholar: { blending: 60, access: ["libraries", "technology", "education"] },
  traveler: { blending: 80, access: ["general", "maps", "terrain"] },
};

/**
 * Train a new spy
 */
export async function trainSpy(
  ctx: MutationCtx,
  ownerTerritoryId: Id<"territories">,
  characterId: Id<"characters"> | undefined,
  codename: string,
  tick: number
): Promise<{ spyId: Id<"spies">; message: string }> {
  const territory = await ctx.db.get(ownerTerritoryId);
  if (!territory) throw new Error("Territory not found");

  // Training cost
  const trainingCost = 200;
  if (territory.wealth < trainingCost) {
    throw new Error("Not enough gold to train spy");
  }

  // Deduct cost
  await ctx.db.patch(ownerTerritoryId, {
    wealth: territory.wealth - trainingCost,
  });

  // Calculate base skill (higher technology = better spies)
  const baseSkill = 30 + Math.floor(territory.technology / 3);
  const skill = Math.min(100, baseSkill + Math.floor(Math.random() * 20));

  const spyId = await ctx.db.insert("spies", {
    ownerTerritoryId,
    targetTerritoryId: ownerTerritoryId, // Starts at home
    characterId,
    codename,
    skill,
    cover: "traveler", // Default cover
    mission: "gather_intel", // Default mission
    infiltrationLevel: 0,
    discoveryRisk: 0,
    status: "active",
    intelligence: [],
    deployedTick: tick,
  });

  return {
    spyId,
    message: `Spy "${codename}" has completed training (Skill: ${skill}).`,
  };
}

/**
 * Deploy spy to target territory
 */
export async function deploySpy(
  ctx: MutationCtx,
  spyId: Id<"spies">,
  targetTerritoryId: Id<"territories">,
  cover: SpyCover,
  mission: SpyMission,
  tick: number
): Promise<{ success: boolean; message: string }> {
  const spy = await ctx.db.get(spyId);
  if (!spy) return { success: false, message: "Spy not found" };

  if (spy.status !== "active") {
    return { success: false, message: `Spy is ${spy.status}, cannot deploy` };
  }

  const targetTerritory = await ctx.db.get(targetTerritoryId);
  if (!targetTerritory) return { success: false, message: "Target territory not found" };

  // Calculate initial discovery risk based on target's counter-intelligence
  const counterIntel = targetTerritory.spyNetwork?.counterIntelligence || 10;
  const coverEffectiveness = COVER_EFFECTIVENESS[cover].blending;
  const initialRisk = Math.max(5, counterIntel - coverEffectiveness / 2 - spy.skill / 3);

  await ctx.db.patch(spyId, {
    targetTerritoryId,
    cover,
    mission,
    infiltrationLevel: 0,
    discoveryRisk: initialRisk,
    deployedTick: tick,
  });

  // Record memory for owner
  const agent = await ctx.db
    .query("agents")
    .withIndex("by_territory", (q) => q.eq("territoryId", spy.ownerTerritoryId))
    .first();

  if (agent) {
    await ctx.db.insert("agentMemories", {
      agentId: agent._id,
      territoryId: spy.ownerTerritoryId,
      memoryType: "trade",
      tick,
      description: `Deployed spy "${spy.codename}" to ${targetTerritory.name} as a ${cover} to ${mission.replace(/_/g, " ")}.`,
      emotionalWeight: 0,
      salience: 50,
      timesReferenced: 0,
    });
  }

  return {
    success: true,
    message: `Spy "${spy.codename}" deployed to ${targetTerritory.name} as a ${cover}.`,
  };
}

/**
 * Extract spy (bring them home)
 */
export async function extractSpy(
  ctx: MutationCtx,
  spyId: Id<"spies">,
  tick: number
): Promise<{ success: boolean; message: string }> {
  const spy = await ctx.db.get(spyId);
  if (!spy) return { success: false, message: "Spy not found" };

  if (spy.status !== "active") {
    return { success: false, message: `Spy is ${spy.status}, cannot extract` };
  }

  // Extraction has a risk of discovery
  const extractionRisk = spy.discoveryRisk * 1.5; // Higher risk during extraction
  const discoveryRoll = Math.random() * 100;

  if (discoveryRoll < extractionRisk) {
    // Discovered during extraction!
    await ctx.db.patch(spyId, {
      status: "captured",
    });

    return {
      success: false,
      message: `Spy "${spy.codename}" was discovered and captured during extraction!`,
    };
  }

  await ctx.db.patch(spyId, {
    status: "extracted",
    targetTerritoryId: spy.ownerTerritoryId,
  });

  return {
    success: true,
    message: `Spy "${spy.codename}" successfully extracted with ${spy.intelligence.length} pieces of intelligence.`,
  };
}

/**
 * Process spy activities
 */
async function processSpyMission(
  ctx: MutationCtx,
  spy: Doc<"spies">,
  tick: number
): Promise<{ events: Array<{ type: string; description: string }> }> {
  const events: Array<{ type: string; description: string }> = [];

  if (spy.status !== "active") return { events };

  const targetTerritory = await ctx.db.get(spy.targetTerritoryId);
  if (!targetTerritory) return { events };

  // Skip if spy is at home
  if (spy.targetTerritoryId === spy.ownerTerritoryId) return { events };

  // Infiltration builds over time
  const newInfiltration = Math.min(100, spy.infiltrationLevel + 5);

  // Discovery risk increases with activity
  const counterIntel = targetTerritory.spyNetwork?.counterIntelligence || 10;
  const missionDifficulty = MISSION_DIFFICULTY[spy.mission];
  const riskIncrease = (counterIntel / 10) * missionDifficulty - spy.skill / 20;
  const newDiscoveryRisk = Math.min(100, spy.discoveryRisk + Math.max(0, riskIncrease));

  // Check for discovery
  const discoveryRoll = Math.random() * 100;
  if (discoveryRoll < newDiscoveryRisk) {
    // Spy discovered!
    await ctx.db.patch(spy._id, {
      status: "captured",
    });

    events.push({
      type: "spy_captured",
      description: `Our spy "${spy.codename}" has been captured in ${targetTerritory.name}!`,
    });

    // Alert target territory
    const targetAgent = await ctx.db
      .query("agents")
      .withIndex("by_territory", (q) => q.eq("territoryId", spy.targetTerritoryId))
      .first();

    if (targetAgent) {
      const ownerTerritory = await ctx.db.get(spy.ownerTerritoryId);
      await ctx.db.insert("agentMemories", {
        agentId: targetAgent._id,
        territoryId: spy.targetTerritoryId,
        memoryType: "trade",
        tick,
        description: `A spy from ${ownerTerritory?.name || "unknown"} has been captured! They were posing as a ${spy.cover}.`,
        emotionalWeight: -20,
        salience: 80,
        timesReferenced: 0,
      });
    }

    return { events };
  }

  // Mission success check (if infiltration is high enough)
  if (newInfiltration >= 50) {
    const missionSuccess = await attemptMission(ctx, spy, targetTerritory, tick);
    if (missionSuccess.success) {
      events.push({
        type: `spy_${spy.mission}`,
        description: missionSuccess.message,
      });

      // Add intelligence
      if (missionSuccess.intelligence) {
        const currentIntel = spy.intelligence || [];
        await ctx.db.patch(spy._id, {
          intelligence: [
            ...currentIntel,
            {
              type: spy.mission,
              info: missionSuccess.intelligence,
              tick,
              accuracy: Math.min(100, spy.skill + Math.floor(Math.random() * 20)),
            },
          ],
        });
      }
    }
  }

  // Update spy
  await ctx.db.patch(spy._id, {
    infiltrationLevel: newInfiltration,
    discoveryRisk: newDiscoveryRisk,
  });

  return { events };
}

/**
 * Attempt a mission
 */
async function attemptMission(
  ctx: MutationCtx,
  spy: Doc<"spies">,
  target: Doc<"territories">,
  tick: number
): Promise<{ success: boolean; message: string; intelligence?: string }> {
  const difficulty = MISSION_DIFFICULTY[spy.mission];
  const successChance = (spy.skill + spy.infiltrationLevel / 2) / (100 * difficulty);

  if (Math.random() > successChance) {
    return { success: false, message: "Mission attempt failed" };
  }

  switch (spy.mission) {
    case "gather_intel":
      // Gather various information
      const intelTypes = [
        `Military strength: ~${Math.floor(target.military * (0.8 + Math.random() * 0.4))} soldiers`,
        `Gold reserves: ~${Math.floor(target.wealth * (0.7 + Math.random() * 0.6))}`,
        `Population: ~${Math.floor(target.population * (0.85 + Math.random() * 0.3))}`,
        `Happiness: ${target.happiness > 70 ? "high" : target.happiness > 40 ? "moderate" : "low"}`,
        `Defenses: ${target.military > 1000 ? "well defended" : "vulnerable"}`,
      ];
      const intel = intelTypes[Math.floor(Math.random() * intelTypes.length)];

      return {
        success: true,
        message: `Spy "${spy.codename}" gathered intelligence from ${target.name}.`,
        intelligence: intel,
      };

    case "sabotage":
      // Damage random building or infrastructure
      const buildings = await ctx.db
        .query("buildings")
        .withIndex("by_territory", (q) => q.eq("territoryId", target._id))
        .collect();

      if (buildings.length > 0) {
        const targetBuilding = buildings[Math.floor(Math.random() * buildings.length)];
        await ctx.db.delete(targetBuilding._id);

        return {
          success: true,
          message: `Spy "${spy.codename}" sabotaged a ${targetBuilding.type} in ${target.name}!`,
          intelligence: `Destroyed ${targetBuilding.type}`,
        };
      }
      return { success: false, message: "No viable sabotage targets" };

    case "steal_tech":
      // Steal technology knowledge
      if (target.technology > 50) {
        return {
          success: true,
          message: `Spy "${spy.codename}" stole technological secrets from ${target.name}!`,
          intelligence: `Technological techniques (technology level: ${target.technology})`,
        };
      }
      return { success: false, message: "No valuable technology to steal" };

    case "incite_rebellion":
      // Lower happiness/stability
      await ctx.db.patch(target._id, {
        happiness: Math.max(0, target.happiness - 10),
      });

      return {
        success: true,
        message: `Spy "${spy.codename}" incited unrest in ${target.name}!`,
        intelligence: "Rebellion seeds planted",
      };

    case "assassinate":
      // Very difficult - target a character
      const characters = await ctx.db
        .query("characters")
        .withIndex("by_territory", (q) => q.eq("territoryId", target._id))
        .filter((q) => q.eq(q.field("isAlive"), true))
        .collect();

      // Find important targets (rulers, generals)
      const importantTargets = characters.filter(
        (c) =>
          c.role === "ruler" ||
          c.role === "general" ||
          c.role === "advisor" ||
          c.role === "heir"
      );

      if (importantTargets.length > 0) {
        const victim = importantTargets[Math.floor(Math.random() * importantTargets.length)];
        await ctx.db.patch(victim._id, {
          isAlive: false,
          deathTick: tick,
          deathCause: "assassination",
        });

        return {
          success: true,
          message: `Spy "${spy.codename}" assassinated ${victim.name} in ${target.name}!`,
          intelligence: `Assassinated ${victim.name} (${victim.role})`,
        };
      }
      return { success: false, message: "No viable assassination targets" };

    default:
      return { success: false, message: "Unknown mission type" };
  }
}

/**
 * Handle captured spy
 */
export async function handleCapturedSpy(
  ctx: MutationCtx,
  spyId: Id<"spies">,
  action: "execute" | "imprison" | "turn",
  tick: number
): Promise<{ success: boolean; message: string }> {
  const spy = await ctx.db.get(spyId);
  if (!spy) return { success: false, message: "Spy not found" };

  if (spy.status !== "captured") {
    return { success: false, message: "Spy is not captured" };
  }

  const ownerTerritory = await ctx.db.get(spy.ownerTerritoryId);

  switch (action) {
    case "execute":
      await ctx.db.patch(spyId, { status: "executed" });

      // Notify owner
      const ownerAgent = await ctx.db
        .query("agents")
        .withIndex("by_territory", (q) => q.eq("territoryId", spy.ownerTerritoryId))
        .first();

      if (ownerAgent) {
        await ctx.db.insert("agentMemories", {
          agentId: ownerAgent._id,
          territoryId: spy.ownerTerritoryId,
          memoryType: "trade",
          tick,
          description: `Our spy "${spy.codename}" has been executed.`,
          emotionalWeight: -30,
          salience: 70,
          timesReferenced: 0,
        });
      }

      return {
        success: true,
        message: `Spy "${spy.codename}" from ${ownerTerritory?.name || "unknown"} has been executed.`,
      };

    case "imprison":
      // Keep captured status - can be used for prisoner exchange
      return {
        success: true,
        message: `Spy "${spy.codename}" from ${ownerTerritory?.name || "unknown"} has been imprisoned.`,
      };

    case "turn":
      // Convert to double agent
      const turnChance = 0.3 + (100 - spy.skill) / 200; // Less skilled = easier to turn
      if (Math.random() < turnChance) {
        await ctx.db.patch(spyId, {
          status: "turned",
          ownerTerritoryId: spy.targetTerritoryId, // Now works for the captors
          targetTerritoryId: spy.ownerTerritoryId, // Targets their former masters
        });

        return {
          success: true,
          message: `Spy "${spy.codename}" has been turned and now works for us!`,
        };
      } else {
        // Failed to turn - spy commits suicide or escapes attempt
        await ctx.db.patch(spyId, { status: "executed" });
        return {
          success: false,
          message: `Failed to turn spy "${spy.codename}". They chose death over betrayal.`,
        };
      }

    default:
      return { success: false, message: "Unknown action" };
  }
}

/**
 * Increase counter-intelligence
 */
export async function increaseCounterIntelligence(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  amount: number,
  tick: number
): Promise<{ success: boolean; message: string }> {
  const territory = await ctx.db.get(territoryId);
  if (!territory) return { success: false, message: "Territory not found" };

  const cost = amount * 50;
  if (territory.wealth < cost) {
    return { success: false, message: `Not enough gold (need ${cost})` };
  }

  // Deduct cost
  await ctx.db.patch(territoryId, {
    wealth: territory.wealth - cost,
    spyNetwork: {
      spymasterId: territory.spyNetwork?.spymasterId,
      budget: territory.spyNetwork?.budget || 0,
      counterIntelligence: Math.min(
        100,
        (territory.spyNetwork?.counterIntelligence || 10) + amount
      ),
      knownEnemySpies: territory.spyNetwork?.knownEnemySpies || 0,
      ownSpiesActive: territory.spyNetwork?.ownSpiesActive || 0,
    },
  });

  return {
    success: true,
    message: `Counter-intelligence increased. Enemy spies will find it harder to operate here.`,
  };
}

/**
 * Process all espionage in territory
 */
export async function processEspionage(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  tick: number
): Promise<{ events: Array<{ type: string; description: string }> }> {
  const allEvents: Array<{ type: string; description: string }> = [];

  // Process our spies
  const ourSpies = await ctx.db
    .query("spies")
    .withIndex("by_owner", (q) => q.eq("ownerTerritoryId", territoryId))
    .collect();

  for (const spy of ourSpies) {
    const { events } = await processSpyMission(ctx, spy, tick);
    allEvents.push(...events);
  }

  // Check for enemy spies in our territory
  const enemySpies = await ctx.db
    .query("spies")
    .withIndex("by_target", (q) => q.eq("targetTerritoryId", territoryId))
    .filter((q) => q.eq(q.field("status"), "active"))
    .collect();

  if (enemySpies.length > 0) {
    // Counter-intelligence may detect them
    const territory = await ctx.db.get(territoryId);
    const counterIntel = territory?.spyNetwork?.counterIntelligence || 10;

    for (const spy of enemySpies) {
      // Additional detection chance from counter-intelligence
      const detectionChance = counterIntel / 200;
      if (Math.random() < detectionChance) {
        await ctx.db.patch(spy._id, { status: "captured" });
        allEvents.push({
          type: "spy_detected",
          description: `Counter-intelligence has captured an enemy spy operating as a ${spy.cover}!`,
        });

        // INTERCONNECTION: Spy capture damages relationships
        // Finding a spy from another territory severely damages trust
        const spyOwnerTerritoryId = spy.ownerTerritoryId;
        const ownerTerritory = await ctx.db.get(spyOwnerTerritoryId);

        // Find the relationship between these territories
        const relationship = await ctx.db
          .query("relationships")
          .filter((q) =>
            q.or(
              q.and(
                q.eq(q.field("territory1Id"), territoryId),
                q.eq(q.field("territory2Id"), spyOwnerTerritoryId)
              ),
              q.and(
                q.eq(q.field("territory1Id"), spyOwnerTerritoryId),
                q.eq(q.field("territory2Id"), territoryId)
              )
            )
          )
          .first();

        if (relationship) {
          // Significant trust damage for espionage
          const trustDamage = 25 + Math.floor(spy.skill / 4); // 25-50 trust damage
          const newTrust = Math.max(-100, relationship.trust - trustDamage);

          // Determine new status based on trust
          let newStatus = relationship.status;
          if (newTrust < -75 && relationship.status !== "at_war") {
            newStatus = "hostile";
          } else if (newTrust < -50 && relationship.status !== "at_war" && relationship.status !== "hostile") {
            newStatus = "tense";
          }

          await ctx.db.patch(relationship._id, {
            trust: newTrust,
            status: newStatus,
          });

          allEvents.push({
            type: "diplomatic_incident",
            description: `Capturing a spy from ${ownerTerritory?.name || "unknown"} has damaged relations! Trust: ${trustDamage > 35 ? "SEVERELY" : "significantly"} reduced.`,
          });

          // INTERCONNECTION: Severe spy missions can trigger war
          const { processSpyWarTrigger } = await import("./warEmergence");
          const warResult = await processSpyWarTrigger(
            ctx,
            spyOwnerTerritoryId,
            territoryId,
            spy.mission,
            tick
          );

          if (warResult.warDeclared) {
            allEvents.push({
              type: "war_declared",
              description: `The discovery of the spy's ${spy.mission} mission has led to WAR with ${ownerTerritory?.name || "unknown"}!`,
            });
          }
        }
      }
    }
  }

  return { events: allEvents };
}

/**
 * Get espionage summary for AI
 */
export async function getEspionageSummary(
  ctx: QueryCtx,
  territoryId: Id<"territories">
): Promise<string> {
  const territory = await ctx.db.get(territoryId);

  const ourSpies = await ctx.db
    .query("spies")
    .withIndex("by_owner", (q) => q.eq("ownerTerritoryId", territoryId))
    .collect();

  const activeSpies = ourSpies.filter((s) => s.status === "active");
  const capturedSpies = ourSpies.filter((s) => s.status === "captured");

  // Intelligence gathered
  const totalIntel = ourSpies.reduce((sum, s) => sum + s.intelligence.length, 0);

  let summary = `Spy network: ${activeSpies.length} active agents, ${capturedSpies.length} captured. `;
  summary += `Intelligence gathered: ${totalIntel} reports. `;
  summary += `Counter-intelligence: ${territory?.spyNetwork?.counterIntelligence || 10}/100.`;

  return summary;
}
