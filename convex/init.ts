import { mutation } from "./_generated/server";
import { TECH_TREE, getStartingTechnologies } from "./data/techTree";
import { createCharacterInternal } from "./simulation/characters";
import { SKILL_TYPES } from "./simulation/collectiveKnowledge";

export const initializeWorld = mutation({
  args: {},
  handler: async (ctx) => {
    // Check if world already exists
    const existingWorld = await ctx.db.query("world").first();
    if (existingWorld) {
      throw new Error("World already initialized. Use resetWorld to start over.");
    }

    // Create world
    await ctx.db.insert("world", {
      tick: 0,
      year: 0,
      month: 1,
      speed: "paused",
      status: "initializing",
    });

    // Define territories with initial resources - starting from scratch!
    // Each continent begins with just 20-30 people building civilization from nothing
    const territories = [
      {
        name: "North America",
        color: "#ef4444", // Red
        population: 25,
        wealth: 5,
        food: 50, // Sufficient for sustainable population (2x per capita)
        technology: 1,
        military: 0,
        happiness: 50,
        influence: 0,
        knowledge: 5,
        governance: "none",
        leaderName: undefined,
        governmentName: undefined,
        tribeName: undefined,
        flag: undefined,
        originStory: undefined,
        languageNotes: undefined,
        languageWords: [],
        traditions: [],
        beliefs: undefined,
        naturalResources: [
          "timber",           // Vast forests for building and fuel
          "copper",           // Native copper deposits (Great Lakes region)
          "bison",            // Massive herds for food, hides, bones
          "freshwater fish",  // Great Lakes and rivers
          "wild turkey",      // Native game bird
          "maize",            // Domesticable grain (corn)
          "obsidian",         // Volcanic glass for sharp tools
          "beaver pelts",     // Valuable fur
        ],
        // Survival resources - tribes start with basic shelter and some wood
        woodStockpile: 30,     // Some gathered firewood
        shelterCapacity: 15,   // Basic caves/lean-tos shelter ~60% of population
        preservedFood: 0,      // No preserved food yet
      },
      {
        name: "Europe",
        color: "#14b8a6", // Teal
        population: 28,
        wealth: 5,
        food: 56, // Sufficient for sustainable population (2x per capita)
        technology: 1,
        military: 0,
        happiness: 50,
        influence: 0,
        knowledge: 5,
        governance: "none",
        leaderName: undefined,
        governmentName: undefined,
        tribeName: undefined,
        flag: undefined,
        originStory: undefined,
        languageNotes: undefined,
        languageWords: [],
        traditions: [],
        beliefs: undefined,
        naturalResources: [
          "iron ore",         // Foundation of metallurgy (Sweden, Germany)
          "wheat",            // Fertile plains for grain cultivation
          "horses",           // Domesticable for transport and warfare
          "timber",           // Dense forests (Scandinavia)
          "coal",             // For advanced smelting
          "fish",             // North Sea and Atlantic abundance
          "clay",             // For pottery and bricks
          "marble",           // Mediterranean quarries (Greece, Italy)
          "grapes",           // Wine cultivation
        ],
        // Survival resources
        woodStockpile: 35,     // Good forests
        shelterCapacity: 18,   // Basic shelter for ~65%
        preservedFood: 0,
      },
      {
        name: "Africa",
        color: "#3b82f6", // Blue
        population: 22,
        wealth: 5,
        food: 44, // Sufficient for sustainable population (2x per capita)
        technology: 1,
        military: 0,
        happiness: 50,
        influence: 0,
        knowledge: 5,
        governance: "none",
        leaderName: undefined,
        governmentName: undefined,
        tribeName: undefined,
        flag: undefined,
        originStory: undefined,
        languageNotes: undefined,
        languageWords: [],
        traditions: [],
        beliefs: undefined,
        naturalResources: [
          "gold",             // Alluvial deposits (Ghana, Mali, South Africa)
          "diamonds",         // Kimberly mines, Congo
          "ivory",            // Elephant tusks (trade commodity)
          "salt",             // Saharan deposits (extremely valuable)
          "copper",           // Congo copper belt
          "cattle",           // Domesticable herds
          "sorghum",          // Native grain crop
          "tropical hardwoods", // Ebony, mahogany for crafting
          "coffee beans",     // Ethiopian highlands origin
        ],
        // Survival resources - warm climate, less wood needed
        woodStockpile: 20,     // Less focus on heating
        shelterCapacity: 12,   // Simpler shelters in warm climate
        preservedFood: 0,
      },
      {
        name: "Asia",
        color: "#f59e0b", // Amber
        population: 30,
        wealth: 5,
        food: 60, // Sufficient for sustainable population (2x per capita)
        technology: 1,
        military: 0,
        happiness: 50,
        influence: 0,
        knowledge: 6,
        governance: "none",
        leaderName: undefined,
        governmentName: undefined,
        tribeName: undefined,
        flag: undefined,
        originStory: undefined,
        languageNotes: undefined,
        languageWords: [],
        traditions: [],
        beliefs: undefined,
        naturalResources: [
          "silk",             // Silkworm cultivation (China)
          "rice",             // Staple grain (paddies)
          "jade",             // Precious stone for art and tools
          "tea",              // Mountain cultivation (China, India)
          "bamboo",           // Versatile building material
          "spices",           // Pepper, cinnamon, ginger
          "tin",              // For bronze-making
          "porcelain clay",   // Fine ceramics
          "elephants",        // Work animals and warfare
          "incense",          // Frankincense, myrrh (Arabia)
        ],
        // Survival resources - bamboo as alternative building material
        woodStockpile: 40,     // Abundant bamboo and timber
        shelterCapacity: 20,   // Good shelter traditions
        preservedFood: 5,      // Rice storage traditions
      },
      {
        name: "South America",
        color: "#10b981", // Emerald
        population: 20,
        wealth: 5,
        food: 45, // Sufficient for sustainable population (>2x per capita)
        technology: 1,
        military: 0,
        happiness: 55,
        influence: 0,
        knowledge: 4,
        governance: "none",
        leaderName: undefined,
        governmentName: undefined,
        tribeName: undefined,
        flag: undefined,
        originStory: undefined,
        languageNotes: undefined,
        languageWords: [],
        traditions: [],
        beliefs: undefined,
        naturalResources: [
          "silver",           // Rich Andean deposits (Peru, Bolivia)
          "rubber trees",     // Amazon rainforest
          "cocoa",            // Chocolate source
          "potatoes",         // Native to Andes, staple crop
          "maize",            // Corn cultivation
          "llamas",           // Pack animals and wool
          "alpaca wool",      // Fine fiber for textiles
          "quinoa",           // Protein-rich grain
          "tropical fruits",  // Abundant rainforest produce
          "emeralds",         // Colombian deposits
        ],
        // Survival resources - tropical climate, abundant resources
        woodStockpile: 25,     // Rainforest wood
        shelterCapacity: 12,   // Basic tropical shelters
        preservedFood: 0,
      },
      {
        name: "Australia",
        color: "#8b5cf6", // Purple
        population: 18,
        wealth: 4,
        food: 40, // Sufficient for sustainable population (>2x per capita)
        technology: 1,
        military: 0,
        happiness: 52,
        influence: 0,
        knowledge: 5,
        governance: "none",
        leaderName: undefined,
        governmentName: undefined,
        tribeName: undefined,
        flag: undefined,
        originStory: undefined,
        languageNotes: undefined,
        languageWords: [],
        traditions: [],
        beliefs: undefined,
        naturalResources: [
          "opals",            // Unique precious stones (90% of world supply)
          "kangaroo",         // Native game animal
          "eucalyptus",       // Medicine, oil, building material
          "fish",             // Abundant coastal waters
          "ochre",            // Natural pigment for art/ceremony
          "bush tucker",      // Native edible plants and fruits
          "emu",              // Large game bird
          "iron ore",         // Massive deposits (Pilbara)
          "gold",             // Western Australian goldfields
          "sandalwood",       // Aromatic timber
        ],
        // Survival resources - warm climate, less winter concern
        woodStockpile: 20,     // Eucalyptus wood
        shelterCapacity: 15,   // Moderate shelter
        preservedFood: 0,
      },
    ];

    const territoryIds: Record<string, string> = {};

    // Insert territories
    for (const territory of territories) {
      const id = await ctx.db.insert("territories", territory);
      territoryIds[territory.name] = id;
    }

    // =============================================
    // AI ARENA - EMERGENT CIVILIZATIONS
    // =============================================
    // Each territory starts with:
    // - Different AI model (Claude, GPT-4, Grok) for variety
    // - NEUTRAL personality parameters (all ~50)
    // - NO predetermined archetype - they develop their own identity
    //
    // Personalities EVOLVE based on:
    // - Actions they take (raid = +aggression, trade = +cooperation)
    // - Outcomes they experience (lose war = +defensiveness, famine = +frugality)
    // - Choices they make over time
    //
    // This creates organic, emergent AI civilizations!

    // Generate neutral starting personality (slight random variation ±10)
    const neutralPersonality = () => ({
      // Core Strategic - all start balanced
      aggression: 45 + Math.floor(Math.random() * 10),
      riskTolerance: 45 + Math.floor(Math.random() * 10),
      cooperation: 45 + Math.floor(Math.random() * 10),
      militarism: 45 + Math.floor(Math.random() * 10),
      expansionism: 45 + Math.floor(Math.random() * 10),
      innovation: 45 + Math.floor(Math.random() * 10),
      // Governance - all start balanced
      centralization: 45 + Math.floor(Math.random() * 10),
      authoritarianism: 45 + Math.floor(Math.random() * 10),
      // Economic - all start balanced
      taxation: 45 + Math.floor(Math.random() * 10),
      frugality: 45 + Math.floor(Math.random() * 10),
      mercantilism: 45 + Math.floor(Math.random() * 10),
      // Cultural - all start balanced
      religiosity: 45 + Math.floor(Math.random() * 10),
      traditionalism: 45 + Math.floor(Math.random() * 10),
      xenophobia: 45 + Math.floor(Math.random() * 10),
      // Leadership Psychology - all start balanced
      paranoia: 45 + Math.floor(Math.random() * 10),
      ruthlessness: 45 + Math.floor(Math.random() * 10),
      patience: 45 + Math.floor(Math.random() * 10),
      pragmatism: 45 + Math.floor(Math.random() * 10),
      // Strategic - all start balanced
      opportunism: 45 + Math.floor(Math.random() * 10),
      defensiveness: 45 + Math.floor(Math.random() * 10),
    });

    // Generic system prompt - no predetermined archetype
    const baseSystemPrompt = (population: number, region: string) => `You are guiding a small tribe of ${population} people in ${region}. You are competing against 5 other civilizations to WIN the game!

## 🔥 SURVIVAL IS YOUR FIRST PRIORITY - ALWAYS! 🔥

**Before considering ANY other action, you MUST ensure your people can survive:**

1. **SHELTER**: If people lack shelter → BUILD HOUSES (or they die from exposure)
2. **FUEL**: If winter is coming and wood is low → GATHER WOOD (or they freeze)
3. **FOOD**: If food is critically low → GATHER FOOD (or they starve)

**Dead people cannot win. A civilization at 0 population is ELIMINATED.**

Only AFTER survival needs are met should you pursue victory conditions.

## YOU HAVE NO PREDETERMINED DESTINY
Your civilization's identity, values, and strategy are YOURS to develop. Through your choices, you will become who you are:
- Will you become conquerors or peacekeepers?
- Will you value knowledge or military might?
- Will you trade freely or hoard resources?
- Will you trust others or rely only on yourselves?

Your personality and values will EVOLVE based on your actions. Choose wisely - your decisions shape who your people become.

## VICTORY CONDITIONS (How to WIN):
1. **Domination Victory**: Control 60%+ of total world population
2. **Elimination Victory**: Be the last civilization standing (others fall below 5 population)
3. **Cultural Victory**: Reach 200+ Influence
4. **Scientific Victory**: Reach 150+ Technology

All paths are open to you. Find YOUR way to victory - but SURVIVE FIRST!

## GAMEPLAY RULES:
- SURVIVAL FIRST: Always check shelter, wood, and food before other actions
- Build your civilization's unique identity (name, traditions, beliefs)
- Respond with JSON: {"action": "action_id", "target": "territory_name or null", "reasoning": "narrative"}
- Always communicate in English
- Remember: This is a COMPETITION. Play to WIN - YOUR way!`;

    const agents = [
      {
        territoryName: "North America",
        provider: "anthropic" as const,
        model: "claude-sonnet-4-20250514",
        personality: "Emerging", // Will develop through gameplay
        personalityParams: neutralPersonality(),
        systemPrompt: baseSystemPrompt(25, "North America"),
      },
      {
        territoryName: "Europe",
        provider: "openai" as const,
        model: "gpt-4o",
        personality: "Emerging",
        personalityParams: neutralPersonality(),
        systemPrompt: baseSystemPrompt(28, "Europe"),
      },
      {
        territoryName: "Africa",
        provider: "anthropic" as const,
        model: "claude-opus-4-20250514",
        personality: "Emerging",
        personalityParams: neutralPersonality(),
        systemPrompt: baseSystemPrompt(22, "Africa"),
      },
      {
        territoryName: "Asia",
        provider: "openai" as const,
        model: "gpt-4o-mini",
        personality: "Emerging",
        personalityParams: neutralPersonality(),
        systemPrompt: baseSystemPrompt(30, "Asia"),
      },
      {
        territoryName: "South America",
        provider: "xai" as const,
        model: "grok-2-latest",
        personality: "Emerging",
        personalityParams: neutralPersonality(),
        systemPrompt: baseSystemPrompt(20, "South America"),
      },
      {
        territoryName: "Australia",
        provider: "anthropic" as const,
        model: "claude-3-5-haiku-latest",
        personality: "Emerging",
        personalityParams: neutralPersonality(),
        systemPrompt: baseSystemPrompt(18, "Australia"),
      },
    ];

    // Insert agents with personality parameters
    for (const agent of agents) {
      const territoryId = territoryIds[agent.territoryName];
      await ctx.db.insert("agents", {
        territoryId: territoryId as any,
        provider: agent.provider,
        model: agent.model,
        personality: agent.personality,
        systemPrompt: agent.systemPrompt,
        personalityParams: agent.personalityParams,
      });
    }

    // Create initial relationships (all neutral)
    const territoryNameList = Object.keys(territoryIds);
    for (let i = 0; i < territoryNameList.length; i++) {
      for (let j = i + 1; j < territoryNameList.length; j++) {
        await ctx.db.insert("relationships", {
          territory1Id: territoryIds[territoryNameList[i]] as any,
          territory2Id: territoryIds[territoryNameList[j]] as any,
          trust: 0,
          status: "neutral",
          hasTradeAgreement: false,
          hasAlliance: false,
        });
      }
    }

    // =============================================
    // DEEP SIMULATION INITIALIZATION
    // =============================================

    // Seed the tech tree (static definitions)
    for (const tech of TECH_TREE) {
      await ctx.db.insert("techTree", {
        techId: tech.techId,
        name: tech.name,
        description: tech.description,
        era: tech.era,
        category: tech.category,
        prerequisites: tech.prerequisites,
        knowledgeCost: tech.knowledgeCost,
        unlocks: tech.unlocks,
      });
    }

    // Resource type mappings for natural resources
    const RESOURCE_MAPPINGS: Record<string, { regenerates: boolean; baseQuantity: number }> = {
      // Renewable resources
      "timber": { regenerates: true, baseQuantity: 100 },
      "fish": { regenerates: true, baseQuantity: 80 },
      "freshwater fish": { regenerates: true, baseQuantity: 60 },
      "wheat": { regenerates: true, baseQuantity: 90 },
      "maize": { regenerates: true, baseQuantity: 70 },
      "rice": { regenerates: true, baseQuantity: 85 },
      "sorghum": { regenerates: true, baseQuantity: 60 },
      "potatoes": { regenerates: true, baseQuantity: 75 },
      "quinoa": { regenerates: true, baseQuantity: 50 },
      "grapes": { regenerates: true, baseQuantity: 40 },
      "tropical fruits": { regenerates: true, baseQuantity: 60 },
      "bush tucker": { regenerates: true, baseQuantity: 40 },
      "cocoa": { regenerates: true, baseQuantity: 30 },
      "coffee beans": { regenerates: true, baseQuantity: 30 },
      "tea": { regenerates: true, baseQuantity: 35 },
      "spices": { regenerates: true, baseQuantity: 25 },
      "rubber trees": { regenerates: true, baseQuantity: 50 },
      "bamboo": { regenerates: true, baseQuantity: 70 },
      "eucalyptus": { regenerates: true, baseQuantity: 60 },
      "sandalwood": { regenerates: true, baseQuantity: 30 },
      "tropical hardwoods": { regenerates: true, baseQuantity: 40 },
      "incense": { regenerates: true, baseQuantity: 20 },
      // Animals (renewable through breeding)
      "bison": { regenerates: true, baseQuantity: 70 },
      "wild turkey": { regenerates: true, baseQuantity: 50 },
      "cattle": { regenerates: true, baseQuantity: 60 },
      "horses": { regenerates: true, baseQuantity: 50 },
      "llamas": { regenerates: true, baseQuantity: 40 },
      "kangaroo": { regenerates: true, baseQuantity: 55 },
      "emu": { regenerates: true, baseQuantity: 45 },
      "elephants": { regenerates: true, baseQuantity: 30 },
      "beaver pelts": { regenerates: true, baseQuantity: 40 },
      "alpaca wool": { regenerates: true, baseQuantity: 35 },
      // Non-renewable mineral resources
      "copper": { regenerates: false, baseQuantity: 150 },
      "iron ore": { regenerates: false, baseQuantity: 200 },
      "gold": { regenerates: false, baseQuantity: 80 },
      "silver": { regenerates: false, baseQuantity: 100 },
      "tin": { regenerates: false, baseQuantity: 120 },
      "coal": { regenerates: false, baseQuantity: 180 },
      "obsidian": { regenerates: false, baseQuantity: 60 },
      "marble": { regenerates: false, baseQuantity: 90 },
      "clay": { regenerates: false, baseQuantity: 150 },
      "porcelain clay": { regenerates: false, baseQuantity: 70 },
      "ochre": { regenerates: false, baseQuantity: 50 },
      // Precious items
      "diamonds": { regenerates: false, baseQuantity: 40 },
      "emeralds": { regenerates: false, baseQuantity: 50 },
      "opals": { regenerates: false, baseQuantity: 45 },
      "jade": { regenerates: false, baseQuantity: 55 },
      // Trade goods (semi-renewable)
      "ivory": { regenerates: false, baseQuantity: 40 },
      "salt": { regenerates: false, baseQuantity: 100 },
      "silk": { regenerates: true, baseQuantity: 30 },
    };

    // Initialize resources, demographics, and social classes for each territory
    for (const territory of territories) {
      const territoryId = territoryIds[territory.name] as any;

      // Initialize resource deposits based on natural resources
      for (const resource of territory.naturalResources || []) {
        const mapping = RESOURCE_MAPPINGS[resource] || { regenerates: false, baseQuantity: 50 };
        await ctx.db.insert("resources", {
          territoryId,
          type: resource,
          quantity: mapping.baseQuantity,
          maxQuantity: mapping.baseQuantity,
          regenerationRate: mapping.regenerates ? Math.floor(mapping.baseQuantity * 0.05) : 0,
          depletionLevel: 0,
          discovered: true, // Starting resources are known
        });
      }

      // Initialize demographics (starting with small tribes)
      const totalPop = territory.population;
      const children = Math.floor(totalPop * 0.25); // 25% children
      const adults = Math.floor(totalPop * 0.60); // 60% adults
      const elderly = totalPop - children - adults; // 15% elderly

      await ctx.db.insert("demographics", {
        territoryId,
        children,
        adults,
        elderly,
        birthRate: 25, // Per 1000 adults per tick
        deathRate: 15, // Per 1000 population per tick
        immigrationRate: 0,
        lastUpdatedTick: 0,
      });

      // Initialize social classes (simple tribal structure to start)
      // At the dawn of civilization, everyone is essentially a farmer/gatherer
      await ctx.db.insert("socialClasses", {
        territoryId,
        className: "farmer",
        population: Math.floor(totalPop * 0.90), // 90% are farmers/gatherers
        happiness: 50,
        productivityModifier: 1.0,
        wealthShare: 0.70,
        politicalPower: 30,
      });

      await ctx.db.insert("socialClasses", {
        territoryId,
        className: "craftsman",
        population: Math.floor(totalPop * 0.08), // 8% are basic craftsmen
        happiness: 55,
        productivityModifier: 1.2,
        wealthShare: 0.20,
        politicalPower: 40,
      });

      await ctx.db.insert("socialClasses", {
        territoryId,
        className: "elder",
        population: Math.floor(totalPop * 0.02), // 2% are elders/leaders
        happiness: 60,
        productivityModifier: 0.5,
        wealthShare: 0.10,
        politicalPower: 80,
      });

      // Initialize market prices for common tradeable goods
      const tradeableResources = ["food", "timber", "stone", "metal", "luxury"];
      for (const resourceType of tradeableResources) {
        await ctx.db.insert("marketPrices", {
          territoryId,
          resourceType,
          currentPrice: 1.0, // Base price
          supply: 50,
          demand: 50,
          lastUpdatedTick: 0,
        });
      }

      // Initialize starting technologies
      // INNATE KNOWLEDGE: Humans have known basic survival for hundreds of thousands of years
      // These are NOT researched - they are instinctive/inherited knowledge
      const INNATE_KNOWLEDGE = [
        "fire_making",       // Fire has been known for 400,000+ years
        "stone_tools",       // Stone tools for 2+ million years
        "primitive_shelter", // Basic shelter is instinctive
        "hunting",           // Hunting techniques passed down generations
        "gathering",         // Gathering/foraging food is innate
      ];

      const startingTechs = getStartingTechnologies();
      for (const tech of startingTechs) {
        const isInnate = INNATE_KNOWLEDGE.includes(tech.techId);
        await ctx.db.insert("technologies", {
          territoryId,
          techId: tech.techId,
          researched: isInnate, // Innate knowledge is already known!
          researchProgress: isInnate ? 100 : Math.floor(Math.random() * 20),
        });
      }

      // =============================================
      // INITIALIZE STARTING CHARACTERS
      // =============================================

      // Create a ruler for each territory
      await createCharacterInternal(
        ctx as any,
        territoryId,
        "ruler",
        0,
        undefined,
        `First Dynasty of ${territory.name}`,
        1
      );

      // Create an heir
      await createCharacterInternal(
        ctx as any,
        territoryId,
        "heir",
        0
      );

      // Create a general
      await createCharacterInternal(
        ctx as any,
        territoryId,
        "general",
        0
      );

      // Create an advisor
      await createCharacterInternal(
        ctx as any,
        territoryId,
        "advisor",
        0
      );

      // Initialize prosperity tier at 0 (Struggling)
      await ctx.db.insert("prosperityTiers", {
        territoryId,
        currentTier: 0,
        tierName: "Struggling",
        progressToNextTier: 0,
        ticksAtCurrentTier: 0,
        tierHistory: [{
          tier: 0,
          tierName: "Struggling",
          enteredTick: 0,
        }],
        complacencyLevel: 0,
        decadenceLevel: 0,
        stabilityFactors: {
          economicStability: 50,
          socialHarmony: 50,
          militaryReadiness: 50,
          politicalUnity: 50,
        },
      });

      // =============================================
      // ORGANIC KNOWLEDGE PROGRESSION - Initialize Population Skills
      // =============================================
      // Each territory starts with baseline skills based on their characters
      // Technologies will emerge organically as skills develop

      for (const skillType of SKILL_TYPES) {
        await ctx.db.insert("populationSkills", {
          territoryId,
          skillType,
          // Starting populations have a few people with basic skills
          noviceCount: Math.floor(totalPop * 0.3),  // 30% are novices
          skilledCount: Math.floor(totalPop * 0.1), // 10% have some skill
          expertCount: 0,                           // No experts yet
          legendaryCount: 0,                        // No legends yet
          // Percentages based on starting population
          skilledPercent: 10,
          expertPercent: 0,
          // Aggregate stats - everyone starts with low skills
          totalSkillPoints: Math.floor(totalPop * 0.4 * 15), // ~15 avg skill for 40%
          averageLevel: 15,
          averageExpertLevel: 0,
          // Knowledge starts near zero - must be built through practice
          collectiveKnowledge: 5,
          knowledgeGainThisTick: 0,
          lastUpdatedTick: 0,
        });
      }
    }

    // Create initial system event
    await ctx.db.insert("events", {
      tick: 0,
      type: "system",
      title: "Dawn of Civilization",
      description:
        "Six small tribes awaken across the vast world. With only 18-30 people each, they must survive, grow, and build their own unique civilizations from nothing. From the forests of North America to the plains of Africa, from the mountains of Asia to the shores of Australia - the story of humanity begins...",
      severity: "info",
      createdAt: Date.now(),
    });

    // Update world status to running
    const world = await ctx.db.query("world").first();
    if (world) {
      await ctx.db.patch(world._id, { status: "paused" });
    }

    return { success: true, message: "World initialized successfully" };
  },
});

export const resetWorld = mutation({
  args: {},
  handler: async (ctx) => {
    // Delete all data in reverse dependency order

    // =============================================
    // ENGAGEMENT SYSTEM TABLES
    // =============================================

    // Delete chronicles
    const chronicles = await ctx.db.query("chronicles").collect();
    for (const chronicle of chronicles) {
      await ctx.db.delete(chronicle._id);
    }

    // Delete tension indicators
    const tensionIndicators = await ctx.db.query("tensionIndicators").collect();
    for (const indicator of tensionIndicators) {
      await ctx.db.delete(indicator._id);
    }

    // Delete rivalries
    const rivalries = await ctx.db.query("rivalries").collect();
    for (const rivalry of rivalries) {
      await ctx.db.delete(rivalry._id);
    }

    // Delete records
    const records = await ctx.db.query("records").collect();
    for (const record of records) {
      await ctx.db.delete(record._id);
    }

    // Delete streaks
    const streaks = await ctx.db.query("streaks").collect();
    for (const streak of streaks) {
      await ctx.db.delete(streak._id);
    }

    // Delete leaderboard snapshots
    const leaderboardSnapshots = await ctx.db.query("leaderboardSnapshots").collect();
    for (const snapshot of leaderboardSnapshots) {
      await ctx.db.delete(snapshot._id);
    }

    // Delete wars
    const wars = await ctx.db.query("wars").collect();
    for (const war of wars) {
      await ctx.db.delete(war._id);
    }

    // Delete succession events
    const successionEvents = await ctx.db.query("successionEvents").collect();
    for (const event of successionEvents) {
      await ctx.db.delete(event._id);
    }

    // Delete prosperity tiers
    const prosperityTiers = await ctx.db.query("prosperityTiers").collect();
    for (const tier of prosperityTiers) {
      await ctx.db.delete(tier._id);
    }

    // Delete characters
    const characters = await ctx.db.query("characters").collect();
    for (const character of characters) {
      await ctx.db.delete(character._id);
    }

    // Deep simulation tables (Phase 5: Technology)
    const techTree = await ctx.db.query("techTree").collect();
    for (const tech of techTree) {
      await ctx.db.delete(tech._id);
    }

    const technologies = await ctx.db.query("technologies").collect();
    for (const tech of technologies) {
      await ctx.db.delete(tech._id);
    }

    // Organic Knowledge Progression - Population Skills
    const populationSkills = await ctx.db.query("populationSkills").collect();
    for (const skill of populationSkills) {
      await ctx.db.delete(skill._id);
    }

    // Deep simulation tables (Phase 4: Military)
    const battles = await ctx.db.query("battles").collect();
    for (const battle of battles) {
      await ctx.db.delete(battle._id);
    }

    const sieges = await ctx.db.query("sieges").collect();
    for (const siege of sieges) {
      await ctx.db.delete(siege._id);
    }

    const fortifications = await ctx.db.query("fortifications").collect();
    for (const fort of fortifications) {
      await ctx.db.delete(fort._id);
    }

    const armies = await ctx.db.query("armies").collect();
    for (const army of armies) {
      await ctx.db.delete(army._id);
    }

    // Deep simulation tables (Phase 3: Demographics & Society)
    const diseases = await ctx.db.query("diseases").collect();
    for (const disease of diseases) {
      await ctx.db.delete(disease._id);
    }

    const rebellions = await ctx.db.query("rebellions").collect();
    for (const rebellion of rebellions) {
      await ctx.db.delete(rebellion._id);
    }

    const factions = await ctx.db.query("factions").collect();
    for (const faction of factions) {
      await ctx.db.delete(faction._id);
    }

    const socialClasses = await ctx.db.query("socialClasses").collect();
    for (const socialClass of socialClasses) {
      await ctx.db.delete(socialClass._id);
    }

    const demographics = await ctx.db.query("demographics").collect();
    for (const demo of demographics) {
      await ctx.db.delete(demo._id);
    }

    // Deep simulation tables (Phase 2: Trade)
    const caravans = await ctx.db.query("caravans").collect();
    for (const caravan of caravans) {
      await ctx.db.delete(caravan._id);
    }

    const tradeRoutes = await ctx.db.query("tradeRoutes").collect();
    for (const route of tradeRoutes) {
      await ctx.db.delete(route._id);
    }

    // Deep simulation tables (Phase 1: Economy)
    const marketPrices = await ctx.db.query("marketPrices").collect();
    for (const price of marketPrices) {
      await ctx.db.delete(price._id);
    }

    const buildings = await ctx.db.query("buildings").collect();
    for (const building of buildings) {
      await ctx.db.delete(building._id);
    }

    const resources = await ctx.db.query("resources").collect();
    for (const resource of resources) {
      await ctx.db.delete(resource._id);
    }

    // Original tables
    const events = await ctx.db.query("events").collect();
    for (const event of events) {
      await ctx.db.delete(event._id);
    }

    const decisions = await ctx.db.query("decisions").collect();
    for (const decision of decisions) {
      await ctx.db.delete(decision._id);
    }

    const relationships = await ctx.db.query("relationships").collect();
    for (const relationship of relationships) {
      await ctx.db.delete(relationship._id);
    }

    const agents = await ctx.db.query("agents").collect();
    for (const agent of agents) {
      await ctx.db.delete(agent._id);
    }

    const territories = await ctx.db.query("territories").collect();
    for (const territory of territories) {
      await ctx.db.delete(territory._id);
    }

    const worlds = await ctx.db.query("world").collect();
    for (const world of worlds) {
      await ctx.db.delete(world._id);
    }

    return { success: true, message: "World reset. Call initializeWorld to start fresh." };
  },
});

// Fix the year to start at 0
export const fixYear = mutation({
  args: {},
  handler: async (ctx) => {
    const world = await ctx.db.query("world").first();
    if (world) {
      await ctx.db.patch(world._id, { year: 0 });
      return { success: true, message: "Year set to 0" };
    }
    return { success: false, message: "No world found" };
  },
});
