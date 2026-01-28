/**
 * World Events System
 *
 * Global events that shake up rankings and force civilizations to adapt.
 * These create dramatic moments and prevent any civilization from getting
 * too comfortable in the lead.
 */

import { Doc, Id } from "../_generated/dataModel";
import { MutationCtx, QueryCtx } from "../_generated/server";

// =============================================
// EVENT DEFINITIONS
// =============================================

export type WorldEventSeverity = "minor" | "major" | "catastrophic";
export type WorldEventType =
  | "plague"
  | "famine"
  | "climate"
  | "migration"
  | "discovery"
  | "comet"
  | "earthquake"
  | "volcanic"
  | "flood"
  | "drought"
  | "golden_age"
  | "dark_age"
  | "resource_boom"
  | "resource_depletion";

export interface WorldEventDefinition {
  id: string;
  name: string;
  type: WorldEventType;
  description: string;
  severity: WorldEventSeverity;
  minTick: number; // Earliest tick this can occur
  probability: number; // Base probability per tick (0-1)
  duration: number; // How many ticks it lasts
  affects: "all" | "random" | "leader" | "weakest" | "populous";
  effects: {
    population?: number; // Multiplier (0.8 = -20%)
    food?: number;
    wealth?: number;
    happiness?: number;
    military?: number;
    technology?: number;
    knowledge?: number;
  };
  // Conditions for this event to be possible
  conditions?: {
    minPopulation?: number;
    maxPopulation?: number;
    minTechnology?: number;
    minEra?: string;
    requiresCoastal?: boolean;
  };
}

export const WORLD_EVENTS: WorldEventDefinition[] = [
  // =============================================
  // PLAGUES & DISEASE
  // =============================================
  {
    id: "minor_plague",
    name: "Outbreak",
    type: "plague",
    description: "A disease outbreak spreads through the population",
    severity: "minor",
    minTick: 50,
    probability: 0.01,
    duration: 6,
    affects: "random",
    effects: { population: 0.95, happiness: -5 },
  },
  {
    id: "great_plague",
    name: "Great Plague",
    type: "plague",
    description: "A devastating plague sweeps across civilizations",
    severity: "catastrophic",
    minTick: 200,
    probability: 0.002,
    duration: 24,
    affects: "all",
    effects: { population: 0.7, happiness: -20, wealth: -10 },
    conditions: { minPopulation: 200 },
  },
  {
    id: "pandemic",
    name: "Global Pandemic",
    type: "plague",
    description: "A deadly pandemic threatens all of humanity",
    severity: "catastrophic",
    minTick: 500,
    probability: 0.001,
    duration: 36,
    affects: "all",
    effects: { population: 0.6, happiness: -30, wealth: -20, military: -10 },
    conditions: { minPopulation: 500, minEra: "industrial" },
  },

  // =============================================
  // FAMINE & FOOD CRISES
  // =============================================
  {
    id: "crop_failure",
    name: "Crop Failure",
    type: "famine",
    description: "Bad weather destroys crops across the region",
    severity: "minor",
    minTick: 30,
    probability: 0.015,
    duration: 6,
    affects: "random",
    effects: { food: -30, happiness: -5 },
  },
  {
    id: "great_famine",
    name: "Great Famine",
    type: "famine",
    description: "Multiple crop failures lead to widespread starvation",
    severity: "major",
    minTick: 100,
    probability: 0.005,
    duration: 12,
    affects: "populous",
    effects: { food: -50, population: 0.9, happiness: -15 },
    conditions: { minPopulation: 100 },
  },

  // =============================================
  // CLIMATE EVENTS
  // =============================================
  {
    id: "harsh_winter",
    name: "Harsh Winter",
    type: "climate",
    description: "An unusually cold winter tests survival skills",
    severity: "minor",
    minTick: 20,
    probability: 0.02,
    duration: 3,
    affects: "all",
    effects: { food: -15, happiness: -3 },
  },
  {
    id: "mini_ice_age",
    name: "Mini Ice Age",
    type: "climate",
    description: "Global temperatures drop for years",
    severity: "major",
    minTick: 300,
    probability: 0.002,
    duration: 48,
    affects: "all",
    effects: { food: -20, population: 0.95, happiness: -10 },
  },
  {
    id: "global_warming",
    name: "Climate Change",
    type: "climate",
    description: "Changing climate patterns disrupt agriculture worldwide",
    severity: "major",
    minTick: 600,
    probability: 0.003,
    duration: 60,
    affects: "all",
    effects: { food: -15, happiness: -10 },
    conditions: { minEra: "industrial" },
  },

  // =============================================
  // NATURAL DISASTERS
  // =============================================
  {
    id: "earthquake",
    name: "Great Earthquake",
    type: "earthquake",
    description: "A massive earthquake destroys buildings and kills thousands",
    severity: "major",
    minTick: 50,
    probability: 0.005,
    duration: 1,
    affects: "random",
    effects: { population: 0.92, wealth: -20, happiness: -15 },
  },
  {
    id: "volcanic_eruption",
    name: "Volcanic Eruption",
    type: "volcanic",
    description: "A volcano erupts, covering the land in ash",
    severity: "major",
    minTick: 100,
    probability: 0.003,
    duration: 12,
    affects: "random",
    effects: { population: 0.9, food: -30, happiness: -20 },
  },
  {
    id: "great_flood",
    name: "Great Flood",
    type: "flood",
    description: "Massive flooding destroys crops and settlements",
    severity: "major",
    minTick: 50,
    probability: 0.008,
    duration: 6,
    affects: "random",
    effects: { food: -40, wealth: -15, happiness: -10 },
  },
  {
    id: "mega_drought",
    name: "Mega Drought",
    type: "drought",
    description: "Years without rain lead to mass exodus",
    severity: "catastrophic",
    minTick: 150,
    probability: 0.003,
    duration: 24,
    affects: "random",
    effects: { population: 0.8, food: -50, happiness: -25 },
  },

  // =============================================
  // CELESTIAL EVENTS
  // =============================================
  {
    id: "comet_sighting",
    name: "Comet Sighting",
    type: "comet",
    description: "A comet appears in the sky - an omen of change",
    severity: "minor",
    minTick: 100,
    probability: 0.01,
    duration: 3,
    affects: "all",
    effects: { happiness: -5, knowledge: 5 },
  },
  {
    id: "solar_eclipse",
    name: "Solar Eclipse",
    type: "comet",
    description: "The sun goes dark - people fear the end times",
    severity: "minor",
    minTick: 50,
    probability: 0.008,
    duration: 1,
    affects: "all",
    effects: { happiness: -10 },
  },

  // =============================================
  // POSITIVE EVENTS
  // =============================================
  {
    id: "resource_discovery",
    name: "Resource Discovery",
    type: "resource_boom",
    description: "Rich deposits of valuable resources are found",
    severity: "minor",
    minTick: 50,
    probability: 0.01,
    duration: 24,
    affects: "random",
    effects: { wealth: 30, happiness: 5 },
  },
  {
    id: "gold_rush",
    name: "Gold Rush",
    type: "resource_boom",
    description: "Gold is discovered, attracting settlers and wealth",
    severity: "major",
    minTick: 200,
    probability: 0.005,
    duration: 36,
    affects: "random",
    effects: { wealth: 50, population: 1.1, happiness: 10 },
    conditions: { minTechnology: 50 },
  },
  {
    id: "renaissance_bloom",
    name: "Cultural Renaissance",
    type: "golden_age",
    description: "Art, science, and culture flourish",
    severity: "major",
    minTick: 300,
    probability: 0.004,
    duration: 48,
    affects: "leader",
    effects: { knowledge: 20, technology: 15, happiness: 15 },
    conditions: { minPopulation: 300 },
  },
  {
    id: "scientific_breakthrough",
    name: "Scientific Breakthrough",
    type: "discovery",
    description: "A major scientific discovery advances knowledge",
    severity: "minor",
    minTick: 100,
    probability: 0.008,
    duration: 1,
    affects: "random",
    effects: { technology: 10, knowledge: 15 },
  },

  // =============================================
  // MIGRATION EVENTS
  // =============================================
  {
    id: "barbarian_migration",
    name: "Barbarian Migration",
    type: "migration",
    description: "Waves of migrants threaten the borders",
    severity: "major",
    minTick: 200,
    probability: 0.005,
    duration: 24,
    affects: "leader",
    effects: { military: -10, happiness: -10, population: 0.95 },
    conditions: { minPopulation: 200 },
  },
  {
    id: "refugee_influx",
    name: "Refugee Crisis",
    type: "migration",
    description: "Refugees fleeing disaster seek shelter in your lands",
    severity: "minor",
    minTick: 100,
    probability: 0.008,
    duration: 12,
    affects: "random",
    effects: { population: 1.05, food: -20, happiness: -5 },
  },

  // =============================================
  // NEGATIVE PERIODS
  // =============================================
  {
    id: "dark_age",
    name: "Dark Age",
    type: "dark_age",
    description: "Knowledge is lost, progress stalls",
    severity: "major",
    minTick: 300,
    probability: 0.003,
    duration: 60,
    affects: "random",
    effects: { technology: -10, knowledge: -20, happiness: -10 },
    conditions: { minPopulation: 200 },
  },
  {
    id: "resource_depletion",
    name: "Resource Depletion",
    type: "resource_depletion",
    description: "Key resources run out, economy suffers",
    severity: "major",
    minTick: 400,
    probability: 0.004,
    duration: 36,
    affects: "leader",
    effects: { wealth: -30, happiness: -15 },
    conditions: { minPopulation: 400 },
  },
];

// Map for quick lookup
export const WORLD_EVENT_MAP = new Map<string, WorldEventDefinition>(
  WORLD_EVENTS.map(e => [e.id, e])
);

// =============================================
// EVENT PROCESSING
// =============================================

/**
 * Roll for world events each tick
 */
export async function processWorldEvents(
  ctx: MutationCtx,
  territories: Doc<"territories">[],
  world: Doc<"world">,
  tick: number
): Promise<{
  newEvents: string[];
  ongoingEvents: string[];
  endedEvents: string[];
}> {
  const newEvents: string[] = [];
  const ongoingEvents: string[] = [];
  const endedEvents: string[] = [];

  // Get active world events
  const activeEvents = await ctx.db
    .query("worldEvents")
    .withIndex("by_active", (q) => q.eq("isActive", true))
    .collect();

  // Process ongoing events
  for (const event of activeEvents) {
    if (tick >= event.endTick) {
      // Event has ended
      await ctx.db.patch(event._id, { isActive: false });
      endedEvents.push(event.eventId);

      // Create end event
      const def = WORLD_EVENT_MAP.get(event.eventId);
      if (def) {
        await ctx.db.insert("events", {
          tick,
          type: "world_event",
          title: `${def.name} Ends`,
          description: `The ${def.name} has finally ended. Civilizations can begin to recover.`,
          severity: "info",
          createdAt: Date.now(),
        });
      }
    } else {
      ongoingEvents.push(event.eventId);
      // Apply ongoing effects
      await applyEventEffects(ctx, event, territories, tick);
    }
  }

  // Roll for new events
  const activeTerritories = territories.filter(t => !t.isEliminated);
  const totalPopulation = activeTerritories.reduce((sum, t) => sum + t.population, 0);
  const maxTech = Math.max(...activeTerritories.map(t => t.technology));

  for (const eventDef of WORLD_EVENTS) {
    // Skip if tick is too early
    if (tick < eventDef.minTick) continue;

    // Skip if already active
    if (ongoingEvents.includes(eventDef.id)) continue;

    // Check conditions
    if (eventDef.conditions) {
      if (eventDef.conditions.minPopulation && totalPopulation < eventDef.conditions.minPopulation) continue;
      if (eventDef.conditions.minTechnology && maxTech < eventDef.conditions.minTechnology) continue;
      // Add more condition checks as needed
    }

    // Roll for event
    if (Math.random() < eventDef.probability) {
      // Event triggered!
      const affectedTerritories = selectAffectedTerritories(
        activeTerritories,
        eventDef.affects
      );

      await ctx.db.insert("worldEvents", {
        eventId: eventDef.id,
        startTick: tick,
        endTick: tick + eventDef.duration,
        isActive: true,
        affectedTerritoryIds: affectedTerritories.map(t => t._id),
        severity: eventDef.severity,
      });

      newEvents.push(eventDef.id);

      // Create event announcement
      const affectedNames = affectedTerritories.map(t => t.tribeName || t.name).join(", ");
      await ctx.db.insert("events", {
        tick,
        type: "world_event",
        title: `${getSeverityEmoji(eventDef.severity)} ${eventDef.name}!`,
        description: `${eventDef.description} Affecting: ${eventDef.affects === "all" ? "All civilizations" : affectedNames}. Duration: ${eventDef.duration} months.`,
        severity: eventDef.severity === "catastrophic" ? "critical" : eventDef.severity === "major" ? "negative" : "info",
        createdAt: Date.now(),
      });

      // Apply immediate effects
      const worldEvent = await ctx.db.query("worldEvents")
        .filter(q => q.eq(q.field("eventId"), eventDef.id))
        .order("desc")
        .first();

      if (worldEvent) {
        await applyEventEffects(ctx, worldEvent, territories, tick);
      }

      // Only trigger one new event per tick
      break;
    }
  }

  return { newEvents, ongoingEvents, endedEvents };
}

/**
 * Select which territories are affected by an event
 */
function selectAffectedTerritories(
  territories: Doc<"territories">[],
  affects: WorldEventDefinition["affects"]
): Doc<"territories">[] {
  switch (affects) {
    case "all":
      return territories;
    case "random":
      // Pick 1-3 random territories
      const count = Math.min(territories.length, Math.floor(Math.random() * 3) + 1);
      const shuffled = [...territories].sort(() => Math.random() - 0.5);
      return shuffled.slice(0, count);
    case "leader":
      // Affect the territory with highest population
      return [territories.reduce((max, t) => t.population > max.population ? t : max)];
    case "weakest":
      // Affect the territory with lowest population
      return [territories.reduce((min, t) => t.population < min.population ? t : min)];
    case "populous":
      // Affect territories with above-average population
      const avgPop = territories.reduce((sum, t) => sum + t.population, 0) / territories.length;
      return territories.filter(t => t.population >= avgPop);
    default:
      return territories;
  }
}

/**
 * Apply event effects to affected territories
 */
async function applyEventEffects(
  ctx: MutationCtx,
  event: Doc<"worldEvents">,
  territories: Doc<"territories">[],
  tick: number
): Promise<void> {
  const eventDef = WORLD_EVENT_MAP.get(event.eventId);
  if (!eventDef) return;

  const affectedTerritories = territories.filter(
    t => event.affectedTerritoryIds.includes(t._id)
  );

  for (const territory of affectedTerritories) {
    if (territory.isEliminated) continue;

    const updates: Partial<Doc<"territories">> = {};

    // Apply effects (divided by duration for per-tick effects)
    if (eventDef.effects.population !== undefined) {
      // Population is a multiplier, apply gradually
      const perTickMultiplier = Math.pow(eventDef.effects.population, 1 / eventDef.duration);
      updates.population = Math.max(1, Math.floor(territory.population * perTickMultiplier));
    }
    if (eventDef.effects.food !== undefined) {
      const perTickFood = eventDef.effects.food / eventDef.duration;
      updates.food = Math.max(0, territory.food + perTickFood);
    }
    if (eventDef.effects.wealth !== undefined) {
      const perTickWealth = eventDef.effects.wealth / eventDef.duration;
      updates.wealth = Math.max(0, territory.wealth + perTickWealth);
    }
    if (eventDef.effects.happiness !== undefined) {
      const perTickHappiness = eventDef.effects.happiness / eventDef.duration;
      updates.happiness = Math.max(0, Math.min(100, territory.happiness + perTickHappiness));
    }
    if (eventDef.effects.military !== undefined) {
      const perTickMilitary = eventDef.effects.military / eventDef.duration;
      updates.military = Math.max(0, Math.min(100, territory.military + perTickMilitary));
    }
    if (eventDef.effects.technology !== undefined) {
      const perTickTech = eventDef.effects.technology / eventDef.duration;
      updates.technology = Math.max(0, territory.technology + perTickTech);
    }
    if (eventDef.effects.knowledge !== undefined) {
      const perTickKnowledge = eventDef.effects.knowledge / eventDef.duration;
      updates.knowledge = Math.max(0, territory.knowledge + perTickKnowledge);
    }

    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(territory._id, updates);
    }
  }
}

/**
 * Get emoji for severity
 */
function getSeverityEmoji(severity: WorldEventSeverity): string {
  switch (severity) {
    case "catastrophic": return "💀";
    case "major": return "⚠️";
    case "minor": return "📢";
    default: return "📢";
  }
}

/**
 * Get active world events summary
 */
export async function getActiveWorldEvents(
  ctx: QueryCtx
): Promise<Array<{
  event: WorldEventDefinition;
  startTick: number;
  endTick: number;
  ticksRemaining: number;
  affectedCount: number;
}>> {
  const world = await ctx.db.query("world").first();
  if (!world) return [];

  const activeEvents = await ctx.db
    .query("worldEvents")
    .withIndex("by_active", (q) => q.eq("isActive", true))
    .collect();

  return activeEvents.map(e => {
    const def = WORLD_EVENT_MAP.get(e.eventId);
    return {
      event: def!,
      startTick: e.startTick,
      endTick: e.endTick,
      ticksRemaining: Math.max(0, e.endTick - world.tick),
      affectedCount: e.affectedTerritoryIds.length,
    };
  }).filter(e => e.event !== undefined);
}

/**
 * Get world event history
 */
export async function getWorldEventHistory(
  ctx: QueryCtx,
  limit: number = 20
): Promise<Doc<"worldEvents">[]> {
  return await ctx.db
    .query("worldEvents")
    .order("desc")
    .take(limit);
}
