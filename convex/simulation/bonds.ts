import { MutationCtx, QueryCtx } from "../_generated/server";
import { Id, Doc } from "../_generated/dataModel";

// =============================================
// ORGANIC AI GROWTH - GRUDGES & GRATITUDE SYSTEM
// =============================================
// Persistent emotional bonds between civilizations - vendettas, debts of honor, and generational feuds.

// Bond type definitions
export type BondType =
  // Negative bonds (grudges)
  | "blood_debt"      // They killed our people
  | "betrayal_grudge" // They betrayed an alliance
  | "theft_grudge"    // They stole/raided from us
  | "insult_grudge"   // Unresolved insult
  | "conquest_grudge" // They conquered our lands
  // Positive bonds (gratitude)
  | "savior_debt"     // They saved us in crisis
  | "gift_gratitude"  // They gave generous gifts
  | "alliance_bond"   // Long faithful alliance
  | "trade_bond"      // Prosperous trade history
  | "honor_respect";  // They showed honor in war

// Bond status
export type BondStatus = "active" | "dormant" | "resolved" | "forgotten";

// Constants for bond behavior
const GENERATIONAL_DECAY = 15;     // Intensity lost per ruler change
const TICK_DECAY = 0.1;            // Natural decay per tick
const DORMANT_THRESHOLD = 20;      // Below this, bond becomes dormant
const FORGOTTEN_THRESHOLD = 5;     // Below this, bond is forgotten
const REINFORCEMENT_BOOST = 20;    // Boost when bond is reinforced

// Bond creation thresholds
const BOND_CREATION_THRESHOLD = 50; // Memory emotional weight needed to create bond

/**
 * Create a bond from a significant memory
 */
export async function createBondFromMemory(
  ctx: MutationCtx,
  memory: Doc<"agentMemories">,
  isHereditary: boolean = true
): Promise<Id<"civilizationBonds"> | null> {
  if (!memory.targetTerritoryId) return null;

  // Determine bond type based on memory type
  const bondTypeMap: Record<string, BondType> = {
    "war": memory.emotionalWeight < 0 ? "blood_debt" : "honor_respect",
    "betrayal": "betrayal_grudge",
    "alliance": memory.emotionalWeight > 0 ? "alliance_bond" : "betrayal_grudge",
    "trade": memory.emotionalWeight > 0 ? "trade_bond" : "theft_grudge",
    "crisis": memory.emotionalWeight < 0 ? "blood_debt" : "savior_debt",
    "victory": "honor_respect",
    "defeat": "blood_debt",
    "gift": "gift_gratitude",
    "insult": "insult_grudge",
    "help": "savior_debt",
    "conquest": "conquest_grudge",
  };

  const bondType = bondTypeMap[memory.memoryType];
  if (!bondType) return null;

  // Check if a similar bond already exists
  const existingBond = await ctx.db
    .query("civilizationBonds")
    .withIndex("by_from", (q) => q.eq("fromTerritoryId", memory.territoryId))
    .filter((q) => q.and(
      q.eq(q.field("toTerritoryId"), memory.targetTerritoryId),
      q.eq(q.field("bondType"), bondType),
      q.neq(q.field("status"), "forgotten")
    ))
    .first();

  if (existingBond) {
    // Reinforce existing bond instead
    await reinforceBond(ctx, existingBond._id, Math.abs(memory.emotionalWeight) / 2);
    return existingBond._id;
  }

  const world = await ctx.db.query("world").first();
  const currentTick = world?.tick || 0;

  // Create new bond
  const bondId = await ctx.db.insert("civilizationBonds", {
    fromTerritoryId: memory.territoryId,
    toTerritoryId: memory.targetTerritoryId,
    bondType,
    intensity: Math.abs(memory.emotionalWeight),
    originTick: memory.tick,
    originDescription: memory.description,
    originMemoryId: memory._id,
    isHereditary,
    generationsPassed: 0,
    status: "active",
    resolutionAttempts: [],
    lastReinforcedTick: currentTick,
  });

  return bondId;
}

/**
 * Create a bond directly (without memory)
 */
export async function createBond(
  ctx: MutationCtx,
  fromTerritoryId: Id<"territories">,
  toTerritoryId: Id<"territories">,
  bondType: BondType,
  intensity: number,
  description: string,
  isHereditary: boolean = true
): Promise<Id<"civilizationBonds">> {
  const world = await ctx.db.query("world").first();
  const currentTick = world?.tick || 0;

  const bondId = await ctx.db.insert("civilizationBonds", {
    fromTerritoryId,
    toTerritoryId,
    bondType,
    intensity: Math.max(-100, Math.min(100, intensity)),
    originTick: currentTick,
    originDescription: description,
    isHereditary,
    generationsPassed: 0,
    status: "active",
    resolutionAttempts: [],
    lastReinforcedTick: currentTick,
  });

  return bondId;
}

/**
 * Get all active bonds for a territory
 */
export async function getBonds(
  ctx: QueryCtx,
  territoryId: Id<"territories">,
  targetTerritoryId?: Id<"territories">
): Promise<Doc<"civilizationBonds">[]> {
  let bonds = await ctx.db
    .query("civilizationBonds")
    .withIndex("by_from", (q) => q.eq("fromTerritoryId", territoryId))
    .filter((q) => q.eq(q.field("status"), "active"))
    .collect();

  if (targetTerritoryId) {
    bonds = bonds.filter(b => b.toTerritoryId === targetTerritoryId);
  }

  return bonds;
}

/**
 * Get all bonds involving a territory (both directions)
 */
export async function getAllBondsForTerritory(
  ctx: QueryCtx,
  territoryId: Id<"territories">
): Promise<Doc<"civilizationBonds">[]> {
  const bondsFrom = await ctx.db
    .query("civilizationBonds")
    .withIndex("by_from", (q) => q.eq("fromTerritoryId", territoryId))
    .filter((q) => q.neq(q.field("status"), "forgotten"))
    .collect();

  const bondsTo = await ctx.db
    .query("civilizationBonds")
    .withIndex("by_to", (q) => q.eq("toTerritoryId", territoryId))
    .filter((q) => q.neq(q.field("status"), "forgotten"))
    .collect();

  return [...bondsFrom, ...bondsTo];
}

/**
 * Calculate net relationship modifier from bonds
 * Positive values favor cooperation, negative values favor hostility
 */
export function calculateBondModifier(bonds: Doc<"civilizationBonds">[]): number {
  if (bonds.length === 0) return 0;

  let totalModifier = 0;

  for (const bond of bonds) {
    // Determine if bond is positive or negative
    const isPositive = ["savior_debt", "gift_gratitude", "alliance_bond", "trade_bond", "honor_respect"].includes(bond.bondType);
    const modifier = isPositive ? bond.intensity : -bond.intensity;
    totalModifier += modifier;
  }

  // Normalize to -100 to +100 range
  return Math.max(-100, Math.min(100, totalModifier));
}

/**
 * Decay/strengthen bonds over time
 */
export async function processBonds(
  ctx: MutationCtx,
  currentTick: number
): Promise<void> {
  const allBonds = await ctx.db
    .query("civilizationBonds")
    .withIndex("by_status", (q) => q.eq("status", "active"))
    .collect();

  for (const bond of allBonds) {
    // Natural decay
    const ticksSinceReinforced = currentTick - bond.lastReinforcedTick;
    const decay = ticksSinceReinforced * TICK_DECAY;
    const newIntensity = Math.max(0, bond.intensity - decay);

    // Update status based on intensity
    let newStatus: BondStatus = bond.status;
    if (newIntensity < FORGOTTEN_THRESHOLD) {
      newStatus = "forgotten";
    } else if (newIntensity < DORMANT_THRESHOLD) {
      newStatus = "dormant";
    }

    // Only update if changed
    if (newIntensity !== bond.intensity || newStatus !== bond.status) {
      await ctx.db.patch(bond._id, {
        intensity: newIntensity,
        status: newStatus,
      });
    }
  }
}

/**
 * Reinforce a bond (called when relevant events occur)
 */
export async function reinforceBond(
  ctx: MutationCtx,
  bondId: Id<"civilizationBonds">,
  amount: number = REINFORCEMENT_BOOST
): Promise<void> {
  const bond = await ctx.db.get(bondId);
  if (!bond) return;

  const world = await ctx.db.query("world").first();
  const currentTick = world?.tick || 0;

  // Reactivate if dormant
  const newStatus: BondStatus = bond.status === "dormant" ? "active" : bond.status;

  await ctx.db.patch(bondId, {
    intensity: Math.min(100, bond.intensity + amount),
    lastReinforcedTick: currentTick,
    status: newStatus,
  });
}

/**
 * Attempt to resolve a grudge
 */
export async function attemptResolution(
  ctx: MutationCtx,
  bondId: Id<"civilizationBonds">,
  attempt: string
): Promise<{ success: boolean; newIntensity: number }> {
  const bond = await ctx.db.get(bondId);
  if (!bond) return { success: false, newIntensity: 0 };

  const world = await ctx.db.query("world").first();
  const currentTick = world?.tick || 0;

  // Record the attempt
  const attempts = bond.resolutionAttempts || [];
  const outcome = bond.intensity > 50 ? "Rejected - grudge too deep" : "Partially successful";

  attempts.push({
    tick: currentTick,
    attempt,
    outcome,
  });

  // Reduce intensity based on attempt (more effective for lower intensity)
  const reduction = bond.intensity > 50 ? 10 : 25;
  const newIntensity = Math.max(0, bond.intensity - reduction);

  const newStatus: BondStatus = newIntensity < FORGOTTEN_THRESHOLD ? "resolved" : bond.status;

  await ctx.db.patch(bondId, {
    intensity: newIntensity,
    resolutionAttempts: attempts,
    status: newStatus,
  });

  return { success: newIntensity < DORMANT_THRESHOLD, newIntensity };
}

/**
 * Pass hereditary bonds to new ruler
 */
export async function inheritBonds(
  ctx: MutationCtx,
  territoryId: Id<"territories">
): Promise<void> {
  const bonds = await ctx.db
    .query("civilizationBonds")
    .withIndex("by_from", (q) => q.eq("fromTerritoryId", territoryId))
    .filter((q) => q.and(
      q.eq(q.field("isHereditary"), true),
      q.neq(q.field("status"), "forgotten")
    ))
    .collect();

  for (const bond of bonds) {
    // Hereditary bonds lose intensity each generation
    const newIntensity = Math.max(0, bond.intensity - GENERATIONAL_DECAY);
    const newGenerations = bond.generationsPassed + 1;

    // Check if bond should be forgotten
    let newStatus: BondStatus = bond.status;
    if (newIntensity < FORGOTTEN_THRESHOLD) {
      newStatus = "forgotten";
    } else if (newIntensity < DORMANT_THRESHOLD) {
      newStatus = "dormant";
    }

    await ctx.db.patch(bond._id, {
      intensity: newIntensity,
      generationsPassed: newGenerations,
      status: newStatus,
    });
  }
}

/**
 * Format bonds for inclusion in AI prompts
 */
export async function formatBondsForPrompt(
  ctx: QueryCtx,
  territoryId: Id<"territories">,
  currentTick: number
): Promise<{ grudges: string; gratitude: string }> {
  const bonds = await getAllBondsForTerritory(ctx, territoryId);

  const grudges: string[] = [];
  const gratitude: string[] = [];

  // Get territory names for display
  const territoryIds = new Set<Id<"territories">>();
  for (const bond of bonds) {
    territoryIds.add(bond.fromTerritoryId);
    territoryIds.add(bond.toTerritoryId);
  }

  const territories = await Promise.all(
    [...territoryIds].map(id => ctx.db.get(id))
  );
  const territoryNames = new Map(
    territories.filter(t => t !== null).map(t => [t!._id, t!.name])
  );

  for (const bond of bonds) {
    // Determine which territory is "the other"
    const isFrom = bond.fromTerritoryId === territoryId;
    const otherTerritoryId = isFrom ? bond.toTerritoryId : bond.fromTerritoryId;
    const otherName = territoryNames.get(otherTerritoryId) || "Unknown";

    // Calculate age
    const ticksAgo = currentTick - bond.originTick;
    const yearsAgo = Math.floor(ticksAgo / 12);
    const ageStr = yearsAgo > 0 ? `${yearsAgo} year${yearsAgo > 1 ? 's' : ''}` : "recent";

    // Format intensity
    let intensityDesc: string;
    if (bond.intensity >= 80) intensityDesc = "EXTREME";
    else if (bond.intensity >= 60) intensityDesc = "STRONG";
    else if (bond.intensity >= 40) intensityDesc = "MODERATE";
    else if (bond.intensity >= 20) intensityDesc = "WEAK";
    else intensityDesc = "FADING";

    const hereditaryNote = bond.isHereditary && bond.generationsPassed > 0
      ? ` [HEREDITARY - ${bond.generationsPassed} generation${bond.generationsPassed > 1 ? 's' : ''}]`
      : bond.isHereditary ? " [HEREDITARY]" : "";

    const bondTypeName = bond.bondType.replace(/_/g, " ").toUpperCase();
    const line = `- ${otherName}: ${bondTypeName} (${intensityDesc}) - ${bond.originDescription} (${ageStr})${hereditaryNote}`;

    // Categorize as grudge or gratitude
    const isPositiveBond = ["savior_debt", "gift_gratitude", "alliance_bond", "trade_bond", "honor_respect"].includes(bond.bondType);
    if (isPositiveBond) {
      gratitude.push(line);
    } else {
      grudges.push(line);
    }
  }

  return {
    grudges: grudges.length > 0 ? grudges.join("\n") : "No active grudges.",
    gratitude: gratitude.length > 0 ? gratitude.join("\n") : "No debts of gratitude.",
  };
}

/**
 * Check if memory should trigger bond creation
 */
export function shouldCreateBond(memory: Doc<"agentMemories">): boolean {
  return Math.abs(memory.emotionalWeight) >= BOND_CREATION_THRESHOLD && memory.targetTerritoryId !== undefined;
}

/**
 * Get bond intensity summary for a relationship
 */
export async function getBondSummary(
  ctx: QueryCtx,
  territoryId: Id<"territories">,
  targetTerritoryId: Id<"territories">
): Promise<{
  totalIntensity: number;
  grudgeCount: number;
  gratitudeCount: number;
  strongestBond: Doc<"civilizationBonds"> | null;
}> {
  const bonds = await getBonds(ctx, territoryId, targetTerritoryId);

  let grudgeCount = 0;
  let gratitudeCount = 0;
  let strongestBond: Doc<"civilizationBonds"> | null = null;
  let strongestIntensity = 0;

  for (const bond of bonds) {
    const isPositive = ["savior_debt", "gift_gratitude", "alliance_bond", "trade_bond", "honor_respect"].includes(bond.bondType);
    if (isPositive) {
      gratitudeCount++;
    } else {
      grudgeCount++;
    }

    if (bond.intensity > strongestIntensity) {
      strongestIntensity = bond.intensity;
      strongestBond = bond;
    }
  }

  return {
    totalIntensity: calculateBondModifier(bonds),
    grudgeCount,
    gratitudeCount,
    strongestBond,
  };
}
