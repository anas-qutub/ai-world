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
import { evolvePersonalityFromAction, updateAgentArchetype } from "../simulation/personalityEvolution";
// Organic AI Growth - Memory and Bond recording
import { recordMemory, MemoryType } from "../simulation/memory";
import { createBondFromMemory, createBond, shouldCreateBond } from "../simulation/bonds";
// Society Systems - Religion, Education, Guilds, Judicial
import { foundReligion, buildTemple, declareStateReligion, ordainPriest } from "../simulation/religion";
import { createSchool, enrollInSchool, hireTeacher } from "../simulation/education";
import { foundGuild, joinGuild, grantMonopoly, buildGuildHall } from "../simulation/guilds";
import { establishLawCode, reportCrime, beginTrial, renderVerdict, pardonCriminal, buildPrison } from "../simulation/judicial";

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
      // Organic Knowledge Progression
      encourage_craft: "Encouraged Craft Practice",
      apprenticeship_program: "Started Apprenticeship Program",
      knowledge_festival: "Held Knowledge Festival",
      share_technology: "Shared Technology",
      steal_technology: "Attempted Espionage",
      establish_academy: "Established Academy",
      // Skill-Based Actions
      forge_quality_weapons: "Forged Quality Weapons",
      forge_quality_armor: "Forged Quality Armor",
      build_warships: "Built Warships",
      construct_siege_equipment: "Constructed Siege Equipment",
      advanced_irrigation: "Built Advanced Irrigation",
      selective_breeding: "Started Selective Breeding",
      flanking_maneuver: "Executed Flanking Maneuver",
      train_elite_guard: "Trained Elite Guard",
      cavalry_charge: "Trained Cavalry Charge",
      naval_blockade: "Established Naval Blockade",
      scientific_expedition: "Launched Scientific Expedition",
      medical_research: "Conducted Medical Research",
      astronomical_observation: "Made Astronomical Observations",
      philosophical_debates: "Held Philosophical Debates",
      build_aqueduct: "Built Aqueduct",
      build_grand_monument: "Built Grand Monument",
      fortify_harbor: "Fortified Harbor",
      infiltrate_court: "Infiltrated Enemy Court",
      diplomatic_mission: "Sent Diplomatic Mission",
      propaganda_campaign: "Launched Propaganda Campaign",
      build_factory: "Built Factory",
      build_railway: "Built Railway",
      electrify_territory: "Electrified Territory",
      develop_aircraft: "Developed Aircraft",
      launch_satellite: "Launched Satellite",
      nuclear_research: "Conducted Nuclear Research",
      develop_missile_program: "Developed Missile Program",
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
      // Survival actions
      gather_wood: "Gathered Wood",
      build_houses: "Built Houses",
      stockpile_fuel: "Stockpiled Fuel",
      preserve_food: "Preserved Food",
      // Society Systems - Religion
      found_religion: "Founded New Religion",
      build_temple: "Built Temple",
      declare_state_religion: "Declared State Religion",
      ordain_priest: "Ordained Priest",
      hold_religious_festival: "Held Religious Festival",
      // Society Systems - Education
      build_school: "Built School",
      enroll_student: "Enrolled Students",
      hire_teacher: "Hired Teacher",
      expand_library: "Expanded Library",
      // Society Systems - Guilds
      found_guild: "Founded Guild",
      join_guild: "Joined Guild",
      grant_monopoly: "Granted Monopoly",
      build_guild_hall: "Built Guild Hall",
      // Society Systems - Judicial
      establish_law_code: "Established Law Code",
      report_crime: "Reported Crime",
      hold_trial: "Held Trial",
      pardon_criminal: "Pardoned Criminal",
      build_prison: "Built Prison",
      appoint_judge: "Appointed Judge",
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

    // =============================================
    // PERSONALITY EVOLUTION - Actions shape who you become!
    // =============================================
    // Get the agent for this territory
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", args.territoryId))
      .first();

    if (agent) {
      // Evolve personality based on the action taken
      const personalityChanges = await evolvePersonalityFromAction(ctx, agent._id, args.action);

      // Update the archetype (emergent label based on evolved traits)
      const newArchetype = await updateAgentArchetype(ctx, agent._id);

      // Store personality changes in effects for logging/debugging
      effects.personalityEvolution = {
        changes: personalityChanges.changes,
        newArchetype,
      };
    }

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
    "establish_dictatorship", "establish_theocracy", "change_government",
    // Survival actions
    "gather_wood", "build_houses", "stockpile_fuel", "preserve_food"
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
  // ORGANIC KNOWLEDGE PROGRESSION ACTIONS
  // Technologies emerge organically when your population develops skills.
  // =============================================

  if (action === "encourage_craft") {
    // Boost skill gain for all characters in a specific skill this tick
    // The skill type should be mentioned in the reasoning (e.g., "focus on smithing")
    const validSkills = ["smithing", "farming", "carpentry", "masonry", "tailoring", "literacy", "mathematics", "medicine", "engineering", "trading", "melee", "ranged", "tactics"];

    // Try to extract skill from reasoning
    let skillToEncourage = "farming"; // Default
    if (reasoning) {
      const reasoningLower = reasoning.toLowerCase();
      for (const skill of validSkills) {
        if (reasoningLower.includes(skill)) {
          skillToEncourage = skill;
          break;
        }
      }
    }

    if (validSkills.includes(skillToEncourage.toLowerCase())) {
      // Mark the territory as having an encouraged skill this tick
      // This will be checked by the professions system
      await ctx.db.patch(territory._id, {
        encouragedSkill: skillToEncourage.toLowerCase(),
        encouragedSkillTick: currentTick,
      } as any);

      effects.encouragedSkill = skillToEncourage;
      effects.message = `Your people are focusing on ${skillToEncourage} practice. Skill gains in this area increased by 20%.`;
    } else {
      effects.message = `Unknown skill: ${skillToEncourage}. Valid skills include: ${validSkills.join(", ")}`;
    }
  }

  if (action === "apprenticeship_program") {
    // Have experts teach their skills to younger workers
    // This spreads expertise faster but temporarily reduces productivity
    const characters = await ctx.db
      .query("characters")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", territory._id))
      .filter((q: any) => q.eq(q.field("isAlive"), true))
      .collect();

    // Count experts (anyone with a skill >= 70)
    let expertCount = 0;
    for (const character of characters) {
      if (!character.skills) continue;
      const skills = character.skills as Record<string, number>;
      for (const skillLevel of Object.values(skills)) {
        if (typeof skillLevel === "number" && skillLevel >= 70) {
          expertCount++;
          break;
        }
      }
    }

    if (expertCount >= 2) {
      // Mark territory as running apprenticeship program
      await ctx.db.patch(territory._id, {
        apprenticeshipActive: true,
        apprenticeshipStartTick: currentTick,
        apprenticeshipEndTick: currentTick + 3, // Lasts 3 ticks
      } as any);

      effects.apprenticeshipStarted = true;
      effects.expertsTeaching = expertCount;
      effects.message = `${expertCount} experts are now teaching apprentices. Skill gains doubled for 3 ticks, but production reduced.`;

      // Slight happiness boost from learning opportunity
      await ctx.db.patch(territory._id, {
        happiness: Math.min(100, territory.happiness + 2),
      });
    } else {
      effects.message = "Not enough experts (need at least 2 people with 70+ skill) to run an apprenticeship program.";
    }
  }

  if (action === "knowledge_festival") {
    // Celebrate and share knowledge across society
    // Costs resources but boosts collective knowledge in all areas
    const foodCost = 10;
    const wealthCost = 5;

    if (territory.food >= foodCost && territory.wealth >= wealthCost) {
      // Deduct costs
      await ctx.db.patch(territory._id, {
        food: territory.food - foodCost,
        wealth: territory.wealth - wealthCost,
        happiness: Math.min(100, territory.happiness + 5),
      });

      // Boost collective knowledge in all skills
      const populationSkills = await ctx.db
        .query("populationSkills")
        .withIndex("by_territory", (q: any) => q.eq("territoryId", territory._id))
        .collect();

      for (const popSkill of populationSkills) {
        await ctx.db.patch(popSkill._id, {
          collectiveKnowledge: popSkill.collectiveKnowledge + 10,
          knowledgeGainThisTick: popSkill.knowledgeGainThisTick + 10,
        });
      }

      effects.festivalHeld = true;
      effects.message = "A great knowledge festival was held! Your people shared wisdom and techniques. +10 collective knowledge in all areas, +5 happiness.";
    } else {
      effects.message = `Not enough resources for a festival. Need ${foodCost} food and ${wealthCost} wealth.`;
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
  // SKILL-BASED ACTIONS
  // These require specific skill levels in your population
  // =============================================

  // Helper function to check skill requirements
  const checkSkillRequirements = async (requirements: Record<string, { minExpertPercent?: number; minSkilledPercent?: number }>) => {
    for (const [skillType, reqs] of Object.entries(requirements)) {
      const popSkill = await ctx.db
        .query("populationSkills")
        .withIndex("by_territory_skill", (q: any) => q.eq("territoryId", territory._id).eq("skillType", skillType))
        .first();

      if (!popSkill) return { met: false, missing: `No ${skillType} skill data` };

      if (reqs.minExpertPercent && popSkill.expertPercent < reqs.minExpertPercent) {
        return { met: false, missing: `Need ${reqs.minExpertPercent}% expert ${skillType}, have ${popSkill.expertPercent.toFixed(1)}%` };
      }
      if (reqs.minSkilledPercent && popSkill.skilledPercent < reqs.minSkilledPercent) {
        return { met: false, missing: `Need ${reqs.minSkilledPercent}% skilled ${skillType}, have ${popSkill.skilledPercent.toFixed(1)}%` };
      }
    }
    return { met: true, missing: "" };
  };

  // Advanced Crafting Actions
  if (action === "forge_quality_weapons") {
    const reqs = await checkSkillRequirements({ smithing: { minExpertPercent: 10 } });
    if (reqs.met) {
      effects.qualityWeapons = true;
      effects.message = "Your master smiths have forged exceptional weapons! +30% weapon quality for your army.";
      await ctx.db.patch(territory._id, {
        military: Math.min(100, territory.military + 5),
      });
    } else {
      effects.message = `Cannot forge quality weapons: ${reqs.missing}`;
    }
  }

  if (action === "forge_quality_armor") {
    const reqs = await checkSkillRequirements({ smithing: { minExpertPercent: 15 } });
    if (reqs.met) {
      effects.qualityArmor = true;
      effects.message = "Your master smiths have crafted superior armor! +30% armor quality for your army.";
      await ctx.db.patch(territory._id, {
        military: Math.min(100, territory.military + 5),
      });
    } else {
      effects.message = `Cannot forge quality armor: ${reqs.missing}`;
    }
  }

  if (action === "build_warships") {
    const reqs = await checkSkillRequirements({ shipwright: { minExpertPercent: 10 }, carpentry: { minSkilledPercent: 20 } });
    if (reqs.met && territory.wealth >= 20) {
      await ctx.db.patch(territory._id, {
        wealth: territory.wealth - 20,
        military: Math.min(100, territory.military + 10),
      });
      effects.warshipsBuilt = true;
      effects.message = "Your expert shipwrights have built warships! +10 military, naval capability unlocked.";
    } else if (!reqs.met) {
      effects.message = `Cannot build warships: ${reqs.missing}`;
    } else {
      effects.message = "Cannot build warships: Need 20 wealth.";
    }
  }

  if (action === "construct_siege_equipment") {
    const reqs = await checkSkillRequirements({ siege_engineering: { minExpertPercent: 8 }, carpentry: { minSkilledPercent: 15 } });
    if (reqs.met && territory.wealth >= 15) {
      await ctx.db.patch(territory._id, {
        wealth: territory.wealth - 15,
        military: Math.min(100, territory.military + 8),
      });
      effects.siegeEquipment = true;
      effects.message = "Your engineers have constructed siege equipment! +50% siege effectiveness.";
    } else if (!reqs.met) {
      effects.message = `Cannot construct siege equipment: ${reqs.missing}`;
    } else {
      effects.message = "Cannot construct siege equipment: Need 15 wealth.";
    }
  }

  // Advanced Agriculture Actions
  if (action === "advanced_irrigation") {
    const reqs = await checkSkillRequirements({ irrigation: { minExpertPercent: 8 }, farming: { minSkilledPercent: 20 } });
    if (reqs.met && territory.wealth >= 25) {
      await ctx.db.patch(territory._id, {
        wealth: territory.wealth - 25,
        food: Math.min(500, territory.food + 30), // Major food boost
      });
      effects.irrigationBuilt = true;
      effects.message = "Advanced irrigation systems built! +50% farm output. +30 food production.";
    } else if (!reqs.met) {
      effects.message = `Cannot build advanced irrigation: ${reqs.missing}`;
    } else {
      effects.message = "Cannot build advanced irrigation: Need 25 wealth.";
    }
  }

  if (action === "selective_breeding") {
    const reqs = await checkSkillRequirements({ veterinary: { minExpertPercent: 8 }, animalcare: { minSkilledPercent: 20 } });
    if (reqs.met) {
      await ctx.db.patch(territory._id, {
        food: Math.min(500, territory.food + 15),
        knowledge: territory.knowledge + 3,
      });
      effects.breedingProgram = true;
      effects.message = "Selective breeding program started! +30% animal productivity. +15 food, +3 knowledge.";
    } else {
      effects.message = `Cannot start breeding program: ${reqs.missing}`;
    }
  }

  // Military Tactics Actions
  if (action === "flanking_maneuver" && targetTerritory) {
    const reqs = await checkSkillRequirements({ tactics: { minExpertPercent: 10 } });
    if (reqs.met) {
      await ctx.db.patch(territory._id, {
        military: Math.min(100, territory.military + 8),
      });
      effects.flankingManeuver = true;
      effects.message = `Expert tacticians executed flanking maneuver against ${targetTerritory.name}! +40% combat advantage.`;
    } else {
      effects.message = `Cannot execute flanking maneuver: ${reqs.missing}`;
    }
  }

  if (action === "train_elite_guard") {
    const reqs = await checkSkillRequirements({ melee: { minExpertPercent: 15 }, tactics: { minSkilledPercent: 20 } });
    if (reqs.met && territory.wealth >= 20) {
      await ctx.db.patch(territory._id, {
        wealth: territory.wealth - 20,
        military: Math.min(100, territory.military + 10),
      });
      effects.eliteGuard = true;
      effects.message = "Elite guard unit trained! +50% defense vs assassination. +10 military.";
    } else if (!reqs.met) {
      effects.message = `Cannot train elite guard: ${reqs.missing}`;
    } else {
      effects.message = "Cannot train elite guard: Need 20 wealth.";
    }
  }

  if (action === "cavalry_charge") {
    const reqs = await checkSkillRequirements({ cavalry: { minExpertPercent: 10 }, animalcare: { minSkilledPercent: 15 } });
    if (reqs.met) {
      await ctx.db.patch(territory._id, {
        military: Math.min(100, territory.military + 7),
      });
      effects.cavalryTraining = true;
      effects.message = "Cavalry charge tactics trained! +50% cavalry charge damage. +7 military.";
    } else {
      effects.message = `Cannot train cavalry charge: ${reqs.missing}`;
    }
  }

  if (action === "naval_blockade" && targetTerritory) {
    const reqs = await checkSkillRequirements({ naval_combat: { minExpertPercent: 10 }, navigation: { minSkilledPercent: 15 } });
    if (reqs.met) {
      // Reduce target's trade income
      await ctx.db.patch(targetTerritory._id, {
        wealth: Math.max(0, targetTerritory.wealth - 10),
      });
      effects.navalBlockade = true;
      effects.message = `Naval blockade established against ${targetTerritory.name}! Their sea trade is cut.`;
    } else {
      effects.message = `Cannot establish naval blockade: ${reqs.missing}`;
    }
  }

  // Knowledge & Science Actions
  if (action === "scientific_expedition") {
    const reqs = await checkSkillRequirements({ literacy: { minExpertPercent: 10 }, mathematics: { minSkilledPercent: 15 } });
    if (reqs.met && territory.wealth >= 10) {
      await ctx.db.patch(territory._id, {
        wealth: territory.wealth - 10,
        knowledge: territory.knowledge + 20,
      });
      effects.scientificExpedition = true;
      effects.message = "Scientific expedition launched! +20 knowledge.";
    } else if (!reqs.met) {
      effects.message = `Cannot launch scientific expedition: ${reqs.missing}`;
    } else {
      effects.message = "Cannot launch scientific expedition: Need 10 wealth.";
    }
  }

  if (action === "medical_research") {
    const reqs = await checkSkillRequirements({ medicine: { minExpertPercent: 8 }, herbalism: { minSkilledPercent: 15 } });
    if (reqs.met) {
      await ctx.db.patch(territory._id, {
        knowledge: territory.knowledge + 10,
        happiness: Math.min(100, territory.happiness + 5),
      });
      effects.medicalResearch = true;
      effects.message = "Medical research conducted! -20% death rate from disease. +10 knowledge, +5 happiness.";
    } else {
      effects.message = `Cannot conduct medical research: ${reqs.missing}`;
    }
  }

  if (action === "astronomical_observation") {
    const reqs = await checkSkillRequirements({ astronomy: { minExpertPercent: 8 }, mathematics: { minSkilledPercent: 15 } });
    if (reqs.met) {
      await ctx.db.patch(territory._id, {
        knowledge: territory.knowledge + 15,
        influence: Math.min(100, territory.influence + 3),
      });
      effects.astronomicalObservation = true;
      effects.message = "Astronomical observations made! Better navigation and crop timing. +15 knowledge, +3 influence.";
    } else {
      effects.message = `Cannot make astronomical observations: ${reqs.missing}`;
    }
  }

  if (action === "philosophical_debates") {
    const reqs = await checkSkillRequirements({ philosophy: { minExpertPercent: 8 }, literacy: { minSkilledPercent: 20 } });
    if (reqs.met) {
      await ctx.db.patch(territory._id, {
        knowledge: territory.knowledge + 25,
        happiness: Math.min(100, territory.happiness + 3),
      });
      effects.philosophicalDebates = true;
      effects.message = "Philosophical debates held! +30% research speed. +25 knowledge, +3 happiness.";
    } else {
      effects.message = `Cannot hold philosophical debates: ${reqs.missing}`;
    }
  }

  // Advanced Construction Actions
  if (action === "build_aqueduct") {
    const reqs = await checkSkillRequirements({ engineering: { minExpertPercent: 10 }, masonry: { minSkilledPercent: 20 } });
    if (reqs.met && territory.wealth >= 30) {
      await ctx.db.patch(territory._id, {
        wealth: territory.wealth - 30,
        happiness: Math.min(100, territory.happiness + 10),
        knowledge: territory.knowledge + 5,
      });
      effects.aqueductBuilt = true;
      effects.message = "Aqueduct built! +population capacity, +health. +10 happiness, +5 knowledge.";
    } else if (!reqs.met) {
      effects.message = `Cannot build aqueduct: ${reqs.missing}`;
    } else {
      effects.message = "Cannot build aqueduct: Need 30 wealth.";
    }
  }

  if (action === "build_grand_monument") {
    const reqs = await checkSkillRequirements({ architecture: { minExpertPercent: 10 }, masonry: { minExpertPercent: 10 } });
    if (reqs.met && territory.wealth >= 50) {
      await ctx.db.patch(territory._id, {
        wealth: territory.wealth - 50,
        influence: Math.min(100, territory.influence + 20),
        happiness: Math.min(100, territory.happiness + 10),
      });
      effects.monumentBuilt = true;
      effects.message = "Grand monument built! +20 influence, +10 happiness.";
    } else if (!reqs.met) {
      effects.message = `Cannot build grand monument: ${reqs.missing}`;
    } else {
      effects.message = "Cannot build grand monument: Need 50 wealth.";
    }
  }

  if (action === "fortify_harbor") {
    const reqs = await checkSkillRequirements({ fortification: { minExpertPercent: 10 }, engineering: { minSkilledPercent: 15 } });
    if (reqs.met && territory.wealth >= 25) {
      await ctx.db.patch(territory._id, {
        wealth: territory.wealth - 25,
        military: Math.min(100, territory.military + 8),
      });
      effects.harborFortified = true;
      effects.message = "Harbor fortified! +50% harbor defense. +8 military.";
    } else if (!reqs.met) {
      effects.message = `Cannot fortify harbor: ${reqs.missing}`;
    } else {
      effects.message = "Cannot fortify harbor: Need 25 wealth.";
    }
  }

  // Espionage & Diplomacy Actions
  if (action === "infiltrate_court" && targetTerritory) {
    const reqs = await checkSkillRequirements({ espionage: { minExpertPercent: 8 }, persuasion: { minSkilledPercent: 20 } });
    if (reqs.met && territory.wealth >= 15) {
      await ctx.db.patch(territory._id, {
        wealth: territory.wealth - 15,
        knowledge: territory.knowledge + 10,
      });
      effects.courtInfiltrated = true;
      effects.message = `Spies infiltrated ${targetTerritory.name}'s court! Gaining intelligence on their plans.`;
    } else if (!reqs.met) {
      effects.message = `Cannot infiltrate court: ${reqs.missing}`;
    } else {
      effects.message = "Cannot infiltrate court: Need 15 wealth.";
    }
  }

  if (action === "diplomatic_mission" && targetTerritory) {
    const reqs = await checkSkillRequirements({ diplomacy: { minExpertPercent: 8 }, negotiation: { minSkilledPercent: 20 } });
    if (reqs.met && territory.wealth >= 10) {
      // Improve relations
      const existingRelation = await ctx.db
        .query("relations")
        .withIndex("by_territories", (q: any) =>
          q.eq("territoryId1", territory._id).eq("territoryId2", targetTerritory._id)
        )
        .first();

      if (existingRelation) {
        await ctx.db.patch(existingRelation._id, {
          trust: Math.min(100, existingRelation.trust + 20),
        });
      }

      await ctx.db.patch(territory._id, {
        wealth: territory.wealth - 10,
        influence: Math.min(100, territory.influence + 5),
      });
      effects.diplomaticMission = true;
      effects.message = `Diplomatic mission sent to ${targetTerritory.name}! +20 trust gain, +5 influence.`;
    } else if (!reqs.met) {
      effects.message = `Cannot send diplomatic mission: ${reqs.missing}`;
    } else {
      effects.message = "Cannot send diplomatic mission: Need 10 wealth.";
    }
  }

  if (action === "propaganda_campaign" && targetTerritory) {
    const reqs = await checkSkillRequirements({ propaganda: { minExpertPercent: 8 }, literacy: { minSkilledPercent: 15 } });
    if (reqs.met && territory.wealth >= 10) {
      await ctx.db.patch(territory._id, {
        wealth: territory.wealth - 10,
        influence: Math.min(100, territory.influence + 10),
      });
      await ctx.db.patch(targetTerritory._id, {
        happiness: Math.max(0, targetTerritory.happiness - 5),
      });
      effects.propagandaCampaign = true;
      effects.message = `Propaganda campaign launched against ${targetTerritory.name}! +10 influence.`;
    } else if (!reqs.met) {
      effects.message = `Cannot launch propaganda campaign: ${reqs.missing}`;
    } else {
      effects.message = "Cannot launch propaganda campaign: Need 10 wealth.";
    }
  }

  // Industrial Era Actions
  if (action === "build_factory") {
    const reqs = await checkSkillRequirements({ steam_engineering: { minExpertPercent: 10 }, machine_tools: { minSkilledPercent: 15 } });
    if (reqs.met && territory.wealth >= 50) {
      await ctx.db.patch(territory._id, {
        wealth: territory.wealth - 50,
        technology: territory.technology + 20,
        knowledge: territory.knowledge + 10,
      });
      effects.factoryBuilt = true;
      effects.message = "Factory built! +200% goods production. +20 technology, +10 knowledge.";
    } else if (!reqs.met) {
      effects.message = `Cannot build factory: ${reqs.missing}`;
    } else {
      effects.message = "Cannot build factory: Need 50 wealth.";
    }
  }

  if (action === "build_railway" && targetTerritory) {
    const reqs = await checkSkillRequirements({ railways: { minExpertPercent: 10 }, steel_production: { minSkilledPercent: 15 } });
    if (reqs.met && territory.wealth >= 40) {
      await ctx.db.patch(territory._id, {
        wealth: territory.wealth - 40,
        technology: territory.technology + 15,
      });
      effects.railwayBuilt = true;
      effects.message = `Railway built to ${targetTerritory.name}! +100% trade speed, +50% army movement.`;
    } else if (!reqs.met) {
      effects.message = `Cannot build railway: ${reqs.missing}`;
    } else {
      effects.message = "Cannot build railway: Need 40 wealth.";
    }
  }

  if (action === "electrify_territory") {
    const reqs = await checkSkillRequirements({ electrical_engineering: { minExpertPercent: 10 }, physics: { minSkilledPercent: 15 } });
    if (reqs.met && territory.wealth >= 60) {
      await ctx.db.patch(territory._id, {
        wealth: territory.wealth - 60,
        technology: territory.technology + 25,
        happiness: Math.min(100, territory.happiness + 10),
      });
      effects.electrified = true;
      effects.message = "Territory electrified! +50% productivity, +10 happiness. +25 technology.";
    } else if (!reqs.met) {
      effects.message = `Cannot electrify territory: ${reqs.missing}`;
    } else {
      effects.message = "Cannot electrify territory: Need 60 wealth.";
    }
  }

  // Modern/Atomic Era Actions
  if (action === "develop_aircraft") {
    const reqs = await checkSkillRequirements({ aviation: { minExpertPercent: 10 }, internal_combustion: { minSkilledPercent: 15 } });
    if (reqs.met && territory.wealth >= 70) {
      await ctx.db.patch(territory._id, {
        wealth: territory.wealth - 70,
        technology: territory.technology + 30,
        military: Math.min(100, territory.military + 15),
      });
      effects.aircraftDeveloped = true;
      effects.message = "Aircraft developed! Air force capability unlocked. +30 technology, +15 military.";
    } else if (!reqs.met) {
      effects.message = `Cannot develop aircraft: ${reqs.missing}`;
    } else {
      effects.message = "Cannot develop aircraft: Need 70 wealth.";
    }
  }

  if (action === "launch_satellite") {
    const reqs = await checkSkillRequirements({ rocketry: { minExpertPercent: 12 }, computing: { minSkilledPercent: 15 } });
    if (reqs.met && territory.wealth >= 100) {
      await ctx.db.patch(territory._id, {
        wealth: territory.wealth - 100,
        technology: territory.technology + 50,
        influence: Math.min(100, territory.influence + 20),
      });
      effects.satelliteLaunched = true;
      effects.message = "Satellite launched! +global intelligence, +communication. +50 technology, +20 influence.";
    } else if (!reqs.met) {
      effects.message = `Cannot launch satellite: ${reqs.missing}`;
    } else {
      effects.message = "Cannot launch satellite: Need 100 wealth.";
    }
  }

  if (action === "nuclear_research") {
    const reqs = await checkSkillRequirements({ nuclear_physics: { minExpertPercent: 10 }, physics: { minExpertPercent: 15 } });
    if (reqs.met && territory.wealth >= 80) {
      await ctx.db.patch(territory._id, {
        wealth: territory.wealth - 80,
        technology: territory.technology + 40,
        knowledge: territory.knowledge + 30,
      });
      effects.nuclearResearch = true;
      effects.message = "Nuclear research conducted! Progress toward nuclear technology. +40 technology, +30 knowledge.";
    } else if (!reqs.met) {
      effects.message = `Cannot conduct nuclear research: ${reqs.missing}`;
    } else {
      effects.message = "Cannot conduct nuclear research: Need 80 wealth.";
    }
  }

  if (action === "develop_missile_program") {
    const reqs = await checkSkillRequirements({ missile_systems: { minExpertPercent: 10 }, rocketry: { minExpertPercent: 12 } });
    if (reqs.met && territory.wealth >= 90) {
      await ctx.db.patch(territory._id, {
        wealth: territory.wealth - 90,
        technology: territory.technology + 35,
        military: Math.min(100, territory.military + 20),
      });
      effects.missileProgram = true;
      effects.message = "Missile program developed! Ballistic missile capability unlocked. +35 technology, +20 military.";
    } else if (!reqs.met) {
      effects.message = `Cannot develop missile program: ${reqs.missing}`;
    } else {
      effects.message = "Cannot develop missile program: Need 90 wealth.";
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

  if (action === "treat_wounded") {
    // Find wounded characters and apply medication
    const characters = await ctx.db
      .query("characters")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", territory._id))
      .filter((q: any) => q.and(
        q.eq(q.field("isAlive"), true),
        q.eq(q.field("isWounded"), true)
      ))
      .collect();

    if (characters.length > 0) {
      // Import the applyMedication function
      const { applyMedication } = await import("../simulation/characters");

      // Treat the most severely wounded first
      const sortedByWound = characters.sort((a: any, b: any) =>
        (b.woundSeverity || 0) - (a.woundSeverity || 0)
      );

      const toTreat = sortedByWound[0];

      // Determine medication type based on reasoning or territory tech level
      let medicationType: "herbal" | "surgical" | "experimental" | "spiritual" | "rest" = "herbal";

      // Check reasoning for medication preference
      if (reasoning) {
        const lower = reasoning.toLowerCase();
        if (lower.includes("experimental") || lower.includes("risky")) {
          medicationType = "experimental";
        } else if (lower.includes("surgical") || lower.includes("surgery")) {
          medicationType = "surgical";
        } else if (lower.includes("spiritual") || lower.includes("prayer") || lower.includes("faith")) {
          medicationType = "spiritual";
        } else if (lower.includes("rest") || lower.includes("natural")) {
          medicationType = "rest";
        }
      }

      // Higher tech = better default treatment
      if (territory.technology > 100 && medicationType === "herbal") {
        medicationType = "surgical";
      }

      const result = await applyMedication(ctx, toTreat._id, medicationType, currentTick);
      effects.treatmentResult = {
        success: result.success,
        character: toTreat.name,
        medicationType,
        died: result.died,
        description: result.description,
      };

      // Treatment costs wealth
      await ctx.db.patch(territory._id, {
        wealth: Math.max(0, territory.wealth - 5),
      });
    } else {
      effects.treatmentResult = { success: false, error: "No wounded characters to treat" };
    }
  }

  // =============================================
  // SOCIETY SYSTEMS - RELIGION ACTIONS
  // =============================================

  if (action === "found_religion") {
    // Extract religion name from reasoning
    const religionName = extractReligionName(reasoning || "") || `${territory.name}'s Faith`;

    // Find a character to be the founder (optional)
    const ruler = await ctx.db
      .query("characters")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", territory._id))
      .filter((q: any) => q.and(q.eq(q.field("role"), "ruler"), q.eq(q.field("isAlive"), true)))
      .first();

    const result = await foundReligion(ctx, territory._id, ruler?._id, religionName, currentTick);
    effects.foundReligionResult = result;
    if (result.success) {
      await ctx.db.patch(territory._id, {
        happiness: territory.happiness + 10,
        influence: territory.influence + 5,
      });
    }
  }

  if (action === "build_temple") {
    // Find a religion to build temple for
    const religions = await ctx.db
      .query("religions")
      .withIndex("by_territory", (q: any) => q.eq("foundingTerritoryId", territory._id))
      .collect();

    // Also check for religions present in the territory
    const allReligions = await ctx.db.query("religions").collect();
    const presentReligions = allReligions.filter((r: any) =>
      r.territoriesPresent?.includes(territory._id) || r.foundingTerritoryId === territory._id
    );

    const religion = presentReligions[0] || religions[0];
    if (religion) {
      const templeName = `Temple of ${religion.deity}`;
      const result = await buildTemple(ctx, territory._id, religion._id, templeName, "temple", currentTick);
      effects.buildTempleResult = result;
      if (result.success) {
        await ctx.db.patch(territory._id, {
          happiness: territory.happiness + 3,
        });
      }
    } else {
      effects.buildTempleResult = { success: false, error: "No religion to build temple for. Found a religion first!" };
    }
  }

  if (action === "declare_state_religion") {
    const religions = await ctx.db
      .query("religions")
      .withIndex("by_territory", (q: any) => q.eq("foundingTerritoryId", territory._id))
      .collect();

    if (religions.length > 0) {
      const result = await declareStateReligion(ctx, territory._id, religions[0]._id);
      effects.stateReligionResult = result;
      if (result.success) {
        await ctx.db.patch(territory._id, {
          happiness: territory.happiness + 5,
        });
      }
    } else {
      effects.stateReligionResult = { success: false, error: "No religion exists to declare as state religion" };
    }
  }

  if (action === "ordain_priest") {
    // Find a temple first
    const temple = await ctx.db
      .query("temples")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", territory._id))
      .first();

    if (!temple) {
      effects.ordainPriestResult = { success: false, error: "No temple exists. Build a temple first!" };
    } else {
      // Find a pious character to ordain who follows the temple's religion
      const characters = await ctx.db
        .query("characters")
        .withIndex("by_territory", (q: any) => q.eq("territoryId", territory._id))
        .filter((q: any) => q.and(
          q.eq(q.field("isAlive"), true),
          q.neq(q.field("role"), "ruler")
        ))
        .collect();

      const candidate = characters.find((c: any) =>
        ((c.piety || 0) >= 50 || c.traits.wisdom > 60) &&
        (c.skills?.theology || 0) >= 30
      );

      if (candidate) {
        // Make sure character follows the religion
        if (candidate.faith !== temple.religionId) {
          await ctx.db.patch(candidate._id, { faith: temple.religionId, piety: 50 });
        }
        const result = await ordainPriest(ctx, candidate._id, temple._id);
        effects.ordainPriestResult = result;
      } else {
        effects.ordainPriestResult = { success: false, error: "No suitable candidate for priesthood (need 50+ piety and 30+ theology)" };
      }
    }
  }

  if (action === "hold_religious_festival") {
    // Boost happiness and piety
    const characters = await ctx.db
      .query("characters")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", territory._id))
      .filter((q: any) => q.eq(q.field("isAlive"), true))
      .collect();

    for (const char of characters) {
      if (char.faith) {
        await ctx.db.patch(char._id, {
          piety: Math.min(100, (char.piety || 0) + 5),
        });
      }
    }

    await ctx.db.patch(territory._id, {
      happiness: territory.happiness + 8,
      food: Math.max(0, territory.food - 5),
      wealth: Math.max(0, territory.wealth - 5),
    });
    effects.festivalResult = { success: true };
  }

  // =============================================
  // SOCIETY SYSTEMS - EDUCATION ACTIONS
  // =============================================

  if (action === "build_school") {
    // Determine school type from reasoning or default to primary
    let schoolType: "primary" | "secondary" | "university" | "military_academy" | "religious_school" | "trade_school" | "medical_school" | "law_school" = "primary";
    if (reasoning) {
      const lower = reasoning.toLowerCase();
      if (lower.includes("university")) schoolType = "university";
      else if (lower.includes("military") || lower.includes("academy")) schoolType = "military_academy";
      else if (lower.includes("religious") || lower.includes("theological")) schoolType = "religious_school";
      else if (lower.includes("trade") || lower.includes("craft")) schoolType = "trade_school";
      else if (lower.includes("medical") || lower.includes("physician")) schoolType = "medical_school";
      else if (lower.includes("law") || lower.includes("legal")) schoolType = "law_school";
      else if (lower.includes("secondary") || lower.includes("advanced")) schoolType = "secondary";
    }

    const schoolTypeName = schoolType.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    const schoolName = `${territory.name} ${schoolTypeName}`;
    const result = await createSchool(ctx, territory._id, schoolType, schoolName, currentTick);
    effects.buildSchoolResult = result;
    if (result.success) {
      await ctx.db.patch(territory._id, {
        knowledge: territory.knowledge + 5,
      });
    }
  }

  if (action === "enroll_student") {
    // Find a character to enroll and a school
    const characters = await ctx.db
      .query("characters")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", territory._id))
      .filter((q: any) => q.and(
        q.eq(q.field("isAlive"), true),
        q.neq(q.field("currentlyStudying"), true)
      ))
      .collect();

    const schools = await ctx.db
      .query("schools")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", territory._id))
      .collect();

    const student = characters.find((c: any) => c.age < 30 && c.role !== "ruler");
    const school = schools.find((s: any) => s.currentEnrollment < s.studentCapacity);

    if (student && school) {
      const result = await enrollInSchool(ctx, student._id, school._id, currentTick);
      effects.enrollStudentResult = result;
    } else if (!school) {
      effects.enrollStudentResult = { success: false, error: "No school with available capacity. Build more schools!" };
    } else {
      effects.enrollStudentResult = { success: false, error: "No eligible students to enroll" };
    }
  }

  if (action === "hire_teacher") {
    // Find a literate character to be a teacher
    const characters = await ctx.db
      .query("characters")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", territory._id))
      .filter((q: any) => q.and(
        q.eq(q.field("isAlive"), true),
        q.eq(q.field("isLiterate"), true)
      ))
      .collect();

    const schools = await ctx.db
      .query("schools")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", territory._id))
      .collect();

    const teacher = characters.find((c: any) => (c.skills?.literacy || 0) >= 50);
    const school = schools[0];

    if (teacher && school) {
      const result = await hireTeacher(ctx, school._id, teacher._id);
      effects.hireTeacherResult = result;
    } else if (!school) {
      effects.hireTeacherResult = { success: false, error: "No school to hire teachers for" };
    } else {
      effects.hireTeacherResult = { success: false, error: "No qualified teachers available (need 50+ literacy)" };
    }
  }

  if (action === "expand_library") {
    // Find a school and expand its library
    const school = await ctx.db
      .query("schools")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", territory._id))
      .first();

    if (school) {
      await ctx.db.patch(school._id, {
        librarySize: school.librarySize + 20,
        educationQuality: Math.min(100, school.educationQuality + 5),
      });
      await ctx.db.patch(territory._id, {
        wealth: Math.max(0, territory.wealth - 10),
        knowledge: territory.knowledge + 2,
      });
      effects.expandLibraryResult = { success: true };
    } else {
      effects.expandLibraryResult = { success: false, error: "No school to expand library" };
    }
  }

  // =============================================
  // SOCIETY SYSTEMS - GUILD ACTIONS
  // =============================================

  if (action === "found_guild") {
    // Determine guild type from reasoning
    let guildType: "blacksmiths" | "masons" | "carpenters" | "weavers" | "merchants" | "miners" | "farmers" | "physicians" | "scribes" | "entertainers" = "merchants";
    if (reasoning) {
      const lower = reasoning.toLowerCase();
      if (lower.includes("blacksmith") || lower.includes("smith")) guildType = "blacksmiths";
      else if (lower.includes("mason") || lower.includes("stone")) guildType = "masons";
      else if (lower.includes("carpenter") || lower.includes("wood")) guildType = "carpenters";
      else if (lower.includes("weaver") || lower.includes("cloth") || lower.includes("textile")) guildType = "weavers";
      else if (lower.includes("miner") || lower.includes("mining")) guildType = "miners";
      else if (lower.includes("farmer") || lower.includes("agriculture")) guildType = "farmers";
      else if (lower.includes("physician") || lower.includes("doctor") || lower.includes("healer")) guildType = "physicians";
      else if (lower.includes("scribe") || lower.includes("writer")) guildType = "scribes";
      else if (lower.includes("entertainer") || lower.includes("performer")) guildType = "entertainers";
    }

    // Find a master craftsman to found the guild
    const characters = await ctx.db
      .query("characters")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", territory._id))
      .filter((q: any) => q.eq(q.field("isAlive"), true))
      .collect();

    const founder = characters.find((c: any) => c.skills && (c.skills.smithing > 50 || c.skills.carpentry > 50 || c.skills.trading > 50 || c.skills.masonry > 50));

    if (!founder) {
      effects.foundGuildResult = { success: false, error: "No qualified craftsman to found guild (need 50+ skill)" };
    } else {
      const guildTypeName = guildType.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
      const guildName = `${territory.name} Guild of ${guildTypeName}`;
      const result = await foundGuild(ctx, territory._id, guildType, guildName, founder._id, currentTick);
      effects.foundGuildResult = result;
      if (result.success) {
        await ctx.db.patch(territory._id, {
          wealth: territory.wealth + 3,
          influence: territory.influence + 2,
        });
      }
    }
  }

  if (action === "join_guild") {
    // Find a character and appropriate guild
    const guilds = await ctx.db
      .query("guilds")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", territory._id))
      .collect();

    const characters = await ctx.db
      .query("characters")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", territory._id))
      .filter((q: any) => q.and(
        q.eq(q.field("isAlive"), true),
        q.not(q.neq(q.field("guildId"), undefined))
      ))
      .collect();

    const unguildedCharacters = characters.filter((c: any) => !c.guildId);
    const candidate = unguildedCharacters[0];
    const guild = guilds[0];

    if (candidate && guild) {
      const result = await joinGuild(ctx, candidate._id, guild._id, currentTick);
      effects.joinGuildResult = result;
    } else if (!guild) {
      effects.joinGuildResult = { success: false, error: "No guilds exist. Found a guild first!" };
    } else {
      effects.joinGuildResult = { success: false, error: "No eligible characters to join guild" };
    }
  }

  if (action === "grant_monopoly") {
    const guild = await ctx.db
      .query("guilds")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", territory._id))
      .filter((q: any) => q.eq(q.field("hasMonopoly"), false))
      .first();

    if (guild) {
      const result = await grantMonopoly(ctx, guild._id, currentTick);
      effects.grantMonopolyResult = result;
    } else {
      effects.grantMonopolyResult = { success: false, error: "No guild without monopoly to grant it to" };
    }
  }

  if (action === "build_guild_hall") {
    const guild = await ctx.db
      .query("guilds")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", territory._id))
      .filter((q: any) => q.eq(q.field("hasGuildHall"), false))
      .first();

    if (guild) {
      const result = await buildGuildHall(ctx, guild._id);
      effects.buildGuildHallResult = result;
    } else {
      effects.buildGuildHallResult = { success: false, error: "No guild without hall, or all guilds already have halls" };
    }
  }

  // =============================================
  // SOCIETY SYSTEMS - JUDICIAL ACTIONS
  // =============================================

  if (action === "establish_law_code") {
    // Determine severity from reasoning
    let severity: "lenient" | "moderate" | "harsh" | "draconian" = "moderate";
    if (reasoning) {
      const lower = reasoning.toLowerCase();
      if (lower.includes("lenient") || lower.includes("merciful") || lower.includes("gentle")) severity = "lenient";
      else if (lower.includes("harsh") || lower.includes("strict") || lower.includes("severe")) severity = "harsh";
      else if (lower.includes("draconian") || lower.includes("brutal") || lower.includes("death for")) severity = "draconian";
    }

    const ruler = await ctx.db
      .query("characters")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", territory._id))
      .filter((q: any) => q.and(q.eq(q.field("role"), "ruler"), q.eq(q.field("isAlive"), true)))
      .first();

    if (ruler) {
      const lawCodeName = `Code of ${ruler.name}`;
      const result = await establishLawCode(ctx, territory._id, lawCodeName, severity, ruler._id, currentTick);
      effects.establishLawCodeResult = result;
      if (result.success) {
        await ctx.db.patch(territory._id, {
          influence: territory.influence + 3,
        });
      }
    } else {
      effects.establishLawCodeResult = { success: false, error: "No ruler to establish law code" };
    }
  }

  if (action === "report_crime") {
    // This is more of a spontaneous event, but allow manual reporting
    effects.reportCrimeResult = { success: false, error: "Crimes occur naturally in the simulation. Use hold_trial to try reported crimes." };
  }

  if (action === "hold_trial") {
    // Find a pending crime
    const crimes = await ctx.db
      .query("crimes")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", territory._id))
      .filter((q: any) => q.eq(q.field("status"), "awaiting_trial"))
      .collect();

    if (crimes.length > 0) {
      const crime = crimes[0];

      // Find a judge
      const characters = await ctx.db
        .query("characters")
        .withIndex("by_territory", (q: any) => q.eq("territoryId", territory._id))
        .filter((q: any) => q.eq(q.field("isAlive"), true))
        .collect();

      const judge = characters.find((c: any) => c.profession === "judge" || c.role === "ruler");

      if (judge) {
        const trialResult = await beginTrial(ctx, crime._id, judge._id, currentTick);
        if (trialResult.success && trialResult.trialId) {
          // Fast forward to verdict for AI decisions
          const verdictResult = await renderVerdict(ctx, trialResult.trialId, currentTick);
          effects.holdTrialResult = {
            success: true,
            crime: crime.crimeType,
            verdict: verdictResult.verdict,
            sentence: verdictResult.sentence
          };
        } else {
          effects.holdTrialResult = trialResult;
        }
      } else {
        effects.holdTrialResult = { success: false, error: "No judge available. Appoint a judge first!" };
      }
    } else {
      effects.holdTrialResult = { success: false, error: "No crimes awaiting trial" };
    }
  }

  if (action === "pardon_criminal") {
    // Find a convicted crime to pardon
    const crime = await ctx.db
      .query("crimes")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", territory._id))
      .filter((q: any) => q.eq(q.field("status"), "convicted"))
      .first();

    // Find the ruler to issue the pardon
    const ruler = await ctx.db
      .query("characters")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", territory._id))
      .filter((q: any) => q.and(q.eq(q.field("role"), "ruler"), q.eq(q.field("isAlive"), true)))
      .first();

    if (crime && ruler) {
      const result = await pardonCriminal(ctx, crime._id, ruler._id);
      effects.pardonResult = result;
    } else if (!crime) {
      effects.pardonResult = { success: false, error: "No convicted criminals to pardon" };
    } else {
      effects.pardonResult = { success: false, error: "No ruler to issue pardon" };
    }
  }

  if (action === "build_prison") {
    // Determine conditions from reasoning
    let conditions: "humane" | "standard" | "harsh" | "dungeon" = "standard";
    if (reasoning) {
      const lower = reasoning.toLowerCase();
      if (lower.includes("humane") || lower.includes("rehabilitat")) conditions = "humane";
      else if (lower.includes("dungeon") || lower.includes("terrible") || lower.includes("pit")) conditions = "dungeon";
      else if (lower.includes("harsh") || lower.includes("brutal")) conditions = "harsh";
    }

    const prisonName = `${territory.name} ${conditions === "dungeon" ? "Dungeon" : "Prison"}`;
    const capacity = conditions === "dungeon" ? 20 : conditions === "harsh" ? 30 : 50;
    const result = await buildPrison(ctx, territory._id, prisonName, conditions, capacity);
    effects.buildPrisonResult = result;
  }

  if (action === "appoint_judge") {
    // Find a character with law knowledge
    const characters = await ctx.db
      .query("characters")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", territory._id))
      .filter((q: any) => q.and(
        q.eq(q.field("isAlive"), true),
        q.neq(q.field("role"), "ruler"),
        q.neq(q.field("profession"), "judge")
      ))
      .collect();

    const candidate = characters.find((c: any) =>
      (c.skills?.law || 0) > 30 ||
      c.traits.wisdom > 60 ||
      c.traits.justice > 60
    );

    if (candidate) {
      await ctx.db.patch(candidate._id, {
        profession: "judge",
        title: "Judge",
      });
      effects.appointJudgeResult = { success: true, judge: candidate.name };
    } else {
      effects.appointJudgeResult = { success: false, error: "No suitable candidate for judge (need law skill or high wisdom/justice)" };
    }
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

          // Record positive memory - especially meaningful if target is struggling
          const targetKnowledgeLow = targetTerritory.technology < 30;
          await recordActionMemory(
            ctx,
            targetTerritory._id,
            "share_knowledge",
            territory._id,
            targetKnowledgeLow
              ? `${territory.name} shared crucial knowledge with us when we were struggling!`
              : `${territory.name} shared their knowledge with us, a gesture of friendship.`,
            targetKnowledgeLow ? 60 : 35 // Higher if they really needed it
          );
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

            // Record trade memory - especially meaningful if target is in crisis (low food/wealth)
            const targetInCrisis = targetTerritory.food < 20 || targetTerritory.wealth < 15;
            if (targetInCrisis) {
              await recordActionMemory(
                ctx,
                targetTerritory._id,
                "trade_goods",
                territory._id,
                `${territory.name} traded with us during our crisis - they may have saved lives!`,
                65 // Strong positive memory for help during crisis
              );
            }
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

          // Check if this is a betrayal (attacking an ally or trade partner)
          const wasBetrayal = relationship.hasAlliance || relationship.hasTradeAgreement || relationship.status === "allied" || relationship.status === "friendly";

          // Record memories for both sides
          if (wasBetrayal) {
            // Record betrayal memories (much stronger negative emotions)
            await recordActionMemory(
              ctx,
              targetTerritory._id,
              "raid", // The memory system will interpret based on context
              territory._id,
              `${territory.name} BETRAYED us! They attacked despite our ${relationship.hasAlliance ? "alliance" : "trade agreement"}!`,
              -90 // Very strong negative emotion for betrayal
            );
            // Create betrayal bond directly
            const targetAgent = await ctx.db
              .query("agents")
              .withIndex("by_territory", (q: any) => q.eq("territoryId", targetTerritory._id))
              .first();
            if (targetAgent) {
              await createBond(
                ctx,
                targetTerritory._id,
                territory._id,
                "betrayal_grudge",
                80,
                `${territory.name} broke our sacred ${relationship.hasAlliance ? "alliance" : "trade agreement"} with a treacherous attack!`,
                true // Hereditary - betrayals are remembered for generations
              );
            }
          } else {
            // Normal raid memories
            await recordActionMemory(
              ctx,
              territory._id,
              "raid",
              targetTerritory._id,
              raidResult.attackerWins
                ? `We raided ${targetTerritory.name} and emerged victorious!`
                : `Our raid against ${targetTerritory.name} failed.`,
              raidResult.attackerWins ? 40 : -30
            );
            await recordActionMemory(
              ctx,
              targetTerritory._id,
              "raid",
              territory._id,
              raidResult.attackerWins
                ? `${territory.name} attacked us in a devastating raid!`
                : `We repelled a raid from ${territory.name}!`,
              raidResult.attackerWins ? -70 : 30
            );
          }
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

            // =============================================
            // ORGANIC AI GROWTH - Record war ending memories
            // =============================================
            // Both sides remember the peace treaty
            await recordActionMemory(
              ctx,
              territory._id,
              "accept_peace",
              targetTerritory._id,
              `We accepted peace with ${targetTerritory.name}. The war is over.`,
              35 // Positive - war ended, though not triumphant
            );
            await recordActionMemory(
              ctx,
              targetTerritory._id,
              "accept_peace",
              territory._id,
              `${territory.name} accepted our peace offer. The bloodshed has ended.`,
              40 // Slightly more positive - they offered peace and it was accepted
            );
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

            // Record defeat memory
            await recordActionMemory(
              ctx,
              territory._id,
              "surrender",
              targetTerritory._id,
              `We surrendered to ${targetTerritory.name}. A dark day for our people.`,
              -75
            );
            // Record victory memory for the winner
            await recordActionMemory(
              ctx,
              targetTerritory._id,
              "surrender",
              territory._id,
              `${territory.name} surrendered to us! Our victory is complete.`,
              70
            );
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

            // Record positive memory for both sides
            await recordActionMemory(
              ctx,
              territory._id,
              "form_alliance",
              targetTerritory._id,
              `We forged an alliance with ${targetTerritory.name}. Together we are stronger!`,
              60
            );
            await recordActionMemory(
              ctx,
              targetTerritory._id,
              "form_alliance",
              territory._id,
              `${territory.name} sought our alliance and we accepted. A new bond is formed.`,
              55
            );
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
    // Organic Knowledge Progression
    case "encourage_craft":
    case "apprenticeship_program":
    case "knowledge_festival":
    case "share_technology":
    case "establish_academy":
    case "establish_trade_route":
    // Skill-Based Actions - Crafting & Agriculture
    case "forge_quality_weapons":
    case "forge_quality_armor":
    case "build_warships":
    case "construct_siege_equipment":
    case "advanced_irrigation":
    case "selective_breeding":
    // Skill-Based Actions - Knowledge & Science
    case "scientific_expedition":
    case "medical_research":
    case "astronomical_observation":
    case "philosophical_debates":
    // Skill-Based Actions - Construction
    case "build_aqueduct":
    case "build_grand_monument":
    case "fortify_harbor":
    // Skill-Based Actions - Industrial/Modern
    case "build_factory":
    case "build_railway":
    case "electrify_territory":
    case "develop_aircraft":
    case "launch_satellite":
    // Skill-Based Actions - Military
    case "train_elite_guard":
    case "cavalry_charge":
    case "diplomatic_mission":
    // Survival actions
    case "gather_wood":
    case "build_houses":
    case "preserve_food":
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
    // Survival info action
    case "stockpile_fuel":
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
    // Skill-Based Actions - Aggressive
    case "flanking_maneuver":
    case "naval_blockade":
    case "infiltrate_court":
    case "propaganda_campaign":
      return "negative";

    // Critical actions
    case "raid":
    case "raid_caravan":
    case "suppress_faction":
    case "lay_siege":
    case "assault_walls":
    // Skill-Based Actions - Critical/Military
    case "nuclear_research":
    case "develop_missile_program":
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

    // Society Systems - Religion (positive)
    case "found_religion":
    case "build_temple":
    case "declare_state_religion":
    case "ordain_priest":
    case "hold_religious_festival":
      return "positive";

    // Society Systems - Education (positive)
    case "build_school":
    case "enroll_student":
    case "hire_teacher":
    case "expand_library":
      return "positive";

    // Society Systems - Guilds (positive/info)
    case "found_guild":
    case "build_guild_hall":
      return "positive";
    case "join_guild":
    case "grant_monopoly":
      return "info";

    // Society Systems - Judicial
    case "establish_law_code":
    case "build_prison":
    case "appoint_judge":
      return "info";
    case "hold_trial":
      return "negative";
    case "pardon_criminal":
      return "positive";

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

// =============================================
// ORGANIC AI GROWTH - QUERIES
// =============================================

export const getAgentMemories = internalQuery({
  args: { agentId: v.id("agents"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit || 10;

    const memories = await ctx.db
      .query("agentMemories")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .collect();

    // Filter out forgotten memories (salience < 10) and sort by relevance
    const activeMemories = memories
      .filter(m => m.salience >= 10)
      .sort((a, b) => {
        // Sort by salience * |emotionalWeight|
        const scoreA = a.salience * (Math.abs(a.emotionalWeight) / 100);
        const scoreB = b.salience * (Math.abs(b.emotionalWeight) / 100);
        return scoreB - scoreA;
      })
      .slice(0, limit);

    return activeMemories;
  },
});

export const getAgentBonds = internalQuery({
  args: { territoryId: v.id("territories") },
  handler: async (ctx, args) => {
    // Get bonds where this territory is the "from" side
    const bondsFrom = await ctx.db
      .query("civilizationBonds")
      .withIndex("by_from", (q) => q.eq("fromTerritoryId", args.territoryId))
      .filter((q) => q.neq(q.field("status"), "forgotten"))
      .collect();

    return bondsFrom;
  },
});

export const getAgentGoals = internalQuery({
  args: { agentId: v.id("agents") },
  handler: async (ctx, args) => {
    const agent = await ctx.db.get(args.agentId);
    if (!agent) return [];

    return agent.emergentGoals || [];
  },
});

// =============================================
// ORGANIC AI GROWTH - MEMORY RECORDING HELPERS
// =============================================

/**
 * Record a memory when a significant event occurs during an action
 */
async function recordActionMemory(
  ctx: any,
  territoryId: Id<"territories">,
  action: string,
  targetTerritoryId: Id<"territories"> | undefined,
  outcome: string,
  emotionalWeight: number
): Promise<void> {
  // Get the agent for this territory
  const agent = await ctx.db
    .query("agents")
    .withIndex("by_territory", (q: any) => q.eq("territoryId", territoryId))
    .first();

  if (!agent) return;

  // Determine memory type from action
  const actionToMemoryType: Record<string, MemoryType> = {
    "raid": "war",
    "show_strength": "insult",
    "form_alliance": "alliance",
    "trade_goods": "trade",
    "share_knowledge": "gift",
    "surrender": "defeat",
    "accept_peace": "alliance",
    "declare_vendetta": "war",
    "seek_reconciliation": "alliance",
  };

  const memoryType = actionToMemoryType[action];
  if (!memoryType) return; // Not a memory-worthy action

  // Record the memory
  const memoryId = await recordMemory(ctx, agent._id, {
    type: memoryType,
    targetTerritoryId,
    description: outcome,
    emotionalWeight,
  });

  // Check if this memory should create a bond
  const memory = await ctx.db.get(memoryId);
  if (memory && shouldCreateBond(memory)) {
    await createBondFromMemory(ctx, memory, true);
  }
}

// =============================================
// SOCIETY SYSTEMS - HELPER EXTRACTION FUNCTIONS
// =============================================

/**
 * Extract religion name from AI reasoning
 */
function extractReligionName(reasoning: string): string | undefined {
  const patterns = [
    /(?:call|name|found|establish)\s+(?:the\s+)?(?:religion|faith|church|temple)\s+["']?([A-Z][a-zA-Z\s]+)["']?/i,
    /(?:religion|faith)\s+(?:called|named|of)\s+["']?([A-Z][a-zA-Z\s]+)["']?/i,
    /["']([A-Z][a-zA-Z\s]+)["']?\s+(?:religion|faith|worship)/i,
    /followers?\s+of\s+["']?([A-Z][a-zA-Z\s]+)["']?/i,
  ];

  for (const pattern of patterns) {
    const match = reasoning.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return undefined;
}

/**
 * Extract deity name from AI reasoning
 */
function extractDeity(reasoning: string): string | undefined {
  const patterns = [
    /(?:worship|honor|revere|pray to|god|goddess|deity)\s+(?:called|named)?\s*["']?([A-Z][a-zA-Z\s]+)["']?/i,
    /["']?([A-Z][a-zA-Z]+)["']?\s+(?:is our|as our|the)\s+(?:god|goddess|deity|divine|patron)/i,
    /(?:great|supreme|divine)\s+["']?([A-Z][a-zA-Z]+)["']?/i,
    /(?:the\s+)?(?:god|goddess)\s+["']?([A-Z][a-zA-Z]+)["']?/i,
  ];

  for (const pattern of patterns) {
    const match = reasoning.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return undefined;
}
