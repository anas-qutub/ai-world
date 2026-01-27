import { query } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";

// Get current world state
export const getWorld = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("world").first();
  },
});

// Get all territories
export const getTerritories = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("territories").collect();
  },
});

// Get territory by ID
export const getTerritory = query({
  args: { id: v.id("territories") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Get territory with its agent
export const getTerritoryWithAgent = query({
  args: { id: v.id("territories") },
  handler: async (ctx, args) => {
    const territory = await ctx.db.get(args.id);
    if (!territory) return null;

    const agent = await ctx.db
      .query("agents")
      .withIndex("by_territory", (q) => q.eq("territoryId", args.id))
      .first();

    return { territory, agent };
  },
});

// Get all territories with their agents
export const getTerritoriesWithAgents = query({
  args: {},
  handler: async (ctx) => {
    const territories = await ctx.db.query("territories").collect();
    const agents = await ctx.db.query("agents").collect();

    const agentsByTerritory = new Map(
      agents.map((agent) => [agent.territoryId, agent])
    );

    return territories.map((territory) => ({
      territory,
      agent: agentsByTerritory.get(territory._id) || null,
    }));
  },
});

// Get all relationships
export const getRelationships = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("relationships").collect();
  },
});

// Get relationship between two territories
export const getRelationship = query({
  args: {
    territory1Id: v.id("territories"),
    territory2Id: v.id("territories"),
  },
  handler: async (ctx, args) => {
    // Check both orderings since relationship could be stored either way
    let relationship = await ctx.db
      .query("relationships")
      .withIndex("by_territories", (q) =>
        q.eq("territory1Id", args.territory1Id).eq("territory2Id", args.territory2Id)
      )
      .first();

    if (!relationship) {
      relationship = await ctx.db
        .query("relationships")
        .withIndex("by_territories", (q) =>
          q.eq("territory1Id", args.territory2Id).eq("territory2Id", args.territory1Id)
        )
        .first();
    }

    return relationship;
  },
});

// Get relationships for a specific territory
export const getTerritoryRelationships = query({
  args: { territoryId: v.id("territories") },
  handler: async (ctx, args) => {
    const asTerritory1 = await ctx.db
      .query("relationships")
      .withIndex("by_territory1", (q) => q.eq("territory1Id", args.territoryId))
      .collect();

    const asTerritory2 = await ctx.db
      .query("relationships")
      .withIndex("by_territory2", (q) => q.eq("territory2Id", args.territoryId))
      .collect();

    // Get territory names for context
    const allTerritoryIds = new Set<string>();
    [...asTerritory1, ...asTerritory2].forEach((rel) => {
      allTerritoryIds.add(rel.territory1Id);
      allTerritoryIds.add(rel.territory2Id);
    });

    const territories = await Promise.all(
      [...allTerritoryIds].map((id) => ctx.db.get(id as Id<"territories">))
    );
    const territoryNames = new Map(
      territories.filter((t): t is Doc<"territories"> => t !== null).map((t) => [t._id, t.name])
    );

    return [...asTerritory1, ...asTerritory2].map((rel) => ({
      ...rel,
      territory1Name: territoryNames.get(rel.territory1Id),
      territory2Name: territoryNames.get(rel.territory2Id),
      otherTerritoryId:
        rel.territory1Id === args.territoryId ? rel.territory2Id : rel.territory1Id,
      otherTerritoryName:
        rel.territory1Id === args.territoryId
          ? territoryNames.get(rel.territory2Id)
          : territoryNames.get(rel.territory1Id),
    }));
  },
});

// Get recent events
export const getRecentEvents = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    const events = await ctx.db
      .query("events")
      .withIndex("by_created")
      .order("desc")
      .take(limit);

    // Enrich events with territory names
    const territoryIds = new Set<string>();
    events.forEach((event) => {
      if (event.territoryId) territoryIds.add(event.territoryId);
      if (event.targetTerritoryId) territoryIds.add(event.targetTerritoryId);
    });

    const territories = await Promise.all(
      [...territoryIds].map((id) => ctx.db.get(id as Id<"territories">))
    );
    const territoryNames = new Map(
      territories.filter((t): t is Doc<"territories"> => t !== null).map((t) => [t._id, t.name])
    );

    return events.map((event) => ({
      ...event,
      territoryName: event.territoryId
        ? territoryNames.get(event.territoryId)
        : undefined,
      targetTerritoryName: event.targetTerritoryId
        ? territoryNames.get(event.targetTerritoryId)
        : undefined,
    }));
  },
});

// Get events for a specific territory
export const getTerritoryEvents = query({
  args: {
    territoryId: v.id("territories"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;
    return await ctx.db
      .query("events")
      .withIndex("by_territory", (q) => q.eq("territoryId", args.territoryId))
      .order("desc")
      .take(limit);
  },
});

// Get recent decisions for a territory
export const getTerritoryDecisions = query({
  args: {
    territoryId: v.id("territories"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 10;
    return await ctx.db
      .query("decisions")
      .withIndex("by_territory", (q) => q.eq("territoryId", args.territoryId))
      .order("desc")
      .take(limit);
  },
});

// Get decisions from the latest tick
export const getLatestTickDecisions = query({
  args: {},
  handler: async (ctx) => {
    const world = await ctx.db.query("world").first();
    if (!world) return [];

    const decisions = await ctx.db
      .query("decisions")
      .withIndex("by_tick", (q) => q.eq("tick", world.tick))
      .collect();

    // Enrich with territory names
    const territories = await ctx.db.query("territories").collect();
    const territoryNames = new Map(territories.map((t) => [t._id, t.name]));

    return decisions.map((decision) => ({
      ...decision,
      territoryName: territoryNames.get(decision.territoryId),
      targetTerritoryName: decision.targetTerritoryId
        ? territoryNames.get(decision.targetTerritoryId)
        : undefined,
    }));
  },
});

// Get full simulation state for dashboard
export const getSimulationState = query({
  args: {},
  handler: async (ctx) => {
    const world = await ctx.db.query("world").first();
    const territories = await ctx.db.query("territories").collect();
    const agents = await ctx.db.query("agents").collect();
    const relationships = await ctx.db.query("relationships").collect();

    const agentsByTerritory = new Map(
      agents.map((agent) => [agent.territoryId, agent])
    );

    const territoryNames = new Map(territories.map((t) => [t._id, t.name]));

    return {
      world,
      territories: territories.map((t) => ({
        ...t,
        agent: agentsByTerritory.get(t._id) || null,
      })),
      relationships: relationships.map((r) => ({
        ...r,
        territory1Name: territoryNames.get(r.territory1Id),
        territory2Name: territoryNames.get(r.territory2Id),
      })),
    };
  },
});

// Get statistics for all territories (for charts)
export const getTerritoryStats = query({
  args: {},
  handler: async (ctx) => {
    const territories = await ctx.db.query("territories").collect();
    const world = await ctx.db.query("world").first();

    // Get total stats
    const totals = {
      population: territories.reduce((sum, t) => sum + t.population, 0),
      food: territories.reduce((sum, t) => sum + t.food, 0) / territories.length,
      wealth: territories.reduce((sum, t) => sum + t.wealth, 0) / territories.length,
      technology: territories.reduce((sum, t) => sum + t.technology, 0) / territories.length,
      military: territories.reduce((sum, t) => sum + t.military, 0) / territories.length,
      happiness: territories.reduce((sum, t) => sum + t.happiness, 0) / territories.length,
    };

    // Format for charts
    const byTerritory = territories.map((t) => ({
      name: (t as any).tribeName || t.name,
      color: t.color,
      population: t.population,
      food: Math.round(t.food),
      wealth: Math.round(t.wealth),
      technology: Math.round(t.technology),
      military: Math.round(t.military),
      happiness: Math.round(t.happiness),
      influence: Math.round(t.influence),
      knowledge: Math.round(t.knowledge),
    }));

    return {
      totals,
      byTerritory,
      currentTick: world?.tick || 0,
    };
  },
});
