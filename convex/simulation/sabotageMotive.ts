import { MutationCtx, QueryCtx } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";
import { SabotageType, SABOTAGE_CONFIG, executeSabotage } from "./sabotage";
import { recordMemory } from "./memory";

// =============================================
// ORGANIC SABOTAGE EMERGENCE SYSTEM
// =============================================
// Sabotage doesn't just happen randomly - it emerges from:
// 1. Desperation (famine, poverty, weakness)
// 2. Grudges and grievances (past wrongs, betrayals)
// 3. Rivalry and competition (competing for same resources)
// 4. Strategic necessity (preparing for war, weakening enemies)
// 5. Religious/ideological conflict
// 6. Opportunism (enemy is weak/distracted)
//
// The system calculates "sabotage pressure" and when high enough,
// civilizations will organically attempt sabotage operations.

// =============================================
// SABOTAGE MOTIVATIONS
// =============================================

export interface SabotageMotive {
  type: string;
  intensity: number;        // 0-100
  targetTerritoryId?: Id<"territories">;
  preferredSabotageTypes: SabotageType[];
  reason: string;
}

export interface SabotagePressure {
  totalPressure: number;    // 0-100, higher = more likely to sabotage
  motives: SabotageMotive[];
  likelyTargets: Array<{
    territoryId: Id<"territories">;
    territoryName: string;
    pressure: number;
    topMotive: string;
    suggestedSabotage: SabotageType[];
  }>;
}

// =============================================
// CALCULATE SABOTAGE PRESSURE
// =============================================

export async function calculateSabotagePressure(
  ctx: QueryCtx,
  territoryId: Id<"territories">
): Promise<SabotagePressure> {
  const territory = await ctx.db.get(territoryId);
  if (!territory) {
    return { totalPressure: 0, motives: [], likelyTargets: [] };
  }

  const motives: SabotageMotive[] = [];
  const targetPressures = new Map<string, { pressure: number; motives: SabotageMotive[] }>();

  // Get all other territories
  const allTerritories = await ctx.db.query("territories").collect();
  const otherTerritories = allTerritories.filter(t =>
    t._id !== territoryId && !(t as any).isEliminated
  );

  // Get relationships
  const relationships = await ctx.db
    .query("relationships")
    .filter((q: any) => q.or(
      q.eq(q.field("territory1Id"), territoryId),
      q.eq(q.field("territory2Id"), territoryId)
    ))
    .collect();

  // Get agent for personality
  const agent = await ctx.db
    .query("agents")
    .withIndex("by_territory", (q: any) => q.eq("territoryId", territoryId))
    .first();

  const personality = agent?.personalityParams || {};
  const baseCunning = (personality as any).cunning || 50;
  const baseAggression = (personality as any).aggression || 50;

  // Get memories for grudges
  const memories = agent ? await ctx.db
    .query("agentMemories")
    .withIndex("by_agent", (q: any) => q.eq("agentId", agent._id))
    .collect() : [];

  // =============================================
  // MOTIVE 1: DESPERATION (Resource Scarcity)
  // =============================================

  // Famine pressure - steal food
  if (territory.food < 20) {
    const intensity = Math.min(100, (20 - territory.food) * 5);
    motives.push({
      type: "famine_desperation",
      intensity,
      preferredSabotageTypes: ["poison_crops", "burn_granaries", "disrupt_caravans"],
      reason: "Our people starve while others feast",
    });

    // Target territories with high food
    for (const other of otherTerritories) {
      if (other.food > 50) {
        const targetId = other._id.toString();
        const existing = targetPressures.get(targetId) || { pressure: 0, motives: [] };
        existing.pressure += intensity * 0.5;
        existing.motives.push({
          type: "food_envy",
          intensity: intensity * 0.5,
          targetTerritoryId: other._id,
          preferredSabotageTypes: ["burn_granaries", "poison_crops", "introduce_pests"],
          reason: `${other.name} has abundant food while we starve`,
        });
        targetPressures.set(targetId, existing);
      }
    }
  }

  // Poverty pressure - economic sabotage
  if (territory.wealth < 15) {
    const intensity = Math.min(80, (15 - territory.wealth) * 4);
    motives.push({
      type: "poverty_desperation",
      intensity,
      preferredSabotageTypes: ["steal_trade_secrets", "disrupt_caravans", "bribe_merchants"],
      reason: "Our coffers are empty, we must take from others",
    });

    for (const other of otherTerritories) {
      if (other.wealth > 40) {
        const targetId = other._id.toString();
        const existing = targetPressures.get(targetId) || { pressure: 0, motives: [] };
        existing.pressure += intensity * 0.4;
        existing.motives.push({
          type: "wealth_envy",
          intensity: intensity * 0.4,
          targetTerritoryId: other._id,
          preferredSabotageTypes: ["steal_trade_secrets", "counterfeit_currency", "burn_market"],
          reason: `${other.name} grows rich while we suffer`,
        });
        targetPressures.set(targetId, existing);
      }
    }
  }

  // =============================================
  // MOTIVE 2: GRUDGES AND GRIEVANCES
  // =============================================

  // Check memories for betrayals and attacks
  const grudgeMemories = memories.filter(m =>
    m.type === "betrayal" || m.type === "defeat" || m.type === "loss"
  );

  for (const memory of grudgeMemories) {
    if (memory.targetTerritoryId) {
      const intensity = Math.min(80, Math.abs(memory.emotionalWeight) * 0.8);
      const targetId = memory.targetTerritoryId.toString();
      const existing = targetPressures.get(targetId) || { pressure: 0, motives: [] };

      const targetTerritory = otherTerritories.find(t => t._id === memory.targetTerritoryId);
      if (targetTerritory) {
        existing.pressure += intensity;
        existing.motives.push({
          type: "revenge_grudge",
          intensity,
          targetTerritoryId: memory.targetTerritoryId,
          preferredSabotageTypes: ["spread_terror", "assassinate_heir", "incite_rebellion", "spread_plague"],
          reason: `We remember their treachery: ${memory.description.substring(0, 50)}...`,
        });
        targetPressures.set(targetId, existing);
      }
    }
  }

  // Check relationship trust for enemies
  for (const rel of relationships) {
    const otherId = rel.territory1Id === territoryId ? rel.territory2Id : rel.territory1Id;
    const other = otherTerritories.find(t => t._id === otherId);
    if (!other) continue;

    // Low trust = sabotage motivation
    if (rel.trust < -30) {
      const intensity = Math.min(70, Math.abs(rel.trust) * 0.7);
      const targetId = otherId.toString();
      const existing = targetPressures.get(targetId) || { pressure: 0, motives: [] };
      existing.pressure += intensity;
      existing.motives.push({
        type: "enemy_hostility",
        intensity,
        targetTerritoryId: otherId,
        preferredSabotageTypes: ["sabotage_weapons", "poison_army_supplies", "incite_desertion"],
        reason: `${other.name} is our enemy (trust: ${rel.trust})`,
      });
      targetPressures.set(targetId, existing);
    }

    // At war = high sabotage motivation
    if (rel.status === "at_war") {
      const intensity = 80;
      const targetId = otherId.toString();
      const existing = targetPressures.get(targetId) || { pressure: 0, motives: [] };
      existing.pressure += intensity;
      existing.motives.push({
        type: "war_sabotage",
        intensity,
        targetTerritoryId: otherId,
        preferredSabotageTypes: [
          "poison_army_supplies", "sabotage_weapons", "assassinate_general",
          "spread_camp_disease", "sabotage_fortifications", "steal_battle_plans"
        ],
        reason: `We are at WAR with ${other.name}! Sabotage is warfare.`,
      });
      targetPressures.set(targetId, existing);
    }
  }

  // =============================================
  // MOTIVE 3: RIVALRY AND COMPETITION
  // =============================================

  // Check for rivalries
  const rivalries = await ctx.db
    .query("rivalries")
    .filter((q: any) => q.or(
      q.eq(q.field("territory1Id"), territoryId),
      q.eq(q.field("territory2Id"), territoryId)
    ))
    .filter((q: any) => q.eq(q.field("status"), "active"))
    .collect();

  for (const rivalry of rivalries) {
    const otherId = rivalry.territory1Id === territoryId ? rivalry.territory2Id : rivalry.territory1Id;
    const other = otherTerritories.find(t => t._id === otherId);
    if (!other) continue;

    const intensity = Math.min(60, rivalry.intensity * 0.6);
    const targetId = otherId.toString();
    const existing = targetPressures.get(targetId) || { pressure: 0, motives: [] };
    existing.pressure += intensity;
    existing.motives.push({
      type: "rivalry",
      intensity,
      targetTerritoryId: otherId,
      preferredSabotageTypes: ["spread_propaganda", "steal_trade_secrets", "bribe_advisors"],
      reason: `${other.name} is our rival - we must undermine them`,
    });
    targetPressures.set(targetId, existing);
  }

  // =============================================
  // MOTIVE 4: STRATEGIC NECESSITY (Pre-war)
  // =============================================

  // If we're weak militarily but have enemies, sabotage to weaken them
  if (territory.military < 30) {
    for (const rel of relationships) {
      if (rel.trust < 0) {
        const otherId = rel.territory1Id === territoryId ? rel.territory2Id : rel.territory1Id;
        const other = otherTerritories.find(t => t._id === otherId);
        if (!other || other.military <= territory.military) continue;

        const intensity = Math.min(50, (other.military - territory.military) * 0.5);
        const targetId = otherId.toString();
        const existing = targetPressures.get(targetId) || { pressure: 0, motives: [] };
        existing.pressure += intensity;
        existing.motives.push({
          type: "military_necessity",
          intensity,
          targetTerritoryId: otherId,
          preferredSabotageTypes: [
            "sabotage_weapons", "burn_armory", "incite_desertion",
            "assassinate_general", "disable_siege_equipment"
          ],
          reason: `${other.name} is stronger - we must weaken them before they attack`,
        });
        targetPressures.set(targetId, existing);
      }
    }
  }

  // =============================================
  // MOTIVE 5: RELIGIOUS/IDEOLOGICAL CONFLICT
  // =============================================

  // Check for different religions
  const ourReligion = await ctx.db
    .query("religions")
    .withIndex("by_territory", (q: any) => q.eq("foundingTerritoryId", territoryId))
    .first();

  if (ourReligion) {
    for (const other of otherTerritories) {
      const theirReligion = await ctx.db
        .query("religions")
        .withIndex("by_territory", (q: any) => q.eq("foundingTerritoryId", other._id))
        .first();

      if (theirReligion && theirReligion.name !== ourReligion.name) {
        // Different religion = potential religious sabotage
        const tolerance = ourReligion.tolerance || 50;
        if (tolerance < 40) {
          const intensity = Math.min(50, (40 - tolerance));
          const targetId = other._id.toString();
          const existing = targetPressures.get(targetId) || { pressure: 0, motives: [] };
          existing.pressure += intensity;
          existing.motives.push({
            type: "religious_conflict",
            intensity,
            targetTerritoryId: other._id,
            preferredSabotageTypes: [
              "desecrate_temple", "spread_heresy", "assassinate_priests",
              "corrupt_religious_texts", "support_rival_cult"
            ],
            reason: `${other.name} follows false gods - they must be shown the truth`,
          });
          targetPressures.set(targetId, existing);
        }
      }
    }
  }

  // =============================================
  // MOTIVE 6: OPPORTUNISM (Enemy is weak)
  // =============================================

  for (const other of otherTerritories) {
    // Check if they're weak/distracted
    const isWeak = other.military < 20 || other.happiness < 30 || other.population < 50;
    const rel = relationships.find(r =>
      r.territory1Id === other._id || r.territory2Id === other._id
    );

    if (isWeak && rel && rel.trust < 20) {
      const intensity = Math.min(40, baseAggression * 0.4);
      const targetId = other._id.toString();
      const existing = targetPressures.get(targetId) || { pressure: 0, motives: [] };
      existing.pressure += intensity;
      existing.motives.push({
        type: "opportunism",
        intensity,
        targetTerritoryId: other._id,
        preferredSabotageTypes: ["incite_rebellion", "kidnap_craftsmen", "encourage_emigration"],
        reason: `${other.name} is weak - an opportunity to strike`,
      });
      targetPressures.set(targetId, existing);
    }
  }

  // =============================================
  // COMPILE RESULTS
  // =============================================

  // Calculate total pressure
  let totalPressure = motives.reduce((sum, m) => sum + m.intensity, 0) / Math.max(1, motives.length);

  // Personality modifiers
  totalPressure *= (baseCunning / 50); // Cunning increases sabotage tendency

  // Build likely targets list
  const likelyTargets: SabotagePressure["likelyTargets"] = [];

  for (const [targetIdStr, data] of targetPressures) {
    const targetTerritory = otherTerritories.find(t => t._id.toString() === targetIdStr);
    if (!targetTerritory || data.pressure < 20) continue;

    // Get top motive
    const topMotive = data.motives.sort((a, b) => b.intensity - a.intensity)[0];

    // Compile suggested sabotage types
    const allSuggested = data.motives.flatMap(m => m.preferredSabotageTypes);
    const uniqueSuggested = [...new Set(allSuggested)].slice(0, 5);

    likelyTargets.push({
      territoryId: targetTerritory._id,
      territoryName: targetTerritory.name,
      pressure: Math.min(100, data.pressure),
      topMotive: topMotive.reason,
      suggestedSabotage: uniqueSuggested as SabotageType[],
    });
  }

  // Sort by pressure
  likelyTargets.sort((a, b) => b.pressure - a.pressure);

  return {
    totalPressure: Math.min(100, totalPressure),
    motives,
    likelyTargets: likelyTargets.slice(0, 5), // Top 5 targets
  };
}

// =============================================
// PROCESS ORGANIC SABOTAGE
// =============================================

export async function processOrganicSabotage(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  tick: number
): Promise<{
  attemptedSabotage: boolean;
  sabotageType?: string;
  targetName?: string;
  success?: boolean;
  detected?: boolean;
  message?: string;
}> {
  const pressure = await calculateSabotagePressure(ctx, territoryId);

  // Only attempt sabotage if pressure is high enough
  // Base threshold is 40, but random factor means sometimes lower pressure triggers
  const threshold = 40 - Math.random() * 20; // 20-40 threshold

  if (pressure.totalPressure < threshold || pressure.likelyTargets.length === 0) {
    return { attemptedSabotage: false };
  }

  // Check if we have the capability (spy network or covert ops)
  const territory = await ctx.db.get(territoryId);
  if (!territory) return { attemptedSabotage: false };

  const spyNetwork = territory.spyNetwork;
  const hasSpyCapability = (spyNetwork?.budget || 0) > 10;

  // Pick a target based on pressure
  const target = pressure.likelyTargets[0]; // Highest pressure target

  // Check if we have a spy in place
  const spiesInTarget = await ctx.db
    .query("spies")
    .withIndex("by_owner", (q: any) => q.eq("ownerTerritoryId", territoryId))
    .filter((q: any) => q.and(
      q.eq(q.field("targetTerritoryId"), target.territoryId),
      q.eq(q.field("status"), "active")
    ))
    .collect();

  const hasSpy = spiesInTarget.length > 0;

  // Filter sabotage types to those we can actually do
  const availableSabotage = target.suggestedSabotage.filter(sType => {
    const config = SABOTAGE_CONFIG[sType];
    if (!config) return false;
    if (config.requiresSpy && !hasSpy) return false;
    return true;
  });

  if (availableSabotage.length === 0) {
    // No sabotage options available
    return { attemptedSabotage: false };
  }

  // Random chance to actually attempt (based on pressure)
  const attemptChance = pressure.totalPressure / 100;
  if (Math.random() > attemptChance) {
    return { attemptedSabotage: false };
  }

  // Pick sabotage type - weight by config difficulty (prefer easier ones)
  const weightedSabotage = availableSabotage.map(sType => ({
    type: sType,
    weight: 100 - SABOTAGE_CONFIG[sType].baseDifficulty,
  }));

  const totalWeight = weightedSabotage.reduce((sum, s) => sum + s.weight, 0);
  let random = Math.random() * totalWeight;
  let selectedSabotage: SabotageType = availableSabotage[0];

  for (const s of weightedSabotage) {
    random -= s.weight;
    if (random <= 0) {
      selectedSabotage = s.type;
      break;
    }
  }

  // Execute the sabotage!
  const result = await executeSabotage(
    ctx,
    territoryId,
    target.territoryId,
    selectedSabotage,
    tick
  );

  // Record what happened
  const agent = await ctx.db
    .query("agents")
    .withIndex("by_territory", (q: any) => q.eq("territoryId", territoryId))
    .first();

  if (agent) {
    if (result.success) {
      await recordMemory(ctx, agent._id, {
        type: "victory",
        description: `Our covert operation (${selectedSabotage.replace(/_/g, " ")}) against ${target.territoryName} succeeded!`,
        emotionalWeight: 20,
        targetTerritoryId: target.territoryId,
      });
    } else if (result.detected) {
      await recordMemory(ctx, agent._id, {
        type: "crisis",
        description: `Our sabotage attempt against ${target.territoryName} was discovered! Relations damaged.`,
        emotionalWeight: -30,
        targetTerritoryId: target.territoryId,
      });
    }
  }

  // Create event
  await ctx.db.insert("events", {
    tick,
    type: result.success ? "decision" : "crisis",
    territoryId,
    targetTerritoryId: target.territoryId,
    title: result.success
      ? `Covert Operation Success`
      : `Covert Operation ${result.detected ? "Exposed" : "Failed"}`,
    description: `${selectedSabotage.replace(/_/g, " ")} against ${target.territoryName}: ${result.message}`,
    severity: result.detected ? "negative" : "info",
    createdAt: Date.now(),
  });

  return {
    attemptedSabotage: true,
    sabotageType: selectedSabotage,
    targetName: target.territoryName,
    success: result.success,
    detected: result.detected,
    message: result.message,
  };
}

// =============================================
// PROCESS RETALIATION
// =============================================

export async function processSabotageRetaliation(
  ctx: MutationCtx,
  victimTerritoryId: Id<"territories">,
  attackerTerritoryId: Id<"territories">,
  originalSabotageType: SabotageType,
  tick: number
): Promise<{
  retaliated: boolean;
  retaliationType?: string;
  escalatedToWar?: boolean;
}> {
  const victim = await ctx.db.get(victimTerritoryId);
  const attacker = await ctx.db.get(attackerTerritoryId);

  if (!victim || !attacker) return { retaliated: false };

  // Get victim's agent for personality
  const agent = await ctx.db
    .query("agents")
    .withIndex("by_territory", (q: any) => q.eq("territoryId", victimTerritoryId))
    .first();

  const personality = agent?.personalityParams || {};
  const aggression = (personality as any).aggression || 50;
  const wrath = (personality as any).wrath || 50;

  // Calculate retaliation chance based on:
  // - Aggression/wrath of victim
  // - Severity of sabotage
  // - Military strength comparison

  const sabotageConfig = SABOTAGE_CONFIG[originalSabotageType];
  const severity = sabotageConfig?.warRisk || 30;

  const retaliationChance = (aggression + wrath + severity) / 3;

  if (Math.random() * 100 > retaliationChance) {
    return { retaliated: false };
  }

  // Check if we have capability to retaliate
  const ourSpies = await ctx.db
    .query("spies")
    .withIndex("by_owner", (q: any) => q.eq("ownerTerritoryId", victimTerritoryId))
    .filter((q: any) => q.and(
      q.eq(q.field("targetTerritoryId"), attackerTerritoryId),
      q.eq(q.field("status"), "active")
    ))
    .collect();

  const hasSpy = ourSpies.length > 0;

  // Pick retaliation type - similar to what was done to us, or escalate
  const retaliationOptions: SabotageType[] = [];

  // Mirror sabotage
  if (!SABOTAGE_CONFIG[originalSabotageType].requiresSpy || hasSpy) {
    retaliationOptions.push(originalSabotageType);
  }

  // Add similar category sabotage
  const category = sabotageConfig?.category;
  for (const [sType, config] of Object.entries(SABOTAGE_CONFIG)) {
    if (config.category === category && (!config.requiresSpy || hasSpy)) {
      retaliationOptions.push(sType as SabotageType);
    }
  }

  if (retaliationOptions.length === 0) {
    // No retaliation options - just increase hostility
    return { retaliated: false };
  }

  // Pick random retaliation
  const retaliationType = retaliationOptions[Math.floor(Math.random() * retaliationOptions.length)];

  // Execute retaliation
  const result = await executeSabotage(
    ctx,
    victimTerritoryId,
    attackerTerritoryId,
    retaliationType,
    tick
  );

  // Record memory
  if (agent) {
    await recordMemory(ctx, agent._id, {
      type: "victory",
      description: `We retaliated against ${attacker.name} with ${retaliationType.replace(/_/g, " ")} for their attack on us!`,
      emotionalWeight: 15,
      targetTerritoryId: attackerTerritoryId,
    });
  }

  return {
    retaliated: true,
    retaliationType,
    escalatedToWar: result.warDeclared,
  };
}

// =============================================
// GET SABOTAGE CONTEXT FOR AI PROMPT
// =============================================

export async function getSabotageContext(
  ctx: QueryCtx,
  territoryId: Id<"territories">
): Promise<{
  pressure: number;
  topMotives: Array<{ reason: string; intensity: number }>;
  suggestedTargets: Array<{
    name: string;
    pressure: number;
    reason: string;
    suggestions: string[];
  }>;
}> {
  const pressure = await calculateSabotagePressure(ctx, territoryId);

  return {
    pressure: Math.round(pressure.totalPressure),
    topMotives: pressure.motives
      .sort((a, b) => b.intensity - a.intensity)
      .slice(0, 3)
      .map(m => ({ reason: m.reason, intensity: Math.round(m.intensity) })),
    suggestedTargets: pressure.likelyTargets.slice(0, 3).map(t => ({
      name: t.territoryName,
      pressure: Math.round(t.pressure),
      reason: t.topMotive,
      suggestions: t.suggestedSabotage.slice(0, 3),
    })),
  };
}
