import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Global simulation state
  world: defineTable({
    tick: v.number(),
    year: v.number(),
    month: v.number(), // 1-12
    speed: v.union(
      v.literal("paused"),
      v.literal("1x"),
      v.literal("10x"),
      v.literal("100x")
    ),
    status: v.union(
      v.literal("initializing"),
      v.literal("running"),
      v.literal("paused")
    ),
    lastTickAt: v.optional(v.number()), // timestamp
    // Technology era for global events
    currentEra: v.optional(v.string()), // "stone_age", "bronze_age", "iron_age", "medieval"
  }),

  // Territories (continents) with resources
  territories: defineTable({
    name: v.string(),
    color: v.string(), // hex color for map
    // Resources (0-100 scale unless noted)
    population: v.number(), // actual people count
    wealth: v.number(),
    food: v.number(),
    technology: v.number(),
    military: v.number(),
    happiness: v.number(),
    influence: v.number(),
    knowledge: v.number(),
    // Governance - starts as "none" (tribal), can evolve
    governance: v.optional(v.string()), // "none", "council", "chief", "democracy", "dictatorship", "theocracy", etc.
    leaderName: v.optional(v.string()), // Name of leader if applicable
    governmentName: v.optional(v.string()), // What they call their system
    // Cultural identity
    tribeName: v.optional(v.string()), // What they call themselves
    flag: v.optional(v.string()), // Description of their flag/symbol
    originStory: v.optional(v.string()), // Their creation myth / how they began
    // Language - structured storage
    languageNotes: v.optional(v.string()), // General notes about their language
    languageWords: v.optional(v.array(v.object({
      word: v.string(), // The invented word
      meaning: v.string(), // What it means
      type: v.optional(v.string()), // greeting, noun, verb, phrase, etc.
    }))),
    // Traditions and customs
    traditions: v.optional(v.array(v.object({
      name: v.string(), // Name of the tradition
      description: v.string(), // What it involves
      createdAtTick: v.optional(v.number()),
    }))),
    beliefs: v.optional(v.string()), // Their spiritual/philosophical beliefs
    // Natural resources unique to this territory
    naturalResources: v.optional(v.array(v.string())), // e.g., ["gold", "iron", "wheat"]
  }).index("by_name", ["name"]),

  // AI agent configuration per territory
  agents: defineTable({
    territoryId: v.id("territories"),
    provider: v.union(
      v.literal("anthropic"),
      v.literal("openai"),
      v.literal("xai")
    ),
    model: v.string(),
    personality: v.string(), // short description
    systemPrompt: v.string(), // full system prompt
    lastDecisionAt: v.optional(v.number()),
  }).index("by_territory", ["territoryId"]),

  // Bilateral relationships between territories
  relationships: defineTable({
    territory1Id: v.id("territories"),
    territory2Id: v.id("territories"),
    trust: v.number(), // -100 to +100
    status: v.union(
      v.literal("neutral"),
      v.literal("friendly"),
      v.literal("allied"),
      v.literal("tense"),
      v.literal("hostile"),
      v.literal("at_war")
    ),
    hasTradeAgreement: v.boolean(),
    hasAlliance: v.boolean(),
    lastInteractionTick: v.optional(v.number()),
    // War resolution tracking
    pendingPeaceOffer: v.optional(v.id("territories")), // Which territory offered peace
    peaceOfferTerms: v.optional(v.string()), // Description of the peace terms
    warStartTick: v.optional(v.number()), // When the war started
    surrenderedTo: v.optional(v.id("territories")), // If one side surrendered
    // Deep simulation additions
    warExhaustion: v.optional(v.number()), // 0-100, accumulated war fatigue
    warScore: v.optional(v.number()), // -100 to +100, who's winning
  })
    .index("by_territories", ["territory1Id", "territory2Id"])
    .index("by_territory1", ["territory1Id"])
    .index("by_territory2", ["territory2Id"]),

  // AI decision history
  decisions: defineTable({
    territoryId: v.id("territories"),
    tick: v.number(),
    action: v.string(), // action type
    targetTerritoryId: v.optional(v.id("territories")),
    reasoning: v.string(), // AI's explanation
    parameters: v.optional(v.any()), // action-specific params
    effects: v.optional(v.any()), // what changed as a result
    createdAt: v.number(),
  })
    .index("by_territory", ["territoryId"])
    .index("by_tick", ["tick"])
    .index("by_territory_tick", ["territoryId", "tick"]),

  // Activity log for feed
  events: defineTable({
    tick: v.number(),
    type: v.union(
      v.literal("decision"),
      v.literal("trade"),
      v.literal("alliance"),
      v.literal("war"),
      v.literal("disaster"),
      v.literal("breakthrough"),
      v.literal("crisis"),
      v.literal("population_boom"),
      v.literal("system")
    ),
    territoryId: v.optional(v.id("territories")),
    targetTerritoryId: v.optional(v.id("territories")),
    title: v.string(),
    description: v.string(),
    severity: v.union(
      v.literal("info"),
      v.literal("positive"),
      v.literal("negative"),
      v.literal("critical")
    ),
    createdAt: v.number(),
  })
    .index("by_tick", ["tick"])
    .index("by_territory", ["territoryId"])
    .index("by_created", ["createdAt"]),

  // =============================================
  // DEEP SIMULATION SYSTEM - PHASE 1: ECONOMY
  // =============================================

  // Resource deposits with depletion
  resources: defineTable({
    territoryId: v.id("territories"),
    type: v.string(), // "iron_ore", "timber", "wheat", "gold", etc.
    quantity: v.number(), // Current available amount
    maxQuantity: v.number(), // Maximum capacity
    regenerationRate: v.number(), // Per tick regeneration (0 for non-renewable)
    depletionLevel: v.number(), // 0-100, affects extraction efficiency
    discovered: v.boolean(), // Whether territory knows about this deposit
  })
    .index("by_territory", ["territoryId"])
    .index("by_type", ["type"]),

  // Production buildings
  buildings: defineTable({
    territoryId: v.id("territories"),
    type: v.string(), // "farm", "mine", "workshop", "barracks", "market", "academy"
    name: v.optional(v.string()), // Custom name if given
    level: v.number(), // 1-5
    workers: v.number(), // Assigned workers
    maxWorkers: v.number(), // Maximum worker capacity
    outputPerTick: v.number(), // Base production rate
    maintenanceCost: v.number(), // Food/wealth upkeep per tick
    condition: v.number(), // 0-100, degrades over time
    constructedAtTick: v.number(),
  })
    .index("by_territory", ["territoryId"])
    .index("by_type", ["type"]),

  // Market prices (supply/demand dynamics)
  marketPrices: defineTable({
    territoryId: v.id("territories"),
    resourceType: v.string(),
    currentPrice: v.number(), // Base price multiplier (1.0 = normal)
    supply: v.number(), // Available for sale
    demand: v.number(), // Desired by population
    lastUpdatedTick: v.number(),
  })
    .index("by_territory", ["territoryId"])
    .index("by_resource", ["resourceType"]),

  // =============================================
  // DEEP SIMULATION SYSTEM - PHASE 2: TRADE
  // =============================================

  // Trade routes between territories
  tradeRoutes: defineTable({
    territory1Id: v.id("territories"),
    territory2Id: v.id("territories"),
    distance: v.number(), // Ticks to travel
    risk: v.number(), // 0-100 caravan loss chance per trip
    isActive: v.boolean(),
    establishedAtTick: v.number(),
    totalTradeVolume: v.number(), // Cumulative goods traded
  })
    .index("by_territory1", ["territory1Id"])
    .index("by_territory2", ["territory2Id"]),

  // Moving caravans
  caravans: defineTable({
    originId: v.id("territories"),
    destinationId: v.id("territories"),
    goods: v.array(v.object({
      type: v.string(),
      quantity: v.number(),
      purchasePrice: v.number(),
    })),
    departedTick: v.number(),
    arrivalTick: v.number(),
    status: v.union(
      v.literal("traveling"),
      v.literal("arrived"),
      v.literal("raided"),
      v.literal("lost")
    ),
    guardStrength: v.number(), // Military protection
  })
    .index("by_origin", ["originId"])
    .index("by_destination", ["destinationId"])
    .index("by_status", ["status"]),

  // =============================================
  // DEEP SIMULATION SYSTEM - PHASE 3: DEMOGRAPHICS
  // =============================================

  // Age distribution per territory
  demographics: defineTable({
    territoryId: v.id("territories"),
    children: v.number(), // Ages 0-14
    adults: v.number(), // Ages 15-49
    elderly: v.number(), // Ages 50+
    birthRate: v.number(), // Per 1000 adults per tick
    deathRate: v.number(), // Per 1000 population per tick
    immigrationRate: v.number(), // Net migration
    lastUpdatedTick: v.number(),
  }).index("by_territory", ["territoryId"]),

  // Social classes with needs and productivity
  socialClasses: defineTable({
    territoryId: v.id("territories"),
    className: v.string(), // "noble", "warrior", "merchant", "craftsman", "farmer", "slave"
    population: v.number(),
    happiness: v.number(), // 0-100
    productivityModifier: v.number(), // 0.5-2.0
    wealthShare: v.number(), // Percentage of territory wealth owned
    politicalPower: v.number(), // 0-100, influence on decisions
  })
    .index("by_territory", ["territoryId"])
    .index("by_class", ["className"]),

  // Internal factions that can rebel
  factions: defineTable({
    territoryId: v.id("territories"),
    name: v.string(),
    type: v.string(), // "political", "religious", "economic", "military", "ethnic"
    ideology: v.optional(v.string()), // What they believe
    power: v.number(), // 0-100, political influence
    happiness: v.number(), // 0-100, satisfaction with current state
    rebellionRisk: v.number(), // 0-100, chance of uprising
    memberCount: v.number(),
    leaderId: v.optional(v.string()), // Name of faction leader
    foundedAtTick: v.number(),
  })
    .index("by_territory", ["territoryId"])
    .index("by_type", ["type"]),

  // Active rebellions
  rebellions: defineTable({
    territoryId: v.id("territories"),
    factionId: v.id("factions"),
    startedAtTick: v.number(),
    strength: v.number(), // 0-100
    demands: v.string(),
    status: v.union(
      v.literal("active"),
      v.literal("suppressed"),
      v.literal("successful"),
      v.literal("negotiated")
    ),
  })
    .index("by_territory", ["territoryId"])
    .index("by_status", ["status"]),

  // Spreading diseases
  diseases: defineTable({
    name: v.string(),
    type: v.string(), // "plague", "fever", "pox", "cholera"
    mortalityRate: v.number(), // Percentage of infected who die
    spreadRate: v.number(), // How fast it spreads
    affectedTerritories: v.array(v.id("territories")),
    originTerritoryId: v.id("territories"),
    startedAtTick: v.number(),
    status: v.union(
      v.literal("spreading"),
      v.literal("contained"),
      v.literal("ended")
    ),
  })
    .index("by_status", ["status"])
    .index("by_origin", ["originTerritoryId"]),

  // =============================================
  // DEEP SIMULATION SYSTEM - PHASE 4: MILITARY
  // =============================================

  // Armies as distinct entities
  armies: defineTable({
    territoryId: v.id("territories"), // Owner
    name: v.string(),
    locationId: v.id("territories"), // Current location
    units: v.array(v.object({
      type: v.string(), // "militia", "infantry", "cavalry", "archer", "siege"
      count: v.number(),
      experience: v.number(), // 0-100
      morale: v.number(), // 0-100
      equipment: v.number(), // 0-100, quality of gear
    })),
    supplies: v.number(), // Days of food/supplies
    status: v.union(
      v.literal("garrison"),
      v.literal("marching"),
      v.literal("besieging"),
      v.literal("battling"),
      v.literal("retreating"),
      v.literal("disbanded")
    ),
    commanderName: v.optional(v.string()),
    createdAtTick: v.number(),
  })
    .index("by_territory", ["territoryId"])
    .index("by_location", ["locationId"])
    .index("by_status", ["status"]),

  // Active sieges
  sieges: defineTable({
    attackerArmyId: v.id("armies"),
    defenderTerritoryId: v.id("territories"),
    defenderArmyId: v.optional(v.id("armies")),
    fortificationLevel: v.number(), // Starting defense
    currentDefense: v.number(), // Current defense HP
    progress: v.number(), // 0-100, siege progress
    startedAtTick: v.number(),
    status: v.union(
      v.literal("ongoing"),
      v.literal("assault"),
      v.literal("breached"),
      v.literal("lifted"),
      v.literal("successful")
    ),
  })
    .index("by_defender", ["defenderTerritoryId"])
    .index("by_attacker", ["attackerArmyId"]),

  // Defensive structures
  fortifications: defineTable({
    territoryId: v.id("territories"),
    type: v.string(), // "palisade", "wooden_wall", "stone_wall", "castle", "fortress"
    level: v.number(), // 1-5
    health: v.number(), // 0-100
    maxHealth: v.number(),
    defenseBonus: v.number(), // Multiplier for defenders
    constructedAtTick: v.number(),
    lastRepairedTick: v.optional(v.number()),
  }).index("by_territory", ["territoryId"]),

  // Battle records
  battles: defineTable({
    attackerTerritoryId: v.id("territories"),
    defenderTerritoryId: v.id("territories"),
    attackerArmyId: v.id("armies"),
    defenderArmyId: v.optional(v.id("armies")),
    locationId: v.id("territories"),
    tick: v.number(),
    attackerLosses: v.number(),
    defenderLosses: v.number(),
    winner: v.union(v.literal("attacker"), v.literal("defender"), v.literal("draw")),
    description: v.string(),
  })
    .index("by_tick", ["tick"])
    .index("by_attacker", ["attackerTerritoryId"])
    .index("by_defender", ["defenderTerritoryId"]),

  // =============================================
  // DEEP SIMULATION SYSTEM - PHASE 5: TECHNOLOGY
  // =============================================

  // Territory tech progress
  technologies: defineTable({
    territoryId: v.id("territories"),
    techId: v.string(),
    researched: v.boolean(),
    researchProgress: v.number(), // 0-100
    researchStartedTick: v.optional(v.number()),
    researchedAtTick: v.optional(v.number()),
  })
    .index("by_territory", ["territoryId"])
    .index("by_tech", ["techId"]),

  // Static tech tree definitions (seeded once)
  techTree: defineTable({
    techId: v.string(),
    name: v.string(),
    description: v.string(),
    era: v.string(), // "stone_age", "bronze_age", "iron_age", "medieval"
    category: v.string(), // "military", "economy", "society", "science"
    prerequisites: v.array(v.string()), // Required tech IDs
    knowledgeCost: v.number(), // Knowledge points to research
    unlocks: v.array(v.object({
      type: v.string(), // "building", "unit", "action", "bonus"
      id: v.string(),
      description: v.string(),
    })),
  })
    .index("by_era", ["era"])
    .index("by_category", ["category"]),
});
