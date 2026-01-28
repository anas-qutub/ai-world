import { Doc, Id } from "../_generated/dataModel";
import { MutationCtx } from "../_generated/server";
import { getInfrastructureTradeBonus } from "./infrastructureSystem";

// Base distances between continents (in ticks to travel)
const TERRITORY_DISTANCES: Record<string, Record<string, number>> = {
  "North America": {
    "Europe": 8,
    "Africa": 10,
    "Asia": 12,
    "South America": 5,
    "Australia": 15,
  },
  "Europe": {
    "North America": 8,
    "Africa": 4,
    "Asia": 6,
    "South America": 10,
    "Australia": 14,
  },
  "Africa": {
    "North America": 10,
    "Europe": 4,
    "Asia": 6,
    "South America": 8,
    "Australia": 12,
  },
  "Asia": {
    "North America": 12,
    "Europe": 6,
    "Africa": 6,
    "South America": 14,
    "Australia": 8,
  },
  "South America": {
    "North America": 5,
    "Europe": 10,
    "Africa": 8,
    "Asia": 14,
    "Australia": 16,
  },
  "Australia": {
    "North America": 15,
    "Europe": 14,
    "Africa": 12,
    "Asia": 8,
    "South America": 16,
  },
};

// Establish a new trade route between territories
export async function establishTradeRoute(
  ctx: MutationCtx,
  territory1Id: Id<"territories">,
  territory2Id: Id<"territories">,
  tick: number
): Promise<{ success: boolean; routeId?: Id<"tradeRoutes">; error?: string }> {
  // Check if route already exists
  const existingRoute = await ctx.db
    .query("tradeRoutes")
    .withIndex("by_territory1", (q) => q.eq("territory1Id", territory1Id))
    .filter((q) => q.eq(q.field("territory2Id"), territory2Id))
    .first();

  if (existingRoute) {
    if (existingRoute.isActive) {
      return { success: false, error: "Trade route already exists" };
    }
    // Reactivate existing route
    await ctx.db.patch(existingRoute._id, { isActive: true });
    return { success: true, routeId: existingRoute._id };
  }

  // Check reverse direction
  const reverseRoute = await ctx.db
    .query("tradeRoutes")
    .withIndex("by_territory1", (q) => q.eq("territory1Id", territory2Id))
    .filter((q) => q.eq(q.field("territory2Id"), territory1Id))
    .first();

  if (reverseRoute) {
    if (reverseRoute.isActive) {
      return { success: false, error: "Trade route already exists" };
    }
    await ctx.db.patch(reverseRoute._id, { isActive: true });
    return { success: true, routeId: reverseRoute._id };
  }

  // Get territory names for distance calculation
  const t1 = await ctx.db.get(territory1Id);
  const t2 = await ctx.db.get(territory2Id);
  if (!t1 || !t2) {
    return { success: false, error: "Territory not found" };
  }

  // Calculate distance
  const baseDistance = TERRITORY_DISTANCES[t1.name]?.[t2.name] || 10;

  // INTERCONNECTION: Infrastructure reduces travel time
  const infraBonus = await getInfrastructureTradeBonus(ctx, territory1Id, territory2Id);
  const distanceReduction = Math.floor(baseDistance * (infraBonus.travelTimeReduction / 100));
  const distance = Math.max(1, baseDistance - distanceReduction);

  // Calculate base risk (modified by distance and relationship)
  const relationship = await findRelationship(ctx, territory1Id, territory2Id);
  let baseRisk = 10 + baseDistance * 2;
  if (relationship?.status === "hostile" || relationship?.status === "at_war") {
    baseRisk += 50;
  } else if (relationship?.status === "tense") {
    baseRisk += 20;
  } else if (relationship?.status === "allied") {
    baseRisk -= 10;
  }

  // INTERCONNECTION: Infrastructure reduces trade route risk
  baseRisk = Math.max(0, baseRisk - infraBonus.riskReduction);

  const routeId = await ctx.db.insert("tradeRoutes", {
    territory1Id,
    territory2Id,
    distance,
    risk: Math.max(0, Math.min(100, baseRisk)),
    isActive: true,
    establishedAtTick: tick,
    totalTradeVolume: 0,
  });

  return { success: true, routeId };
}

// Helper to find relationship between territories
async function findRelationship(
  ctx: MutationCtx,
  t1Id: Id<"territories">,
  t2Id: Id<"territories">
): Promise<Doc<"relationships"> | null> {
  let rel = await ctx.db
    .query("relationships")
    .withIndex("by_territories", (q) => q.eq("territory1Id", t1Id).eq("territory2Id", t2Id))
    .first();

  if (!rel) {
    rel = await ctx.db
      .query("relationships")
      .withIndex("by_territories", (q) => q.eq("territory1Id", t2Id).eq("territory2Id", t1Id))
      .first();
  }

  return rel;
}

// Send a caravan with goods
export async function sendCaravan(
  ctx: MutationCtx,
  originId: Id<"territories">,
  destinationId: Id<"territories">,
  goods: Array<{ type: string; quantity: number; purchasePrice: number }>,
  guardStrength: number,
  tick: number
): Promise<{ success: boolean; caravanId?: Id<"caravans">; error?: string }> {
  // Check trade route exists and is active
  const route = await findTradeRoute(ctx, originId, destinationId);
  if (!route || !route.isActive) {
    return { success: false, error: "No active trade route to destination" };
  }

  // Verify origin territory has the goods
  const origin = await ctx.db.get(originId);
  if (!origin) {
    return { success: false, error: "Origin territory not found" };
  }

  // Calculate total goods value
  const totalValue = goods.reduce((sum, g) => sum + g.quantity * g.purchasePrice, 0);

  // Create the caravan
  const caravanId = await ctx.db.insert("caravans", {
    originId,
    destinationId,
    goods,
    departedTick: tick,
    arrivalTick: tick + route.distance,
    status: "traveling",
    guardStrength,
  });

  return { success: true, caravanId };
}

// Helper to find trade route
async function findTradeRoute(
  ctx: MutationCtx,
  t1Id: Id<"territories">,
  t2Id: Id<"territories">
): Promise<Doc<"tradeRoutes"> | null> {
  let route = await ctx.db
    .query("tradeRoutes")
    .withIndex("by_territory1", (q) => q.eq("territory1Id", t1Id))
    .filter((q) => q.eq(q.field("territory2Id"), t2Id))
    .first();

  if (!route) {
    route = await ctx.db
      .query("tradeRoutes")
      .withIndex("by_territory1", (q) => q.eq("territory1Id", t2Id))
      .filter((q) => q.eq(q.field("territory2Id"), t1Id))
      .first();
  }

  return route;
}

// Process all traveling caravans
export async function processCaravans(
  ctx: MutationCtx,
  tick: number
): Promise<{
  arrivals: Array<{ originName: string; destName: string; goods: any[] }>;
  raids: Array<{ originName: string; destName: string; raiderName?: string }>;
}> {
  const arrivals: Array<{ originName: string; destName: string; goods: any[] }> = [];
  const raids: Array<{ originName: string; destName: string; raiderName?: string }> = [];

  // Get all traveling caravans
  const caravans = await ctx.db
    .query("caravans")
    .withIndex("by_status", (q) => q.eq("status", "traveling"))
    .collect();

  for (const caravan of caravans) {
    if (tick >= caravan.arrivalTick) {
      // Caravan has arrived - deliver goods
      const destination = await ctx.db.get(caravan.destinationId);
      const origin = await ctx.db.get(caravan.originId);

      if (destination && origin) {
        // Calculate total value of delivered goods
        const totalValue = caravan.goods.reduce((sum, g) => sum + g.quantity * g.purchasePrice, 0);

        // INTERCONNECTION: Infrastructure provides trade wealth bonus
        const infraBonus = await getInfrastructureTradeBonus(ctx, caravan.originId, caravan.destinationId);
        const wealthMultiplier = 1 + (infraBonus.wealthBonus / 100);
        const adjustedValue = totalValue * 0.1 * wealthMultiplier;

        // Add wealth to destination from trade - no upper cap
        await ctx.db.patch(caravan.destinationId, {
          wealth: destination.wealth + adjustedValue,
        });

        // Update trade route statistics
        const route = await findTradeRoute(ctx, caravan.originId, caravan.destinationId);
        if (route) {
          await ctx.db.patch(route._id, {
            totalTradeVolume: route.totalTradeVolume + totalValue,
          });
        }

        arrivals.push({
          originName: origin.name,
          destName: destination.name,
          goods: caravan.goods,
        });

        await ctx.db.patch(caravan._id, { status: "arrived" });
      }
    } else {
      // Check for raids while traveling
      const route = await findTradeRoute(ctx, caravan.originId, caravan.destinationId);
      if (route) {
        // Check if route passes through hostile territory
        const raidChance = route.risk / 100;

        // Guards reduce raid chance
        const guardReduction = Math.min(0.5, caravan.guardStrength / 100);
        const adjustedRaidChance = raidChance * (1 - guardReduction);

        if (Math.random() < adjustedRaidChance * 0.1) { // 10% check each tick
          const origin = await ctx.db.get(caravan.originId);
          const dest = await ctx.db.get(caravan.destinationId);

          raids.push({
            originName: origin?.name || "Unknown",
            destName: dest?.name || "Unknown",
          });

          await ctx.db.patch(caravan._id, { status: "raided" });
        }
      }
    }
  }

  return { arrivals, raids };
}

// Raid an enemy's caravans
export async function raidCaravans(
  ctx: MutationCtx,
  raiderTerritoryId: Id<"territories">,
  targetTerritoryId: Id<"territories">,
  tick: number
): Promise<{
  success: boolean;
  raided: number;
  lootValue: number;
}> {
  let raided = 0;
  let lootValue = 0;

  // Find traveling caravans belonging to or going to target
  const caravans = await ctx.db
    .query("caravans")
    .withIndex("by_status", (q) => q.eq("status", "traveling"))
    .collect();

  const raider = await ctx.db.get(raiderTerritoryId);

  for (const caravan of caravans) {
    if (caravan.originId === targetTerritoryId || caravan.destinationId === targetTerritoryId) {
      // Attempt raid
      const raidStrength = raider?.military || 10;
      const defenseStrength = caravan.guardStrength;

      const raidSuccess = Math.random() * raidStrength > Math.random() * defenseStrength;

      if (raidSuccess) {
        // Successful raid - steal goods
        const goodsValue = caravan.goods.reduce((sum, g) => sum + g.quantity * g.purchasePrice, 0);
        lootValue += goodsValue;
        raided++;

        // Transfer some wealth to raider - no upper cap
        await ctx.db.patch(raiderTerritoryId, {
          wealth: (raider?.wealth || 0) + goodsValue * 0.5,
        });

        await ctx.db.patch(caravan._id, { status: "raided" });

        // Log raid event
        await ctx.db.insert("events", {
          tick,
          type: "trade",
          territoryId: raiderTerritoryId,
          targetTerritoryId: targetTerritoryId,
          title: "Caravan Raided",
          description: `Raiders from ${raider?.name} intercepted a caravan, seizing valuable goods.`,
          severity: "negative",
          createdAt: Date.now(),
        });
      }
    }
  }

  return { success: raided > 0, raided, lootValue };
}

// Patrol trade routes to reduce risk
export async function patrolTradeRoutes(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  militaryCommitted: number
): Promise<{ routesProtected: number; riskReduction: number }> {
  // Find all routes involving this territory
  const routes1 = await ctx.db
    .query("tradeRoutes")
    .withIndex("by_territory1", (q) => q.eq("territory1Id", territoryId))
    .collect();

  const routes2 = await ctx.db
    .query("tradeRoutes")
    .withIndex("by_territory2", (q) => q.eq("territory2Id", territoryId))
    .collect();

  const allRoutes = [...routes1, ...routes2].filter(r => r.isActive);

  if (allRoutes.length === 0) {
    return { routesProtected: 0, riskReduction: 0 };
  }

  // Distribute military across routes
  const militaryPerRoute = militaryCommitted / allRoutes.length;
  const riskReduction = Math.min(30, militaryPerRoute * 2);

  for (const route of allRoutes) {
    await ctx.db.patch(route._id, {
      risk: Math.max(0, route.risk - riskReduction),
    });
  }

  return { routesProtected: allRoutes.length, riskReduction };
}

// Close a trade route
export async function closeTradeRoute(
  ctx: MutationCtx,
  territory1Id: Id<"territories">,
  territory2Id: Id<"territories">
): Promise<{ success: boolean }> {
  const route = await findTradeRoute(ctx, territory1Id, territory2Id);

  if (route) {
    await ctx.db.patch(route._id, { isActive: false });
    return { success: true };
  }

  return { success: false };
}

// Calculate price differential between markets
export async function calculatePriceDifferential(
  ctx: MutationCtx,
  territory1Id: Id<"territories">,
  territory2Id: Id<"territories">,
  resourceType: string
): Promise<{ t1Price: number; t2Price: number; profitMargin: number }> {
  const t1Price = await ctx.db
    .query("marketPrices")
    .withIndex("by_territory", (q) => q.eq("territoryId", territory1Id))
    .filter((q) => q.eq(q.field("resourceType"), resourceType))
    .first();

  const t2Price = await ctx.db
    .query("marketPrices")
    .withIndex("by_territory", (q) => q.eq("territoryId", territory2Id))
    .filter((q) => q.eq(q.field("resourceType"), resourceType))
    .first();

  const price1 = t1Price?.currentPrice || 1.0;
  const price2 = t2Price?.currentPrice || 1.0;

  // Profit is made by buying low, selling high
  const profitMargin = Math.abs(price2 - price1) / Math.min(price1, price2);

  return {
    t1Price: price1,
    t2Price: price2,
    profitMargin,
  };
}

// Get trade summary for a territory
export async function getTradeSummary(
  ctx: MutationCtx,
  territoryId: Id<"territories">
): Promise<{
  activeRoutes: number;
  totalTradeVolume: number;
  caravansInTransit: number;
  averageRouteRisk: number;
}> {
  const routes1 = await ctx.db
    .query("tradeRoutes")
    .withIndex("by_territory1", (q) => q.eq("territory1Id", territoryId))
    .collect();

  const routes2 = await ctx.db
    .query("tradeRoutes")
    .withIndex("by_territory2", (q) => q.eq("territory2Id", territoryId))
    .collect();

  const allRoutes = [...routes1, ...routes2];
  const activeRoutes = allRoutes.filter(r => r.isActive);

  const caravans = await ctx.db
    .query("caravans")
    .withIndex("by_origin", (q) => q.eq("originId", territoryId))
    .filter((q) => q.eq(q.field("status"), "traveling"))
    .collect();

  const totalVolume = allRoutes.reduce((sum, r) => sum + r.totalTradeVolume, 0);
  const avgRisk = activeRoutes.length > 0
    ? activeRoutes.reduce((sum, r) => sum + r.risk, 0) / activeRoutes.length
    : 0;

  return {
    activeRoutes: activeRoutes.length,
    totalTradeVolume: totalVolume,
    caravansInTransit: caravans.length,
    averageRouteRisk: avgRisk,
  };
}
