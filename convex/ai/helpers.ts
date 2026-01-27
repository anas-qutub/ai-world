import { internalQuery, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { calculateActionEffects } from "../simulation/resources";
import { Doc, Id } from "../_generated/dataModel";
import { createBuilding } from "../simulation/buildings";
import { establishTradeRoute, sendCaravan, raidCaravans, patrolTradeRoutes } from "../simulation/trade";
import { promoteBirths } from "../simulation/demographics";
import { classReform, appeaseFaction, suppressFaction, createFaction } from "../simulation/society";
import { quarantine } from "../simulation/disease";
import { createArmy, raiseMilitia, recruitSoldiers, moveArmy, supplyArmy } from "../simulation/military";
import { startSiege, assaultWalls, buildFortification } from "../simulation/siege";
import { researchTechnology, shareTechnology, stealTechnology, establishAcademy } from "../simulation/technology";
import { prospectResources } from "../simulation/economy";

// Internal queries for AI decision-making

export const getAgent = internalQuery({
  args: { agentId: v.id("agents") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.agentId);
  },
});

export const getTerritory = internalQuery({
  args: { territoryId: v.id("territories") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.territoryId);
  },
});

export const getWorld = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("world").first();
  },
});

export const getAllTerritories = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("territories").collect();
  },
});

export const getTerritoryRelationships = internalQuery({
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

    // Get territory names
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
      otherTerritoryId:
        rel.territory1Id === args.territoryId ? rel.territory2Id : rel.territory1Id,
      otherTerritoryName:
        rel.territory1Id === args.territoryId
          ? territoryNames.get(rel.territory2Id)
          : territoryNames.get(rel.territory1Id),
    }));
  },
});

export const getRecentDecisions = internalQuery({
  args: {
    territoryId: v.id("territories"),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("decisions")
      .withIndex("by_territory", (q) => q.eq("territoryId", args.territoryId))
      .order("desc")
      .take(args.limit);
  },
});

// Handle cultural and governance actions - extract and store identity info
async function handleCulturalAction(
  ctx: any,
  action: string,
  territoryId: any,
  reasoning: string,
  tick?: number
): Promise<void> {
  const updates: any = {};
  const territory = await ctx.db.get(territoryId);

  switch (action) {
    case "name_tribe":
      // Store the reasoning as it likely contains the tribe name
      const tribeName = extractNameFromReasoning(reasoning, "tribe");
      if (tribeName) {
        updates.tribeName = tribeName;
      }
      // Also check for origin story
      const originStory = extractOriginStory(reasoning);
      if (originStory) {
        updates.originStory = originStory;
      }
      break;

    case "establish_council":
      updates.governance = "council";
      updates.governmentName = extractGovernmentName(reasoning) || "Elder Council";
      break;

    case "establish_chief":
      updates.governance = "chiefdom";
      updates.governmentName = extractGovernmentName(reasoning) || "Chiefdom";
      updates.leaderName = extractNameFromReasoning(reasoning, "leader");
      break;

    case "establish_democracy":
      updates.governance = "democracy";
      updates.governmentName = extractGovernmentName(reasoning) || "Democracy";
      break;

    case "establish_dictatorship":
      updates.governance = "dictatorship";
      updates.governmentName = extractGovernmentName(reasoning) || "Dictatorship";
      updates.leaderName = extractNameFromReasoning(reasoning, "leader");
      break;

    case "establish_theocracy":
      updates.governance = "theocracy";
      updates.governmentName = extractGovernmentName(reasoning) || "Theocracy";
      updates.leaderName = extractNameFromReasoning(reasoning, "leader");
      // Check for beliefs
      const beliefs = extractBeliefs(reasoning);
      if (beliefs) {
        updates.beliefs = beliefs;
      }
      break;

    case "change_government":
      // The reasoning should describe the new system
      const newGovName = extractGovernmentName(reasoning);
      if (newGovName) {
        updates.governmentName = newGovName;
      }
      break;

    case "create_culture":
      // Extract multiple cultural elements

      // 1. Extract language words
      const newWords = extractLanguageWords(reasoning);
      if (newWords.length > 0) {
        const existingWords = territory?.languageWords || [];
        // Merge new words, avoiding duplicates
        const wordSet = new Set(existingWords.map((w: any) => w.word.toLowerCase()));
        const uniqueNewWords = newWords.filter(w => !wordSet.has(w.word.toLowerCase()));
        updates.languageWords = [...existingWords, ...uniqueNewWords];
      }

      // 2. Extract traditions
      const newTraditions = extractTraditions(reasoning, tick);
      if (newTraditions.length > 0) {
        const existingTraditions = territory?.traditions || [];
        updates.traditions = [...existingTraditions, ...newTraditions];
      }

      // 3. Extract flag description
      const flagDescription = extractFlag(reasoning);
      if (flagDescription && !territory?.flag) {
        updates.flag = flagDescription;
      }

      // 4. Extract beliefs
      const cultureBeliefs = extractBeliefs(reasoning);
      if (cultureBeliefs) {
        const existingBeliefs = territory?.beliefs;
        updates.beliefs = existingBeliefs
          ? `${existingBeliefs}\n${cultureBeliefs}`
          : cultureBeliefs;
      }

      // 5. Store general language notes if we detect language creation
      const languageNotes = extractLanguageNotes(reasoning);
      if (languageNotes && !territory?.languageNotes) {
        updates.languageNotes = languageNotes;
      }
      break;
  }

  if (Object.keys(updates).length > 0) {
    await ctx.db.patch(territoryId, updates);
  }
}

// Extract language words from reasoning
function extractLanguageWords(reasoning: string): Array<{word: string; meaning: string; type?: string}> {
  const words: Array<{word: string; meaning: string; type?: string}> = [];

  // Pattern: "word" means "meaning" or word (meaning) or "word" - meaning
  const patterns = [
    // "Kairu" means "hello" / "Kairu" meaning "hello"
    /["']([A-Za-z]+)["']\s+(?:means?|meaning)\s+["']?([^"'\n,]+)["']?/gi,
    // Kairu (hello) or Kairu ("hello")
    /\b([A-Z][a-z]+)\s+\(["']?([^)"']+)["']?\)/g,
    // "Kairu" - hello / "Kairu": hello
    /["']([A-Za-z]+)["']\s*[-:]\s*["']?([^"'\n,]+)["']?/g,
    // greeting: "Kairu" or word for hello: "Kairu"
    /(?:word for |our word for |greeting[s]?[:]?\s*)["']?([^"'\n,]+)["']?\s+(?:is\s+)?["']([A-Za-z]+)["']/gi,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(reasoning)) !== null) {
      const word = match[1].trim();
      const meaning = match[2].trim();

      // Determine type based on context
      let type: string | undefined;
      const lowerContext = reasoning.toLowerCase();
      if (lowerContext.includes("greeting") || meaning.toLowerCase().includes("hello") || meaning.toLowerCase().includes("welcome")) {
        type = "greeting";
      } else if (meaning.toLowerCase().includes("thank") || meaning.toLowerCase().includes("peace")) {
        type = "phrase";
      }

      // Validate it looks like a real word (not common English)
      const commonWords = ["the", "and", "for", "our", "this", "that", "with", "from"];
      if (word.length >= 3 && !commonWords.includes(word.toLowerCase())) {
        words.push({ word, meaning, type });
      }
    }
  }

  return words;
}

// Extract traditions from reasoning
function extractTraditions(reasoning: string, tick?: number): Array<{name: string; description: string; createdAtTick?: number}> {
  const traditions: Array<{name: string; description: string; createdAtTick?: number}> = [];

  // Look for tradition patterns
  const patterns = [
    // "The Festival of X" or "X Festival" - description
    /(?:the\s+)?([A-Z][a-zA-Z\s]+(?:Festival|Ceremony|Ritual|Celebration|Dance|Feast|Gathering))\s*[-:]\s*([^.]+\.)/gi,
    // tradition called "X": description
    /tradition\s+(?:called\s+)?["']([^"']+)["'][\s:,]*([^.]+\.)/gi,
    // We celebrate X by/with...
    /we\s+celebrate\s+([^.]+?)\s+(?:by|with|through)\s+([^.]+\.)/gi,
    // established the X tradition
    /establish(?:ed)?\s+(?:the\s+)?["']?([A-Z][a-zA-Z\s]+)["']?\s+tradition[,\s]*(?:where|in which|when)?\s*([^.]+\.)/gi,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(reasoning)) !== null) {
      const name = match[1].trim();
      const description = match[2].trim();

      if (name.length >= 3 && description.length >= 10) {
        traditions.push({ name, description, createdAtTick: tick });
      }
    }
  }

  return traditions;
}

// Extract flag description
function extractFlag(reasoning: string): string | undefined {
  const patterns = [
    // Our flag/symbol/banner is/shows/depicts...
    /(?:our|the)\s+(?:flag|symbol|banner|emblem)\s+(?:is|shows?|depicts?|features?|consists? of)\s+([^.]+\.)/i,
    // flag: description or flag - description
    /flag\s*[:–-]\s*([^.]+\.)/i,
    // designed a flag with/showing...
    /design(?:ed)?\s+(?:a|our|the)\s+flag\s+(?:with|showing|featuring|depicting)\s+([^.]+\.)/i,
  ];

  for (const pattern of patterns) {
    const match = reasoning.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return undefined;
}

// Extract beliefs from reasoning
function extractBeliefs(reasoning: string): string | undefined {
  const patterns = [
    // We believe (in)...
    /we\s+believe\s+(?:in\s+)?([^.]+\.)/i,
    // Our faith/beliefs center on...
    /our\s+(?:faith|beliefs?|spirituality)\s+(?:centers?|focus(?:es)?)\s+(?:on|around)\s+([^.]+\.)/i,
    // worship/honor/revere the...
    /(?:worship|honor|revere)\s+(?:the\s+)?([^.]+\.)/i,
  ];

  for (const pattern of patterns) {
    const match = reasoning.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return undefined;
}

// Extract origin story from reasoning
function extractOriginStory(reasoning: string): string | undefined {
  const patterns = [
    // Our people came from... / Our ancestors...
    /(?:our people|our ancestors?|we)\s+(?:came from|originated|began|emerged)\s+([^.]+\.(?:[^.]+\.)?)/i,
    // The story of our beginning... / Legend says...
    /(?:the story|legend|myth|tale)\s+(?:of our|says|tells)\s+([^.]+\.(?:[^.]+\.)?)/i,
    // Long ago... / In the beginning...
    /(?:long ago|in the beginning|at the dawn)\s*,?\s*([^.]+\.(?:[^.]+\.)?)/i,
  ];

  for (const pattern of patterns) {
    const match = reasoning.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return undefined;
}

// Extract language notes from reasoning
function extractLanguageNotes(reasoning: string): string | undefined {
  const patterns = [
    // Our language/tongue is called... / We speak...
    /(?:our language|our tongue|we speak)\s+(?:is called|called|named)?\s*["']?([A-Z][a-zA-Z]+)["']?/i,
    // developed a language called...
    /develop(?:ed)?\s+(?:a|our)\s+language\s+called\s+["']?([A-Z][a-zA-Z]+)["']?/i,
  ];

  for (const pattern of patterns) {
    const match = reasoning.match(pattern);
    if (match && match[1]) {
      return `The language is called ${match[1]}`;
    }
  }

  return undefined;
}

// Extract government name from reasoning
function extractGovernmentName(reasoning: string): string | undefined {
  const patterns = [
    // called the X / named the X
    /(?:call(?:ed)?|nam(?:ed)?)\s+(?:it|our government|our system|this)\s+(?:the\s+)?["']?([A-Z][a-zA-Z\s]+)["']?/i,
    // establish the X
    /establish(?:ed)?\s+(?:the\s+)?["']?([A-Z][a-zA-Z\s]+(?:Council|Assembly|Circle|Order))["']?/i,
  ];

  for (const pattern of patterns) {
    const match = reasoning.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return undefined;
}

// Simple extraction of names from AI reasoning
function extractNameFromReasoning(reasoning: string, type: "tribe" | "leader"): string | undefined {
  // Look for patterns like "called X" or "named X" or "The X"
  // This is a simple heuristic - the AI's creativity will vary

  if (type === "tribe") {
    // Look for tribe name patterns
    const patterns = [
      /call(?:ed|ing)?\s+(?:ourselves?|them|the tribe)\s+(?:the\s+)?["']?([A-Z][a-zA-Z]+)["']?/i,
      /(?:the\s+)?["']?([A-Z][a-zA-Z]+)["']?\s+(?:people|tribe|clan|nation)/i,
      /named?\s+(?:the tribe|ourselves?|our people)\s+(?:the\s+)?["']?([A-Z][a-zA-Z]+)["']?/i,
      /we\s+are\s+(?:the\s+)?["']?([A-Z][a-zA-Z]+)["']?/i,
    ];

    for (const pattern of patterns) {
      const match = reasoning.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
  } else if (type === "leader") {
    // Look for leader name patterns
    const patterns = [
      /(?:chief|leader|ruler|dictator|shaman|elder)\s+["']?([A-Z][a-zA-Z]+)["']?/i,
      /["']?([A-Z][a-zA-Z]+)["']?\s+(?:will lead|shall lead|becomes? (?:our )?(?:chief|leader|ruler))/i,
      /appointed?\s+["']?([A-Z][a-zA-Z]+)["']?/i,
      /named?\s+["']?([A-Z][a-zA-Z]+)["']?\s+(?:as )?(?:our )?(?:chief|leader|ruler)/i,
    ];

    for (const pattern of patterns) {
      const match = reasoning.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
  }

  return undefined;
}

// Internal mutations

export const updateAgentLastDecision = internalMutation({
  args: { agentId: v.id("agents") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.agentId, {
      lastDecisionAt: Date.now(),
    });
  },
});

export const recordDecision = internalMutation({
  args: {
    territoryId: v.id("territories"),
    tick: v.number(),
    action: v.string(),
    targetTerritoryId: v.optional(v.id("territories")),
    reasoning: v.string(),
  },
  handler: async (ctx, args) => {
    const territory = await ctx.db.get(args.territoryId);
    if (!territory) {
      throw new Error("Territory not found");
    }

    let targetTerritory = null;
    if (args.targetTerritoryId) {
      targetTerritory = await ctx.db.get(args.targetTerritoryId);
    }

    // Handle governance and cultural actions - extract info from reasoning
    await handleCulturalAction(ctx, args.action, args.territoryId, args.reasoning, args.tick);

    // Apply action effects
    const effects = await applyActionEffects(
      ctx,
      args.action,
      territory,
      targetTerritory,
      args.reasoning
    );

    // Record the decision
    await ctx.db.insert("decisions", {
      territoryId: args.territoryId,
      tick: args.tick,
      action: args.action,
      targetTerritoryId: args.targetTerritoryId,
      reasoning: args.reasoning,
      effects,
      createdAt: Date.now(),
    });

    // Create an event for the activity feed
    const actionNames: Record<string, string> = {
      gather_food: "Gathered Food",
      build_shelter: "Built Shelter",
      explore_land: "Explored the Land",
      develop_tools: "Developed Tools",
      grow_community: "Focused on Growth",
      create_culture: "Created Culture",
      train_warriors: "Trained Warriors",
      send_scouts: "Sent Scouts",
      share_knowledge: "Shared Knowledge",
      trade_goods: "Traded Goods",
      show_strength: "Showed Strength",
      raid: "Raided",
      rest: "Rested",
      name_tribe: "Named Their People",
      establish_council: "Formed Elder Council",
      establish_chief: "Appointed a Chief",
      establish_democracy: "Established Democracy",
      establish_dictatorship: "Seized Power",
      establish_theocracy: "Established Theocracy",
      change_government: "Reformed Government",
      // War resolution
      propose_peace: "Proposed Peace",
      accept_peace: "Accepted Peace",
      surrender: "Surrendered",
      demand_surrender: "Demanded Surrender",
      form_alliance: "Formed Alliance",
      // Deep simulation - Economy
      build_farm: "Built Farm",
      build_mine: "Built Mine",
      build_workshop: "Built Workshop",
      build_market: "Built Market",
      set_tax_rate: "Adjusted Taxation",
      prospect_resources: "Prospected for Resources",
      // Deep simulation - Trade
      establish_trade_route: "Established Trade Route",
      send_caravan: "Sent Trade Caravan",
      raid_caravan: "Raided Caravans",
      patrol_routes: "Patrolled Trade Routes",
      // Deep simulation - Demographics
      promote_births: "Encouraged Population Growth",
      class_reform: "Reformed Social Classes",
      appease_faction: "Appeased Faction",
      suppress_faction: "Suppressed Faction",
      quarantine: "Declared Quarantine",
      // Deep simulation - Military
      raise_militia: "Raised Militia",
      recruit_soldiers: "Recruited Soldiers",
      build_fortifications: "Built Fortifications",
      move_army: "Moved Army",
      lay_siege: "Laid Siege",
      assault_walls: "Stormed the Walls",
      supply_army: "Resupplied Army",
      // Deep simulation - Technology
      research_technology: "Researched Technology",
      share_technology: "Shared Technology",
      steal_technology: "Attempted Espionage",
      establish_academy: "Established Academy",
      // Engagement - Character & Intrigue
      execute_character: "Executed Suspected Traitor",
      investigate_plot: "Investigated Plot",
      bribe_character: "Bribed Court Member",
      arrange_marriage: "Arranged Political Marriage",
      name_heir: "Named Official Heir",
      found_dynasty: "Founded Dynasty",
      purge_court: "Purged the Court",
      hold_feast: "Held Grand Feast",
      address_decadence: "Addressed Decadence",
      declare_vendetta: "Declared Vendetta",
      seek_reconciliation: "Sought Reconciliation",
    };

    const eventSeverity = getEventSeverity(args.action);
    const eventDescription = buildEventDescription(
      args.action,
      territory.name,
      targetTerritory?.name,
      args.reasoning
    );

    await ctx.db.insert("events", {
      tick: args.tick,
      type: "decision",
      territoryId: args.territoryId,
      targetTerritoryId: args.targetTerritoryId,
      title: `${territory.name}: ${actionNames[args.action] || args.action}`,
      description: eventDescription,
      severity: eventSeverity,
      createdAt: Date.now(),
    });

    return effects;
  },
});

async function applyActionEffects(
  ctx: any,
  action: string,
  territory: any,
  targetTerritory: any | null,
  reasoning?: string
): Promise<any> {
  const effects: any = {};

  // Apply self-targeting actions (basic actions from resources.ts)
  const basicSelfActions = [
    "gather_food", "build_shelter", "explore_land", "develop_tools",
    "grow_community", "create_culture", "train_warriors", "rest",
    "name_tribe", "establish_council", "establish_chief", "establish_democracy",
    "establish_dictatorship", "establish_theocracy", "change_government"
  ];

  if (basicSelfActions.includes(action)) {
    const changes = calculateActionEffects(action, territory);
    if (Object.keys(changes).length > 0) {
      await ctx.db.patch(territory._id, changes);
      effects.selfChanges = changes;
    }
  }

  // Get current tick for deep simulation actions
  const world = await ctx.db.query("world").first();
  const currentTick = world?.tick || 0;

  // =============================================
  // DEEP SIMULATION - ECONOMY ACTIONS
  // =============================================

  if (action === "build_farm") {
    const result = await createBuilding(ctx, territory._id, "farm", currentTick);
    effects.buildingResult = result;
    if (result.success) {
      await ctx.db.patch(territory._id, {
        food: territory.food + 5, // Initial boost - no cap
      });
    }
  }

  if (action === "build_mine") {
    const result = await createBuilding(ctx, territory._id, "mine", currentTick);
    effects.buildingResult = result;
  }

  if (action === "build_workshop") {
    const result = await createBuilding(ctx, territory._id, "workshop", currentTick);
    effects.buildingResult = result;
  }

  if (action === "build_market") {
    const result = await createBuilding(ctx, territory._id, "market", currentTick);
    effects.buildingResult = result;
    if (result.success) {
      await ctx.db.patch(territory._id, {
        wealth: territory.wealth + 3, // No cap
      });
    }
  }

  if (action === "set_tax_rate") {
    // For now, just provide economic effects
    // Can be expanded with actual tax rate tracking
    await ctx.db.patch(territory._id, {
      wealth: territory.wealth + 3, // No cap
      happiness: Math.max(0, territory.happiness - 2),
    });
    effects.taxAdjusted = true;
  }

  if (action === "prospect_resources") {
    const result = await prospectResources(ctx, territory._id);
    effects.prospectResult = result;
    if (result.found) {
      await ctx.db.patch(territory._id, {
        knowledge: territory.knowledge + 3, // No cap
      });
    }
  }

  // =============================================
  // DEEP SIMULATION - TRADE ACTIONS
  // =============================================

  if (action === "patrol_routes") {
    const result = await patrolTradeRoutes(ctx, territory._id, territory.military * 0.2);
    effects.patrolResult = result;
    await ctx.db.patch(territory._id, {
      military: Math.max(0, territory.military - 2), // Uses some military
    });
  }

  // =============================================
  // DEEP SIMULATION - DEMOGRAPHICS ACTIONS
  // =============================================

  if (action === "promote_births") {
    const result = await promoteBirths(ctx, territory._id, currentTick);
    effects.birthsPromoted = result;
    await ctx.db.patch(territory._id, {
      happiness: territory.happiness + 2, // No cap
      food: Math.max(0, territory.food - 3), // Extra food for families
    });
  }

  if (action === "class_reform") {
    // Default to redistribute_wealth, could be parameterized
    const result = await classReform(ctx, territory._id, "redistribute_wealth");
    effects.reformResult = result;
  }

  if (action === "appease_faction") {
    // Find most rebellious faction
    const factions = await ctx.db
      .query("factions")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", territory._id))
      .collect();

    if (factions.length > 0) {
      const mostRebellious = factions.reduce((max: typeof factions[0], f: typeof factions[0]) => f.rebellionRisk > max.rebellionRisk ? f : max);
      const result = await appeaseFaction(ctx, mostRebellious._id, "gold");
      effects.appeaseResult = result;
      await ctx.db.patch(territory._id, {
        wealth: Math.max(0, territory.wealth - 5), // Cost of appeasement
      });
    }
  }

  if (action === "suppress_faction") {
    const factions = await ctx.db
      .query("factions")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", territory._id))
      .collect();

    if (factions.length > 0) {
      const target = factions.reduce((max: typeof factions[0], f: typeof factions[0]) => f.rebellionRisk > max.rebellionRisk ? f : max);
      const result = await suppressFaction(ctx, target._id, territory.military);
      effects.suppressResult = result;
    }
  }

  if (action === "quarantine") {
    const result = await quarantine(ctx, territory._id, currentTick);
    effects.quarantineResult = result;
  }

  // =============================================
  // DEEP SIMULATION - MILITARY ACTIONS
  // =============================================

  if (action === "raise_militia") {
    const count = Math.floor(territory.population * 0.1); // 10% of pop
    const result = await raiseMilitia(ctx, territory._id, count, currentTick);
    effects.militiaResult = result;
    if (result.success) {
      await ctx.db.patch(territory._id, {
        military: territory.military + result.actualCount, // No cap
      });
    }
  }

  if (action === "recruit_soldiers") {
    // First check if we have an army, if not create one
    let army = await ctx.db
      .query("armies")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", territory._id))
      .filter((q: any) => q.neq(q.field("status"), "disbanded"))
      .first();

    if (!army) {
      const createResult = await createArmy(ctx, territory._id, [{ type: "infantry", count: 5 }], currentTick);
      if (createResult.success && createResult.armyId) {
        army = await ctx.db.get(createResult.armyId);
      }
    }

    if (army) {
      const result = await recruitSoldiers(ctx, army._id, "infantry", 5);
      effects.recruitResult = result;
      if (result.success) {
        await ctx.db.patch(territory._id, {
          military: territory.military + 5, // No cap
        });
      }
    }
  }

  if (action === "build_fortifications") {
    // Build the next level of fortification
    const existing = await ctx.db
      .query("fortifications")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", territory._id))
      .first();

    let fortType: "palisade" | "wooden_wall" | "stone_wall" | "castle" = "palisade";
    if (existing) {
      const typeOrder: ("palisade" | "wooden_wall" | "stone_wall" | "castle")[] = ["palisade", "wooden_wall", "stone_wall", "castle"];
      const currentIndex = typeOrder.indexOf(existing.type as any);
      if (currentIndex < typeOrder.length - 1) {
        fortType = typeOrder[currentIndex + 1];
      }
    }

    const result = await buildFortification(ctx, territory._id, fortType, currentTick);
    effects.fortificationResult = result;
  }

  if (action === "supply_army") {
    const army = await ctx.db
      .query("armies")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", territory._id))
      .filter((q: any) => q.neq(q.field("status"), "disbanded"))
      .first();

    if (army) {
      const result = await supplyArmy(ctx, army._id, 10);
      effects.supplyResult = result;
    }
  }

  // =============================================
  // DEEP SIMULATION - TECHNOLOGY ACTIONS
  // =============================================

  if (action === "research_technology") {
    // Get available technologies and pick one to research
    const allTechs = await ctx.db.query("techTree").collect();
    const researchedTechs = await ctx.db
      .query("technologies")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", territory._id))
      .filter((q: any) => q.eq(q.field("researched"), true))
      .collect();

    const researchedIds = new Set(researchedTechs.map((t: typeof researchedTechs[0]) => t.techId));
    const available = allTechs.filter((t: typeof allTechs[0]) => {
      if (researchedIds.has(t.techId)) return false;
      return t.prerequisites.every((p: string) => researchedIds.has(p));
    });

    if (available.length > 0) {
      const toResearch = available[0]; // Pick first available
      const result = await researchTechnology(ctx, territory._id, toResearch.techId, currentTick);
      effects.researchResult = result;
      if (result.completed) {
        await ctx.db.patch(territory._id, {
          technology: territory.technology + 3, // No cap
          knowledge: territory.knowledge + 2, // No cap
        });
      }
    }
  }

  if (action === "establish_academy") {
    const result = await establishAcademy(ctx, territory._id, currentTick);
    effects.academyResult = result;
    if (result.success) {
      await ctx.db.patch(territory._id, {
        knowledge: territory.knowledge + 5, // No cap
      });
    }
  }

  // =============================================
  // ENGAGEMENT SYSTEM - CHARACTER & INTRIGUE ACTIONS
  // =============================================

  if (action === "execute_character") {
    // Find a suspicious character (low loyalty or high ambition)
    const characters = await ctx.db
      .query("characters")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", territory._id))
      .filter((q: any) => q.and(
        q.eq(q.field("isAlive"), true),
        q.neq(q.field("role"), "ruler")
      ))
      .collect();

    const suspicious = characters.filter((c: any) => c.traits.loyalty < 50 || c.traits.ambition > 60);
    if (suspicious.length > 0) {
      const target = suspicious[0];
      const wasGuilty = target.activePlots.length > 0;

      // Execute the character
      await ctx.db.patch(target._id, {
        isAlive: false,
        deathTick: currentTick,
        deathCause: "executed",
      });

      if (wasGuilty) {
        effects.executionResult = { success: true, wasGuilty: true };
        // Slight stability boost
        await ctx.db.patch(territory._id, {
          happiness: territory.happiness + 2, // No cap
        });
      } else {
        effects.executionResult = { success: true, wasGuilty: false };
        // Innocent execution damages happiness
        await ctx.db.patch(territory._id, {
          happiness: Math.max(0, territory.happiness - 10),
        });
      }
    } else {
      effects.executionResult = { success: false, error: "No suspicious characters to execute" };
    }
  }

  if (action === "investigate_plot") {
    // Look for active plots
    const characters = await ctx.db
      .query("characters")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", territory._id))
      .filter((q: any) => q.eq(q.field("isAlive"), true))
      .collect();

    const plotters = characters.filter((c: any) =>
      c.activePlots.some((p: any) => !p.discovered)
    );

    // Cost of investigation
    await ctx.db.patch(territory._id, {
      wealth: Math.max(0, territory.wealth - 5),
    });

    if (plotters.length > 0) {
      // Chance to discover based on random factor
      const discovered = Math.random() < 0.6;
      if (discovered) {
        const plotter = plotters[0];
        const plots = plotter.activePlots.map((p: any) => ({ ...p, discovered: true }));
        await ctx.db.patch(plotter._id, { activePlots: plots });
        effects.investigationResult = { success: true, discovered: plotter.name, plotType: plots[0]?.plotType };
      } else {
        effects.investigationResult = { success: true, discovered: null };
      }
    } else {
      effects.investigationResult = { success: true, message: "No plots found" };
    }
  }

  if (action === "bribe_character") {
    const characters = await ctx.db
      .query("characters")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", territory._id))
      .filter((q: any) => q.and(
        q.eq(q.field("isAlive"), true),
        q.neq(q.field("role"), "ruler")
      ))
      .collect();

    // Find someone with low loyalty to bribe
    const toBribe = characters.find((c: any) => c.traits.loyalty < 60);
    if (toBribe) {
      await ctx.db.patch(toBribe._id, {
        traits: {
          ...toBribe.traits,
          loyalty: Math.min(100, toBribe.traits.loyalty + 20),
          greed: Math.min(100, toBribe.traits.greed + 10),
        },
      });
      await ctx.db.patch(territory._id, {
        wealth: Math.max(0, territory.wealth - 10),
      });
      effects.bribeResult = { success: true, target: toBribe.name };
    } else {
      effects.bribeResult = { success: false, error: "No one needs bribing" };
    }
  }

  if (action === "name_heir") {
    // Find or create an heir
    const characters = await ctx.db
      .query("characters")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", territory._id))
      .filter((q: any) => q.eq(q.field("isAlive"), true))
      .collect();

    const existingHeir = characters.find((c: any) => c.role === "heir");
    if (existingHeir) {
      effects.heirResult = { success: true, heir: existingHeir.name, alreadyExists: true };
    } else {
      // Promote someone to heir
      const candidate = characters.find((c: any) => c.role === "general" || c.role === "advisor");
      if (candidate) {
        await ctx.db.patch(candidate._id, { role: "heir", title: "Heir" });
        effects.heirResult = { success: true, heir: candidate.name, promoted: true };
      } else {
        effects.heirResult = { success: false, error: "No suitable heir candidate" };
      }
    }
  }

  if (action === "found_dynasty") {
    // Update ruler with dynasty info
    const ruler = await ctx.db
      .query("characters")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", territory._id))
      .filter((q: any) => q.and(q.eq(q.field("role"), "ruler"), q.eq(q.field("isAlive"), true)))
      .first();

    if (ruler && !ruler.dynastyName) {
      const dynastyName = `${ruler.name}'s Dynasty`;
      await ctx.db.patch(ruler._id, {
        dynastyName,
        dynastyGeneration: 1,
      });
      await ctx.db.patch(territory._id, {
        influence: territory.influence + 10, // No cap
      });
      effects.dynastyResult = { success: true, name: dynastyName };
    } else if (ruler?.dynastyName) {
      effects.dynastyResult = { success: false, error: "Dynasty already exists" };
    }
  }

  if (action === "purge_court") {
    // Execute all characters with loyalty < 40
    const characters = await ctx.db
      .query("characters")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", territory._id))
      .filter((q: any) => q.and(
        q.eq(q.field("isAlive"), true),
        q.neq(q.field("role"), "ruler")
      ))
      .collect();

    const toPurge = characters.filter((c: any) => c.traits.loyalty < 40);
    let purged = 0;
    let innocents = 0;

    for (const victim of toPurge) {
      const wasGuilty = victim.activePlots.length > 0;
      await ctx.db.patch(victim._id, {
        isAlive: false,
        deathTick: currentTick,
        deathCause: "purged",
      });
      purged++;
      if (!wasGuilty) innocents++;
    }

    await ctx.db.patch(territory._id, {
      happiness: Math.max(0, territory.happiness - 15 - (innocents * 5)),
    });

    effects.purgeResult = { success: true, purged, innocents };
  }

  if (action === "hold_feast") {
    // Boost happiness and loyalty
    const characters = await ctx.db
      .query("characters")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", territory._id))
      .filter((q: any) => q.eq(q.field("isAlive"), true))
      .collect();

    for (const char of characters) {
      await ctx.db.patch(char._id, {
        traits: {
          ...char.traits,
          loyalty: char.traits.loyalty + 10, // No cap
        },
        emotionalState: {
          ...char.emotionalState,
          contentment: char.emotionalState.contentment + 15, // No cap
        },
      });
    }

    await ctx.db.patch(territory._id, {
      happiness: territory.happiness + 5, // No cap
      wealth: Math.max(0, territory.wealth - 15),
      food: Math.max(0, territory.food - 10),
    });

    // Reduce tensions
    const tensions = await ctx.db
      .query("tensionIndicators")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", territory._id))
      .first();

    if (tensions) {
      await ctx.db.patch(tensions._id, {
        coupLikelihood: Math.max(0, tensions.coupLikelihood - 15),
        rebellionLikelihood: Math.max(0, tensions.rebellionLikelihood - 10),
      });
    }

    effects.feastResult = { success: true };
  }

  if (action === "address_decadence") {
    // Reduce decadence at cost of happiness
    const prosperity = await ctx.db
      .query("prosperityTiers")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", territory._id))
      .first();

    if (prosperity) {
      await ctx.db.patch(prosperity._id, {
        decadenceLevel: Math.max(0, prosperity.decadenceLevel - 20),
        complacencyLevel: Math.max(0, prosperity.complacencyLevel - 10),
      });
    }

    await ctx.db.patch(territory._id, {
      happiness: Math.max(0, territory.happiness - 5),
    });

    effects.decadenceResult = { success: true };
  }

  // Apply relationship-affecting actions
  if (targetTerritory) {
    // Find the relationship
    let relationship = await ctx.db
      .query("relationships")
      .withIndex("by_territories", (q: any) =>
        q.eq("territory1Id", territory._id).eq("territory2Id", targetTerritory._id)
      )
      .first();

    if (!relationship) {
      relationship = await ctx.db
        .query("relationships")
        .withIndex("by_territories", (q: any) =>
          q.eq("territory1Id", targetTerritory._id).eq("territory2Id", territory._id)
        )
        .first();
    }

    if (relationship) {
      const relationshipChanges: any = { lastInteractionTick: Date.now() };

      switch (action) {
        case "send_scouts":
          // Scouts make first contact, slightly improves relations
          relationshipChanges.trust = relationship.trust + 5; // No cap
          if (relationship.status === "neutral") {
            // First contact!
            effects.firstContact = true;
          }
          break;

        case "share_knowledge":
          // Sharing knowledge builds trust
          relationshipChanges.trust = relationship.trust + 15; // No cap - trust can grow naturally
          if (relationship.trust >= 25 && relationship.status === "neutral") {
            relationshipChanges.status = "friendly";
          }
          // Both tribes gain knowledge
          await ctx.db.patch(territory._id, {
            knowledge: territory.knowledge + 2, // No cap
          });
          await ctx.db.patch(targetTerritory._id, {
            knowledge: targetTerritory.knowledge + 2, // No cap
          });
          effects.knowledgeShared = true;
          break;

        case "trade_goods":
          // Auto-accept trade if trust is neutral or positive
          if (relationship.trust >= -10) {
            relationshipChanges.hasTradeAgreement = true;
            relationshipChanges.trust = relationship.trust + 8; // No cap
            if (relationship.status === "neutral") {
              relationshipChanges.status = "friendly";
            }
            effects.tradeAccepted = true;
          } else {
            effects.tradeRejected = true;
          }
          break;

        case "show_strength":
          // Intimidation - damages trust but might prevent conflict
          relationshipChanges.trust = Math.max(-100, relationship.trust - 10);
          if (relationship.trust <= -25 && relationship.status === "neutral") {
            relationshipChanges.status = "tense";
          }
          effects.strengthDisplayed = true;
          break;

        case "raid":
          // Hostile action - attack!
          relationshipChanges.trust = Math.max(-100, relationship.trust - 30);
          relationshipChanges.status = "hostile";
          relationshipChanges.hasTradeAgreement = false;
          relationshipChanges.hasAlliance = false;

          // Calculate raid outcome
          const { calculateWarEffects } = await import("../simulation/resources");
          const raidResult = calculateWarEffects(territory, targetTerritory);

          // Apply effects - no caps on food gains (can plunder more than 100)
          await ctx.db.patch(territory._id, {
            population: Math.max(1, territory.population + (raidResult.attackerCosts.population || 0)),
            food: Math.max(0, territory.food + (raidResult.attackerCosts.food || 0)),
            happiness: Math.max(0, territory.happiness + (raidResult.attackerCosts.happiness || 0)),
            military: Math.max(0, territory.military + (raidResult.attackerCosts.military || 0)),
          });
          await ctx.db.patch(targetTerritory._id, {
            population: Math.max(1, targetTerritory.population + (raidResult.defenderCosts.population || 0)),
            food: Math.max(0, targetTerritory.food + (raidResult.defenderCosts.food || 0)),
            happiness: Math.max(0, targetTerritory.happiness + (raidResult.defenderCosts.happiness || 0)),
            wealth: Math.max(0, targetTerritory.wealth + (raidResult.defenderCosts.wealth || 0)),
          });

          effects.raidOutcome = raidResult.attackerWins ? "success" : "failed";
          break;

        case "propose_peace":
          // Offer peace to end hostilities
          if (relationship.status === "hostile" || relationship.status === "at_war") {
            relationshipChanges.pendingPeaceOffer = territory._id;
            relationshipChanges.peaceOfferTerms = reasoning?.slice(0, 500); // Store the peace terms
            effects.peaceOffered = true;
          } else {
            effects.peaceNotNeeded = true; // Not at war
          }
          break;

        case "accept_peace":
          // Accept a pending peace offer
          if (relationship.pendingPeaceOffer && relationship.pendingPeaceOffer !== territory._id) {
            // They offered peace, we accept
            relationshipChanges.status = "neutral";
            relationshipChanges.trust = relationship.trust + 20; // No cap
            relationshipChanges.pendingPeaceOffer = undefined;
            relationshipChanges.peaceOfferTerms = undefined;
            effects.peaceAccepted = true;
          } else if (relationship.pendingPeaceOffer === territory._id) {
            effects.waitingForResponse = true; // We offered, waiting for them
          } else {
            effects.noPeaceOffer = true; // No peace to accept
          }
          break;

        case "surrender":
          // Admit defeat
          if (relationship.status === "hostile" || relationship.status === "at_war") {
            relationshipChanges.status = "tense";
            relationshipChanges.trust = relationship.trust + 10; // No cap
            relationshipChanges.surrenderedTo = targetTerritory._id;
            relationshipChanges.pendingPeaceOffer = undefined;
            relationshipChanges.peaceOfferTerms = undefined;

            // Surrender costs
            await ctx.db.patch(territory._id, {
              wealth: Math.max(0, territory.wealth - 15),
              influence: Math.max(0, territory.influence - 10),
              happiness: Math.max(0, territory.happiness - 10),
            });
            // Victor gains - no caps
            await ctx.db.patch(targetTerritory._id, {
              wealth: targetTerritory.wealth + 10,
              influence: targetTerritory.influence + 8,
            });
            effects.surrendered = true;
          } else {
            effects.notAtWar = true;
          }
          break;

        case "demand_surrender":
          // Demand the enemy surrenders
          if (relationship.status === "hostile" || relationship.status === "at_war") {
            // AI will decide based on their situation - for now, just record the demand
            relationshipChanges.trust = Math.max(-100, relationship.trust - 5);
            effects.surrenderDemanded = true;
          } else {
            effects.notAtWar = true;
          }
          break;

        case "form_alliance":
          // Create formal alliance with friendly tribe
          if (relationship.trust >= 25 && (relationship.status === "friendly" || relationship.status === "neutral")) {
            relationshipChanges.status = "allied";
            relationshipChanges.hasAlliance = true;
            relationshipChanges.hasTradeAgreement = true;
            relationshipChanges.trust = relationship.trust + 20; // No cap

            // Alliance military bonus applied passively
            effects.allianceFormed = true;
          } else if (relationship.trust < 25) {
            effects.trustTooLow = true;
          } else {
            effects.alreadyAllied = relationship.status === "allied";
          }
          break;

        // =============================================
        // DEEP SIMULATION - TARGET-BASED ACTIONS
        // =============================================

        case "establish_trade_route":
          const tradeRouteResult = await establishTradeRoute(
            ctx,
            territory._id,
            targetTerritory._id,
            world?.tick || 0
          );
          effects.tradeRouteResult = tradeRouteResult;
          if (tradeRouteResult.success) {
            relationshipChanges.trust = relationship.trust + 5; // No cap
          }
          break;

        case "send_caravan":
          // Send a simple caravan with some goods
          const goods = [{ type: "trade_goods", quantity: 10, purchasePrice: 1 }];
          const caravanResult = await sendCaravan(
            ctx,
            territory._id,
            targetTerritory._id,
            goods,
            territory.military * 0.1, // 10% military as guards
            world?.tick || 0
          );
          effects.caravanResult = caravanResult;
          break;

        case "raid_caravan":
          const caravanRaidResult = await raidCaravans(
            ctx,
            territory._id,
            targetTerritory._id,
            world?.tick || 0
          );
          effects.caravanRaidResult = caravanRaidResult;
          if (caravanRaidResult.success) {
            relationshipChanges.trust = Math.max(-100, relationship.trust - 20);
            if (relationship.status !== "at_war") {
              relationshipChanges.status = "hostile";
            }
          }
          break;

        case "move_army":
          const army = await ctx.db
            .query("armies")
            .withIndex("by_territory", (q: any) => q.eq("territoryId", territory._id))
            .filter((q: any) => q.neq(q.field("status"), "disbanded"))
            .first();

          if (army) {
            const moveResult = await moveArmy(ctx, army._id, targetTerritory._id, world?.tick || 0);
            effects.moveArmyResult = moveResult;
          }
          break;

        case "lay_siege":
          // Get our army at the target location
          const siegingArmy = await ctx.db
            .query("armies")
            .withIndex("by_location", (q: any) => q.eq("locationId", targetTerritory._id))
            .filter((q: any) => q.eq(q.field("territoryId"), territory._id))
            .first();

          if (siegingArmy) {
            const siegeResult = await startSiege(ctx, siegingArmy._id, targetTerritory._id, world?.tick || 0);
            effects.siegeResult = siegeResult;
          } else {
            effects.siegeResult = { success: false, error: "No army at target location" };
          }
          break;

        case "assault_walls":
          const ongoingSiege = await ctx.db
            .query("sieges")
            .withIndex("by_defender", (q: any) => q.eq("defenderTerritoryId", targetTerritory._id))
            .filter((q: any) => q.eq(q.field("status"), "ongoing"))
            .first();

          if (ongoingSiege) {
            const assaultResult = await assaultWalls(ctx, ongoingSiege._id, world?.tick || 0);
            effects.assaultResult = assaultResult;
          } else {
            effects.assaultResult = { success: false, outcome: "No active siege" };
          }
          break;

        case "share_technology":
          // Get our researched techs and share one with ally
          const ourTechs = await ctx.db
            .query("technologies")
            .withIndex("by_territory", (q: any) => q.eq("territoryId", territory._id))
            .filter((q: any) => q.eq(q.field("researched"), true))
            .collect();

          if (ourTechs.length > 0 && relationship.trust >= 25) {
            const techToShare = ourTechs[0];
            const shareResult = await shareTechnology(
              ctx,
              territory._id,
              targetTerritory._id,
              techToShare.techId,
              world?.tick || 0
            );
            effects.shareTechResult = shareResult;
            if (shareResult.success) {
              relationshipChanges.trust = relationship.trust + 10; // No cap
            }
          }
          break;

        case "steal_technology":
          const stealResult = await stealTechnology(
            ctx,
            territory._id,
            targetTerritory._id,
            world?.tick || 0
          );
          effects.stealTechResult = stealResult;
          if (stealResult.discovered) {
            relationshipChanges.trust = Math.max(-100, relationship.trust - 30);
            if (relationship.status === "friendly" || relationship.status === "allied") {
              relationshipChanges.status = "tense";
              relationshipChanges.hasAlliance = false;
            }
          }
          break;

        // =============================================
        // ENGAGEMENT - VENDETTA & RECONCILIATION
        // =============================================

        case "declare_vendetta":
          // Create a hereditary rivalry
          const ourRuler = await ctx.db
            .query("characters")
            .withIndex("by_territory", (q: any) => q.eq("territoryId", territory._id))
            .filter((q: any) => q.and(q.eq(q.field("role"), "ruler"), q.eq(q.field("isAlive"), true)))
            .first();

          const theirRuler = await ctx.db
            .query("characters")
            .withIndex("by_territory", (q: any) => q.eq("territoryId", targetTerritory._id))
            .filter((q: any) => q.and(q.eq(q.field("role"), "ruler"), q.eq(q.field("isAlive"), true)))
            .first();

          if (ourRuler && theirRuler) {
            await ctx.db.insert("rivalries", {
              character1Id: ourRuler._id,
              character2Id: theirRuler._id,
              territory1Id: territory._id,
              territory2Id: targetTerritory._id,
              intensity: 70,
              rivalryType: "blood_feud",
              reasons: [{
                reason: "vendetta_declared",
                tick: currentTick,
                description: `${ourRuler.name} declared a blood feud against ${theirRuler.name}`,
                intensityAdded: 70,
              }],
              isHereditary: true,
              status: "active",
              startTick: currentTick,
            });
            relationshipChanges.trust = Math.max(-100, relationship.trust - 40);
            relationshipChanges.status = "hostile";
            relationshipChanges.hasAlliance = false;
            relationshipChanges.hasTradeAgreement = false;
            effects.vendettaResult = { success: true };
          } else {
            effects.vendettaResult = { success: false, error: "Missing rulers" };
          }
          break;

        case "seek_reconciliation":
          // Try to reduce rivalry intensity
          const existingRivalry = await ctx.db
            .query("rivalries")
            .withIndex("by_territory1", (q: any) => q.eq("territory1Id", territory._id))
            .filter((q: any) => q.and(
              q.eq(q.field("territory2Id"), targetTerritory._id),
              q.eq(q.field("status"), "active")
            ))
            .first();

          const reverseRivalry = !existingRivalry ? await ctx.db
            .query("rivalries")
            .withIndex("by_territory1", (q: any) => q.eq("territory1Id", targetTerritory._id))
            .filter((q: any) => q.and(
              q.eq(q.field("territory2Id"), territory._id),
              q.eq(q.field("status"), "active")
            ))
            .first() : null;

          const rivalry = existingRivalry || reverseRivalry;
          if (rivalry) {
            const newIntensity = Math.max(0, rivalry.intensity - 25);
            const newReasons = [...rivalry.reasons, {
              reason: "reconciliation_attempt",
              tick: currentTick,
              description: "Attempted reconciliation reduced tensions",
              intensityAdded: -25,
            }];

            if (newIntensity <= 10) {
              await ctx.db.patch(rivalry._id, {
                status: "resolved",
                endTick: currentTick,
                intensity: 0,
                reasons: newReasons,
              });
              effects.reconciliationResult = { success: true, resolved: true };
            } else {
              await ctx.db.patch(rivalry._id, {
                intensity: newIntensity,
                reasons: newReasons,
              });
              effects.reconciliationResult = { success: true, newIntensity };
            }

            relationshipChanges.trust = relationship.trust + 15; // No cap
          } else {
            effects.reconciliationResult = { success: false, error: "No active rivalry to resolve" };
          }
          break;

        case "arrange_marriage":
          // Find heirs from both territories
          const ourHeir = await ctx.db
            .query("characters")
            .withIndex("by_territory", (q: any) => q.eq("territoryId", territory._id))
            .filter((q: any) => q.and(q.eq(q.field("role"), "heir"), q.eq(q.field("isAlive"), true)))
            .first();

          const theirHeir = await ctx.db
            .query("characters")
            .withIndex("by_territory", (q: any) => q.eq("territoryId", targetTerritory._id))
            .filter((q: any) => q.and(q.eq(q.field("role"), "heir"), q.eq(q.field("isAlive"), true)))
            .first();

          if (ourHeir && theirHeir && relationship.trust >= 10) {
            // Create relationship between heirs
            const heirRelationships = [...ourHeir.relationships, {
              characterId: theirHeir._id,
              type: "ally" as const,
              strength: 50,
              isSecret: false,
            }];
            await ctx.db.patch(ourHeir._id, { relationships: heirRelationships });

            relationshipChanges.trust = relationship.trust + 25; // No cap
            if (relationship.status === "neutral" || relationship.status === "friendly") {
              relationshipChanges.status = "allied";
              relationshipChanges.hasAlliance = true;
            }

            // Check if there's a rivalry to reduce
            const marriageRivalry = await ctx.db
              .query("rivalries")
              .withIndex("by_territory1", (q: any) => q.eq("territory1Id", territory._id))
              .filter((q: any) => q.and(
                q.eq(q.field("territory2Id"), targetTerritory._id),
                q.eq(q.field("status"), "active")
              ))
              .first();

            if (marriageRivalry) {
              await ctx.db.patch(marriageRivalry._id, {
                intensity: Math.max(0, marriageRivalry.intensity - 30),
              });
            }

            effects.marriageResult = { success: true };
          } else if (!ourHeir) {
            effects.marriageResult = { success: false, error: "No heir to marry" };
          } else if (!theirHeir) {
            effects.marriageResult = { success: false, error: "Target has no heir" };
          } else {
            effects.marriageResult = { success: false, error: "Relations not good enough" };
          }
          break;
      }

      await ctx.db.patch(relationship._id, relationshipChanges);
      effects.relationshipChanges = relationshipChanges;
    }
  }

  return effects;
}

function getEventSeverity(action: string): "info" | "positive" | "negative" | "critical" {
  switch (action) {
    // Positive actions
    case "gather_food":
    case "build_shelter":
    case "develop_tools":
    case "create_culture":
    case "grow_community":
    case "rest":
    case "name_tribe":
    case "establish_council":
    case "establish_democracy":
    case "establish_theocracy":
    case "accept_peace":
    case "form_alliance":
    case "build_farm":
    case "build_workshop":
    case "build_market":
    case "promote_births":
    case "research_technology":
    case "share_technology":
    case "establish_academy":
    case "establish_trade_route":
      return "positive";

    // Informational actions
    case "explore_land":
    case "send_scouts":
    case "share_knowledge":
    case "trade_goods":
    case "establish_chief":
    case "change_government":
    case "propose_peace":
    case "build_mine":
    case "set_tax_rate":
    case "prospect_resources":
    case "send_caravan":
    case "patrol_routes":
    case "class_reform":
    case "recruit_soldiers":
    case "move_army":
    case "supply_army":
      return "info";

    // Negative actions
    case "train_warriors":
    case "show_strength":
    case "establish_dictatorship":
    case "demand_surrender":
    case "surrender":
    case "appease_faction":
    case "quarantine":
    case "raise_militia":
    case "build_fortifications":
      return "negative";

    // Critical actions
    case "raid":
    case "raid_caravan":
    case "suppress_faction":
    case "lay_siege":
    case "assault_walls":
    case "steal_technology":
    case "execute_character":
    case "purge_court":
    case "declare_vendetta":
      return "critical";

    // Engagement - positive
    case "hold_feast":
    case "found_dynasty":
    case "seek_reconciliation":
    case "arrange_marriage":
      return "positive";

    // Engagement - negative
    case "bribe_character":
    case "address_decadence":
      return "negative";

    // Engagement - info
    case "investigate_plot":
    case "name_heir":
      return "info";

    default:
      return "info";
  }
}

function buildEventDescription(
  action: string,
  territoryName: string,
  targetName: string | undefined,
  reasoning: string
): string {
  // For the civilization sim, just use the AI's narrative reasoning directly
  // The reasoning should already be creative and story-like
  return reasoning;
}

// =============================================
// ENGAGEMENT SYSTEM - QUERIES
// =============================================

export const getTerritoryCharacters = internalQuery({
  args: { territoryId: v.id("territories") },
  handler: async (ctx, args) => {
    const characters = await ctx.db
      .query("characters")
      .withIndex("by_territory", (q) => q.eq("territoryId", args.territoryId))
      .filter((q) => q.eq(q.field("isAlive"), true))
      .collect();

    return characters;
  },
});

export const getTerritoryTensions = internalQuery({
  args: { territoryId: v.id("territories") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("tensionIndicators")
      .withIndex("by_territory", (q) => q.eq("territoryId", args.territoryId))
      .first();
  },
});

export const getTerritoryRivalries = internalQuery({
  args: { territoryId: v.id("territories") },
  handler: async (ctx, args) => {
    // Get rivalries where this territory is involved
    const asTerritory1 = await ctx.db
      .query("rivalries")
      .withIndex("by_territory1", (q) => q.eq("territory1Id", args.territoryId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    const asTerritory2 = await ctx.db
      .query("rivalries")
      .withIndex("by_territory2", (q) => q.eq("territory2Id", args.territoryId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    // Fetch character and territory names for each rivalry
    const rivalries = [];

    for (const rivalry of [...asTerritory1, ...asTerritory2]) {
      const isTerritory1 = rivalry.territory1Id === args.territoryId;
      const opponentTerritoryId = isTerritory1 ? rivalry.territory2Id : rivalry.territory1Id;
      const opponentCharacterId = isTerritory1 ? rivalry.character2Id : rivalry.character1Id;

      const opponentTerritory = await ctx.db.get(opponentTerritoryId);
      const opponentCharacter = await ctx.db.get(opponentCharacterId);

      rivalries.push({
        ...rivalry,
        opponentName: opponentCharacter?.name || "Unknown",
        opponentTerritory: opponentTerritory?.name || "Unknown",
      });
    }

    return rivalries;
  },
});

export const getTerritoryProsperity = internalQuery({
  args: { territoryId: v.id("territories") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("prosperityTiers")
      .withIndex("by_territory", (q) => q.eq("territoryId", args.territoryId))
      .first();
  },
});

export const getRecentSuccession = internalQuery({
  args: { territoryId: v.id("territories"), sinceTicksAgo: v.number() },
  handler: async (ctx, args) => {
    const world = await ctx.db.query("world").first();
    if (!world) return null;

    const minTick = world.tick - args.sinceTicksAgo;

    const succession = await ctx.db
      .query("successionEvents")
      .withIndex("by_territory", (q) => q.eq("territoryId", args.territoryId))
      .filter((q) => q.gte(q.field("tick"), minTick))
      .order("desc")
      .first();

    return succession;
  },
});
