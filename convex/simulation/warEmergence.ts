import { MutationCtx, QueryCtx } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";
import { recordMemory } from "./memory";

// =============================================
// ORGANIC WAR EMERGENCE SYSTEM
// =============================================
// Wars emerge naturally from tensions, incidents, and circumstances.
// Not every conflict is chosen - some are thrust upon civilizations.

// =============================================
// CASUS BELLI (REASONS FOR WAR)
// =============================================

export type CasusBelli =
  | "border_incident"      // Patrol clash escalated
  | "resource_desperation" // Starving, must take food
  | "trade_dispute"        // Trade conflict escalated
  | "religious_conflict"   // Different faiths clashing
  | "revenge"              // Retaliation for past attack
  | "alliance_obligation"  // Ally called us to war
  | "territorial_claim"    // Historical claim to land
  | "insult_to_honor"      // Diplomatic insult
  | "succession_dispute"   // Disputed inheritance
  | "hot_headed_general"   // Military leader acted without orders
  | "refugee_crisis"       // Fleeing people caused conflict
  | "assassination"        // Important person killed
  | "spy_discovered"       // Espionage caused outrage
  | "unprovoked_aggression"; // They attacked first

const CASUS_BELLI_DESCRIPTIONS: Record<CasusBelli, string> = {
  border_incident: "A clash between border patrols escalated into open conflict",
  resource_desperation: "Desperate hunger drove them to take what they needed by force",
  trade_dispute: "A trade disagreement turned violent",
  religious_conflict: "Religious differences erupted into holy war",
  revenge: "They struck back for past wrongs",
  alliance_obligation: "Honor demanded they fight alongside their allies",
  territorial_claim: "They pressed an ancient claim to the land",
  insult_to_honor: "A grievous insult could not go unanswered",
  succession_dispute: "A disputed succession sparked conflict",
  hot_headed_general: "An overzealous commander started the fight",
  refugee_crisis: "Fleeing refugees caused tensions that exploded",
  assassination: "The murder of an important figure demanded blood",
  spy_discovered: "A captured spy revealed hostile intentions",
  unprovoked_aggression: "They were attacked without warning",
};

// =============================================
// BORDER INCIDENT SYSTEM
// =============================================

interface BorderIncident {
  type: "patrol_clash" | "cattle_raid" | "fishing_dispute" | "merchant_robbery" | "refugee_conflict" | "religious_clash";
  severity: "minor" | "moderate" | "serious" | "severe";
  casualties: number;
  description: string;
}

const INCIDENT_TYPES = [
  { type: "patrol_clash", baseChance: 0.3, description: "Border patrols encountered each other" },
  { type: "cattle_raid", baseChance: 0.2, description: "Livestock was taken across the border" },
  { type: "fishing_dispute", baseChance: 0.15, description: "Fishermen clashed over fishing grounds" },
  { type: "merchant_robbery", baseChance: 0.2, description: "Merchants were robbed near the border" },
  { type: "refugee_conflict", baseChance: 0.1, description: "Refugees caused tensions at the border" },
  { type: "religious_clash", baseChance: 0.05, description: "Religious pilgrims were attacked" },
] as const;

/**
 * Generate a random border incident based on relationship tension
 */
function generateBorderIncident(
  tensionLevel: number,
  hasDifferentReligion: boolean,
  hasRefugees: boolean
): BorderIncident | null {
  // Base chance of incident increases with tension
  const baseIncidentChance = 0.02 + (tensionLevel / 100) * 0.15;

  if (Math.random() > baseIncidentChance) {
    return null;
  }

  // Select incident type
  let incidentPool = [...INCIDENT_TYPES];

  // Religious clashes more likely if different religions
  if (hasDifferentReligion) {
    const religiousIdx = incidentPool.findIndex(i => i.type === "religious_clash");
    if (religiousIdx >= 0) {
      incidentPool[religiousIdx] = { ...incidentPool[religiousIdx], baseChance: 0.2 };
    }
  }

  // Refugee conflicts if refugees present
  if (hasRefugees) {
    const refugeeIdx = incidentPool.findIndex(i => i.type === "refugee_conflict");
    if (refugeeIdx >= 0) {
      incidentPool[refugeeIdx] = { ...incidentPool[refugeeIdx], baseChance: 0.25 };
    }
  }

  // Weighted random selection
  const totalWeight = incidentPool.reduce((sum, i) => sum + i.baseChance, 0);
  let random = Math.random() * totalWeight;
  let selectedType = incidentPool[0];

  for (const incident of incidentPool) {
    random -= incident.baseChance;
    if (random <= 0) {
      selectedType = incident;
      break;
    }
  }

  // Determine severity based on tension
  let severity: BorderIncident["severity"];
  const severityRoll = Math.random() * 100;

  if (severityRoll < 50 - tensionLevel * 0.3) {
    severity = "minor";
  } else if (severityRoll < 75 - tensionLevel * 0.2) {
    severity = "moderate";
  } else if (severityRoll < 90 - tensionLevel * 0.1) {
    severity = "serious";
  } else {
    severity = "severe";
  }

  // Calculate casualties
  const casualtyMultiplier = { minor: 1, moderate: 3, serious: 8, severe: 20 };
  const casualties = Math.floor(Math.random() * casualtyMultiplier[severity]) + 1;

  return {
    type: selectedType.type,
    severity,
    casualties,
    description: selectedType.description,
  };
}

// =============================================
// WAR ESCALATION LOGIC
// =============================================

interface EscalationFactors {
  tensionLevel: number;           // 0-100 current tension
  recentIncidents: number;        // Number of incidents recently
  militaryAdvantage: number;      // Our military vs theirs (ratio)
  rulerAggression: number;        // Ruler's aggressive tendencies
  generalAggression: number;      // Most aggressive general's tendencies
  populationAnger: number;        // Public demand for action
  resourceDesperation: number;    // How desperate for resources
  hasAlliesAtWar: boolean;        // Are our allies already at war with them
  religiousDifference: boolean;   // Different religions
  historicalGrievances: number;   // Rivalry intensity
  recentlyAttacked: boolean;      // Were we attacked recently
}

/**
 * Calculate the probability that tensions escalate to war
 */
function calculateEscalationProbability(factors: EscalationFactors): number {
  let probability = 0;

  // Base tension contribution (high tension = more likely)
  probability += (factors.tensionLevel / 100) * 0.2;

  // Recent incidents stack up anger
  probability += Math.min(0.2, factors.recentIncidents * 0.05);

  // Military advantage encourages aggression
  if (factors.militaryAdvantage > 1.3) {
    probability += (factors.militaryAdvantage - 1) * 0.15;
  }

  // Ruler personality
  if (factors.rulerAggression > 60) {
    probability += (factors.rulerAggression - 60) / 100 * 0.15;
  }

  // Hot-headed generals can push for war
  if (factors.generalAggression > 70) {
    probability += (factors.generalAggression - 70) / 100 * 0.1;
  }

  // Public anger demands action
  probability += (factors.populationAnger / 100) * 0.1;

  // Resource desperation (starving people will fight)
  if (factors.resourceDesperation > 50) {
    probability += (factors.resourceDesperation - 50) / 100 * 0.2;
  }

  // Alliance obligations
  if (factors.hasAlliesAtWar) {
    probability += 0.15;
  }

  // Religious conflicts
  if (factors.religiousDifference && factors.tensionLevel > 30) {
    probability += 0.1;
  }

  // Historical grievances
  probability += (factors.historicalGrievances / 100) * 0.15;

  // Retaliation for recent attack
  if (factors.recentlyAttacked) {
    probability += 0.25;
  }

  return Math.min(0.8, Math.max(0, probability)); // Cap at 80%
}

/**
 * Determine the casus belli based on circumstances
 */
function determineCasusBelli(factors: EscalationFactors, incident?: BorderIncident): CasusBelli {
  // Priority order based on circumstances

  if (factors.recentlyAttacked) {
    return "revenge";
  }

  if (factors.hasAlliesAtWar) {
    return "alliance_obligation";
  }

  if (factors.resourceDesperation > 70) {
    return "resource_desperation";
  }

  if (incident) {
    if (incident.type === "religious_clash") {
      return "religious_conflict";
    }
    if (incident.type === "refugee_conflict") {
      return "refugee_crisis";
    }
    if (incident.severity === "severe") {
      return "border_incident";
    }
  }

  if (factors.generalAggression > 80 && factors.rulerAggression < 50) {
    return "hot_headed_general";
  }

  if (factors.religiousDifference && factors.tensionLevel > 50) {
    return "religious_conflict";
  }

  if (factors.historicalGrievances > 60) {
    return "territorial_claim";
  }

  if (factors.populationAnger > 70) {
    return "insult_to_honor";
  }

  return "border_incident";
}

// =============================================
// MAIN WAR EMERGENCE PROCESSING
// =============================================

export interface WarEmergenceResult {
  warDeclared: boolean;
  targetTerritoryId?: Id<"territories">;
  casusBelli?: CasusBelli;
  description?: string;
  incident?: BorderIncident;
}

/**
 * Process organic war emergence for a territory
 * Called during tick processing
 */
export async function processWarEmergence(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  tick: number
): Promise<WarEmergenceResult> {
  const territory = await ctx.db.get(territoryId);
  if (!territory) {
    return { warDeclared: false };
  }

  // Get all relationships
  const allRelationships = await ctx.db.query("relationships").collect();
  const relationships = allRelationships.filter(
    (r) => r.territory1Id === territoryId || r.territory2Id === territoryId
  );

  // Skip if already at war with everyone hostile
  const hostileRelations = relationships.filter(
    r => r.status === "hostile" || r.status === "tense"
  );

  if (hostileRelations.length === 0) {
    return { warDeclared: false }; // No tensions to escalate
  }

  // Get ruler and generals
  const characters = await ctx.db
    .query("characters")
    .withIndex("by_territory", (q: any) => q.eq("territoryId", territoryId))
    .filter((q: any) => q.eq(q.field("isAlive"), true))
    .collect();

  const ruler = characters.find(c => c.role === "ruler");
  const generals = characters.filter(c => c.role === "general");

  // Get our religion
  const ourReligion = await ctx.db
    .query("religions")
    .withIndex("by_territory", (q: any) => q.eq("foundingTerritoryId", territoryId))
    .first();

  // Get rivalries
  const rivalries = await ctx.db
    .query("rivalries")
    .filter((q: any) =>
      q.or(
        q.eq(q.field("territory1Id"), territoryId),
        q.eq(q.field("territory2Id"), territoryId)
      )
    )
    .collect();

  // Check each hostile relationship for potential escalation
  for (const rel of hostileRelations) {
    const otherTerritoryId = rel.territory1Id === territoryId
      ? rel.territory2Id
      : rel.territory1Id;

    const otherTerritory = await ctx.db.get(otherTerritoryId);
    if (!otherTerritory) continue;

    // Skip if already at war
    if (rel.status === "at_war") continue;

    // Check if other territory has different religion
    const theirReligion = await ctx.db
      .query("religions")
      .withIndex("by_territory", (q: any) => q.eq("foundingTerritoryId", otherTerritoryId))
      .first();

    const hasDifferentReligion = ourReligion && theirReligion &&
      ourReligion._id !== theirReligion._id;

    // Check for refugees (simplified - low happiness + nearby conflict)
    const hasRefugees = territory.happiness < 40 || otherTerritory.happiness < 40;

    // Calculate tension level from trust
    const tensionLevel = rel.trust < 0 ? Math.abs(rel.trust) : 0;

    // Generate potential border incident
    const incident = generateBorderIncident(
      tensionLevel,
      hasDifferentReligion || false,
      hasRefugees
    );

    // If incident occurred, record it and potentially escalate
    if (incident) {
      // Record the incident in events
      await ctx.db.insert("events", {
        tick,
        type: incident.severity === "severe" ? "death" : "decision",
        territoryId,
        title: `Border Incident with ${otherTerritory.name}`,
        description: `${incident.description}. ${incident.casualties} casualties reported. Severity: ${incident.severity}.`,
        severity: incident.severity === "severe" ? "critical" :
                 incident.severity === "serious" ? "warning" : "info",
        createdAt: Date.now(),
      });

      // Update trust based on incident
      const trustPenalty = { minor: 3, moderate: 7, serious: 15, severe: 25 };
      const newTrust = Math.max(-100, rel.trust - trustPenalty[incident.severity]);

      await ctx.db.patch(rel._id, {
        trust: newTrust,
        status: incident.severity === "severe" ? "hostile" : rel.status,
      });

      // Track incident for escalation (using relationship metadata)
      const currentIncidents = (rel as any).recentIncidents || 0;
      await ctx.db.patch(rel._id, {
        recentIncidents: currentIncidents + 1,
        lastIncidentTick: tick,
      } as any);
    }

    // Build escalation factors
    const rivalry = rivalries.find(
      r => r.territory1Id === otherTerritoryId || r.territory2Id === otherTerritoryId
    );

    const mostAggressiveGeneral = generals.reduce(
      (max, g) => (g.traits.aggression || 50) > max ? (g.traits.aggression || 50) : max,
      0
    );

    // Check if we were recently attacked by them
    const recentlyAttacked = (rel as any).lastAttackedBy === otherTerritoryId &&
      ((rel as any).lastAttackedTick || 0) > tick - 12;

    // Check if our allies are at war with them
    const alliedRelations = relationships.filter(r => r.hasAlliance);
    let alliesAtWar = false;
    for (const allyRel of alliedRelations) {
      const allyId = allyRel.territory1Id === territoryId
        ? allyRel.territory2Id
        : allyRel.territory1Id;

      // Check if ally is at war with this enemy
      const allyEnemyRel = allRelationships.find(
        r => (r.territory1Id === allyId && r.territory2Id === otherTerritoryId) ||
             (r.territory2Id === allyId && r.territory1Id === otherTerritoryId)
      );

      if (allyEnemyRel && allyEnemyRel.status === "at_war") {
        alliesAtWar = true;
        break;
      }
    }

    // Calculate resource desperation
    const resourceDesperation = territory.food < 20 ? 80 :
                                territory.food < 40 ? 50 :
                                territory.food < 60 ? 20 : 0;

    // Calculate population anger (based on happiness and recent incidents)
    const populationAnger = Math.max(0, 50 - territory.happiness) +
      ((rel as any).recentIncidents || 0) * 10;

    const factors: EscalationFactors = {
      tensionLevel,
      recentIncidents: (rel as any).recentIncidents || 0,
      militaryAdvantage: territory.military / Math.max(1, otherTerritory.military),
      rulerAggression: ruler?.traits.aggression || 50,
      generalAggression: mostAggressiveGeneral,
      populationAnger: Math.min(100, populationAnger),
      resourceDesperation,
      hasAlliesAtWar: alliesAtWar,
      religiousDifference: hasDifferentReligion || false,
      historicalGrievances: rivalry?.intensity || 0,
      recentlyAttacked,
    };

    // Calculate escalation probability
    const escalationProb = calculateEscalationProbability(factors);

    // Check if war breaks out
    if (Math.random() < escalationProb) {
      const casusBelli = determineCasusBelli(factors, incident || undefined);
      const description = CASUS_BELLI_DESCRIPTIONS[casusBelli];

      // Declare war!
      await ctx.db.patch(rel._id, {
        status: "at_war",
        trust: -100,
        hasTradeAgreement: false,
        hasAlliance: false,
        warStartTick: tick,
        warCasusBelli: casusBelli,
        recentIncidents: 0, // Reset
      } as any);

      // Record memories for both sides
      const agent = await ctx.db
        .query("agents")
        .withIndex("by_territory", (q: any) => q.eq("territoryId", territoryId))
        .first();

      if (agent) {
        await recordMemory(ctx, agent._id, {
          type: "betrayal", // War is traumatic
          description: `War with ${otherTerritory.name}! ${description}`,
          emotionalWeight: -60,
          targetTerritoryId: otherTerritoryId,
        });
      }

      const otherAgent = await ctx.db
        .query("agents")
        .withIndex("by_territory", (q: any) => q.eq("territoryId", otherTerritoryId))
        .first();

      if (otherAgent) {
        await recordMemory(ctx, otherAgent._id, {
          type: "betrayal",
          description: `${territory.name} has declared war on us! ${description}`,
          emotionalWeight: -70,
          targetTerritoryId: territoryId,
        });
      }

      // Create war event
      await ctx.db.insert("events", {
        tick,
        type: "death",
        territoryId,
        title: `WAR DECLARED: ${territory.name} vs ${otherTerritory.name}`,
        description: `${description}. The drums of war sound across the land.`,
        severity: "critical",
        createdAt: Date.now(),
      });

      // If we have allies, they may be called to war
      await processAllianceObligations(ctx, territoryId, otherTerritoryId, tick);

      return {
        warDeclared: true,
        targetTerritoryId: otherTerritoryId,
        casusBelli,
        description,
        incident: incident || undefined,
      };
    }
  }

  return { warDeclared: false };
}

/**
 * Process alliance obligations - allies may join the war
 */
async function processAllianceObligations(
  ctx: MutationCtx,
  warStarterTerritoryId: Id<"territories">,
  enemyTerritoryId: Id<"territories">,
  tick: number
): Promise<void> {
  const warStarter = await ctx.db.get(warStarterTerritoryId);
  const enemy = await ctx.db.get(enemyTerritoryId);
  if (!warStarter || !enemy) return;

  // Get all relationships
  const allRelationships = await ctx.db.query("relationships").collect();

  // Find allies of the war starter
  const warStarterAllies = allRelationships.filter(
    r => (r.territory1Id === warStarterTerritoryId || r.territory2Id === warStarterTerritoryId) &&
         r.hasAlliance
  );

  for (const allyRel of warStarterAllies) {
    const allyId = allyRel.territory1Id === warStarterTerritoryId
      ? allyRel.territory2Id
      : allyRel.territory1Id;

    // Skip if ally is the enemy
    if (allyId === enemyTerritoryId) continue;

    const ally = await ctx.db.get(allyId);
    if (!ally) continue;

    // Find ally's relationship with the enemy
    const allyEnemyRel = allRelationships.find(
      r => (r.territory1Id === allyId && r.territory2Id === enemyTerritoryId) ||
           (r.territory2Id === allyId && r.territory1Id === enemyTerritoryId)
    );

    if (!allyEnemyRel) continue;

    // Already at war?
    if (allyEnemyRel.status === "at_war") continue;

    // Calculate chance ally honors alliance (based on relationship strength and ally's personality)
    const allyRuler = await ctx.db
      .query("characters")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", allyId))
      .filter((q: any) => q.and(
        q.eq(q.field("isAlive"), true),
        q.eq(q.field("role"), "ruler")
      ))
      .first();

    let honorChance = 0.5; // Base 50% chance to honor alliance

    // Loyalty affects honor
    if (allyRuler) {
      honorChance += (allyRuler.traits.loyalty - 50) / 100 * 0.3;
    }

    // Strong alliance more likely to be honored
    honorChance += (allyRel.trust / 100) * 0.2;

    // Already hostile to enemy? More likely to join
    if (allyEnemyRel.trust < -30) {
      honorChance += 0.2;
    }

    if (Math.random() < honorChance) {
      // Ally joins the war!
      await ctx.db.patch(allyEnemyRel._id, {
        status: "at_war",
        trust: -80,
        hasTradeAgreement: false,
        warStartTick: tick,
        warCasusBelli: "alliance_obligation",
      } as any);

      // Record event
      await ctx.db.insert("events", {
        tick,
        type: "decision",
        territoryId: allyId,
        title: `${ally.name} Honors Alliance`,
        description: `${ally.name} has joined the war against ${enemy.name} to honor their alliance with ${warStarter.name}.`,
        severity: "critical",
        createdAt: Date.now(),
      });

      // Record memory
      const allyAgent = await ctx.db
        .query("agents")
        .withIndex("by_territory", (q: any) => q.eq("territoryId", allyId))
        .first();

      if (allyAgent) {
        await recordMemory(ctx, allyAgent._id, {
          type: "betrayal",
          description: `We honored our alliance with ${warStarter.name} and declared war on ${enemy.name}.`,
          emotionalWeight: -40,
          targetTerritoryId: enemyTerritoryId,
        });
      }
    } else {
      // Ally refuses - damages alliance
      await ctx.db.patch(allyRel._id, {
        trust: allyRel.trust - 20,
        hasAlliance: false, // Alliance broken due to dishonor
      });

      await ctx.db.insert("events", {
        tick,
        type: "decision",
        territoryId: allyId,
        title: `${ally.name} Refuses to Honor Alliance`,
        description: `${ally.name} has refused to join ${warStarter.name} in their war against ${enemy.name}. The alliance is broken.`,
        severity: "warning",
        createdAt: Date.now(),
      });
    }
  }
}

/**
 * Process automatic retaliation when attacked
 * Call this when a raid or attack happens
 */
export async function processRetaliation(
  ctx: MutationCtx,
  attackerTerritoryId: Id<"territories">,
  defenderTerritoryId: Id<"territories">,
  tick: number
): Promise<{ retaliated: boolean; declaredWar: boolean }> {
  const attacker = await ctx.db.get(attackerTerritoryId);
  const defender = await ctx.db.get(defenderTerritoryId);
  if (!attacker || !defender) {
    return { retaliated: false, declaredWar: false };
  }

  // Get relationship
  const relationship = await ctx.db
    .query("relationships")
    .filter((q: any) =>
      q.or(
        q.and(
          q.eq(q.field("territory1Id"), attackerTerritoryId),
          q.eq(q.field("territory2Id"), defenderTerritoryId)
        ),
        q.and(
          q.eq(q.field("territory1Id"), defenderTerritoryId),
          q.eq(q.field("territory2Id"), attackerTerritoryId)
        )
      )
    )
    .first();

  if (!relationship) {
    return { retaliated: false, declaredWar: false };
  }

  // Mark that we were attacked
  await ctx.db.patch(relationship._id, {
    lastAttackedBy: attackerTerritoryId,
    lastAttackedTick: tick,
  } as any);

  // Get defender's ruler
  const defenderRuler = await ctx.db
    .query("characters")
    .withIndex("by_territory", (q: any) => q.eq("territoryId", defenderTerritoryId))
    .filter((q: any) => q.and(
      q.eq(q.field("isAlive"), true),
      q.eq(q.field("role"), "ruler")
    ))
    .first();

  // Calculate retaliation chance
  let retaliationChance = 0.3; // Base 30%

  // Aggressive rulers more likely to retaliate immediately
  if (defenderRuler && defenderRuler.traits.aggression > 60) {
    retaliationChance += (defenderRuler.traits.aggression - 60) / 100 * 0.4;
  }

  // Military advantage encourages retaliation
  const militaryRatio = defender.military / Math.max(1, attacker.military);
  if (militaryRatio > 1.2) {
    retaliationChance += 0.2;
  }

  // High honor cultures retaliate more
  if (defender.happiness > 50) {
    retaliationChance += 0.1;
  }

  // Already hostile? More likely to escalate to war
  if (relationship.status === "hostile") {
    retaliationChance += 0.2;
  }

  if (Math.random() < retaliationChance && relationship.status !== "at_war") {
    // Declare war in retaliation
    await ctx.db.patch(relationship._id, {
      status: "at_war",
      trust: -100,
      hasTradeAgreement: false,
      hasAlliance: false,
      warStartTick: tick,
      warCasusBelli: "revenge",
    } as any);

    await ctx.db.insert("events", {
      tick,
      type: "death",
      territoryId: defenderTerritoryId,
      title: `${defender.name} Retaliates - WAR!`,
      description: `In response to the attack by ${attacker.name}, ${defender.name} has declared war. They will have their revenge.`,
      severity: "critical",
      createdAt: Date.now(),
    });

    // Record memory
    const defenderAgent = await ctx.db
      .query("agents")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", defenderTerritoryId))
      .first();

    if (defenderAgent) {
      await recordMemory(ctx, defenderAgent._id, {
        type: "betrayal",
        description: `${attacker.name} attacked us! We have declared war in retaliation.`,
        emotionalWeight: -70,
        targetTerritoryId: attackerTerritoryId,
      });
    }

    // Process alliance obligations
    await processAllianceObligations(ctx, defenderTerritoryId, attackerTerritoryId, tick);

    return { retaliated: true, declaredWar: true };
  }

  return { retaliated: false, declaredWar: false };
}

/**
 * Check if spy discovery should trigger war
 */
export async function processSpyWarTrigger(
  ctx: MutationCtx,
  spyOwnerTerritoryId: Id<"territories">,
  targetTerritoryId: Id<"territories">,
  spyMission: string,
  tick: number
): Promise<{ warDeclared: boolean }> {
  // Only severe missions (assassination, sabotage) can trigger war
  const severeMissions = ["assassinate", "sabotage", "incite_rebellion"];
  if (!severeMissions.includes(spyMission)) {
    return { warDeclared: false };
  }

  const spyOwner = await ctx.db.get(spyOwnerTerritoryId);
  const target = await ctx.db.get(targetTerritoryId);
  if (!spyOwner || !target) {
    return { warDeclared: false };
  }

  // Get relationship
  const relationship = await ctx.db
    .query("relationships")
    .filter((q: any) =>
      q.or(
        q.and(
          q.eq(q.field("territory1Id"), spyOwnerTerritoryId),
          q.eq(q.field("territory2Id"), targetTerritoryId)
        ),
        q.and(
          q.eq(q.field("territory1Id"), targetTerritoryId),
          q.eq(q.field("territory2Id"), spyOwnerTerritoryId)
        )
      )
    )
    .first();

  if (!relationship || relationship.status === "at_war") {
    return { warDeclared: false };
  }

  // 40% chance discovering a severe spy mission triggers war
  if (Math.random() < 0.4) {
    await ctx.db.patch(relationship._id, {
      status: "at_war",
      trust: -100,
      hasTradeAgreement: false,
      hasAlliance: false,
      warStartTick: tick,
      warCasusBelli: "spy_discovered",
    } as any);

    await ctx.db.insert("events", {
      tick,
      type: "death",
      territoryId: targetTerritoryId,
      title: `Spy Discovery Triggers War!`,
      description: `${target.name} discovered a ${spyOwner.name} spy attempting ${spyMission}. This act of aggression has led to war.`,
      severity: "critical",
      createdAt: Date.now(),
    });

    return { warDeclared: true };
  }

  return { warDeclared: false };
}
