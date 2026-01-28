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
import { prospectResources, mintCoins, debaseCurrency, takeLoan, setTaxRates, setPriceControl } from "../simulation/economy";
import { evolvePersonalityFromAction, updateAgentArchetype } from "../simulation/personalityEvolution";
// Organic AI Growth - Memory and Bond recording
import { recordMemory, MemoryType } from "../simulation/memory";
import { createBondFromMemory, createBond, shouldCreateBond } from "../simulation/bonds";
// Society Systems - Religion, Education, Guilds, Judicial
import { foundReligion, buildTemple, declareStateReligion, ordainPriest } from "../simulation/religion";
import { createSchool, enrollInSchool, hireTeacher } from "../simulation/education";
import { foundGuild, joinGuild, grantMonopoly, buildGuildHall } from "../simulation/guilds";
import { establishLawCode, reportCrime, beginTrial, renderVerdict, pardonCriminal, buildPrison } from "../simulation/judicial";
// Human Life Systems - Marriage, Dynasty, Romance, etc.
import { arrangePoliticalMarriage } from "../simulation/marriage";
import { createDynasty, setInheritanceRule, legitimizeBastard } from "../simulation/dynasties";
import { encourageMatch, forbidRelationship } from "../simulation/romance";
import { startConstruction as startInfrastructureConstruction } from "../simulation/infrastructureSystem";
import { launchExpedition } from "../simulation/exploration";
import { trainSpy, deploySpy, extractSpy, increaseCounterIntelligence, handleCapturedSpy } from "../simulation/espionage";
import { grantWomenRights, restrictWomenRoles } from "../simulation/gender";
import { conscriptSoldiers, callUpReserves, activateEmergencyMeasures, careForWidowsOrphans } from "../simulation/warDemographics";
import { establishHealingSanctuary, exileMadCharacter } from "../simulation/mentalHealth";
import { banSubstances, regulateTaverns } from "../simulation/addiction";
// Knowledge Transfer System (Education)
import { assignApprentice, enrollInSchool as enrollInSchoolKT } from "../simulation/knowledgeTransfer";
// Profession Skills System
import { canPerformAction, getSkillsSummary, getBlockedActions, calculateActionSuccess, applyExperienceGain } from "../simulation/professionSkills";

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
      // Human Life Systems - Marriage & Dynasty
      arrange_political_marriage: "Arranged Political Marriage",
      set_inheritance_law: "Set Inheritance Law",
      legitimize_bastard: "Legitimized Bastard",
      // Human Life Systems - Romance
      encourage_match: "Encouraged Romantic Match",
      forbid_relationship: "Forbade Relationship",
      // Human Life Systems - Infrastructure
      build_road: "Built Road",
      build_wall: "Built Defensive Wall",
      build_aqueduct_infrastructure: "Built Aqueduct",
      build_harbor: "Built Harbor",
      // Human Life Systems - Exploration
      launch_expedition: "Launched Expedition",
      establish_colony: "Established Colony",
      // Human Life Systems - Espionage
      train_spy: "Trained Spy",
      deploy_spy: "Deployed Spy",
      extract_spy: "Extracted Spy",
      increase_counter_intelligence: "Increased Counter-Intelligence",
      execute_captured_spy: "Executed Captured Spy",
      turn_captured_spy: "Turned Captured Spy",
      // Human Life Systems - Gender & Society
      grant_women_rights: "Granted Women's Rights",
      restrict_women_roles: "Restricted Women's Roles",
      // Human Life Systems - War Demographics
      conscript_reserves: "Called Up Reserves",
      emergency_conscription: "Emergency Conscription",
      care_for_widows: "Cared for Widows and Orphans",
      // Human Life Systems - Mental Health
      establish_healing_sanctuary: "Established Healing Sanctuary",
      exile_madman: "Exiled Mad Character",
      // Human Life Systems - Addiction
      ban_substances: "Banned Substances",
      tavern_regulation: "Regulated Taverns",
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
  // SPECIALIZED SURVIVAL ACTIONS (Require Skilled Workers!)
  // Not just anyone can build a well or perform surgery.
  // =============================================

  if (action === "dig_well") {
    const skillCheck = await canPerformAction(ctx, territory._id, "dig_well");
    if (!skillCheck.canPerform) {
      effects.message = skillCheck.reason;
      effects.actionBlocked = true;
    } else {
      const actionResult = await calculateActionSuccess(ctx, territory._id, "dig_well");
      if (actionResult.success) {
        const territory_updated = await ctx.db.get(territory._id);
        const water = territory_updated?.water || { stored: 0, wells: 0, hasRiver: false, quality: 80 };
        await ctx.db.patch(territory._id, {
          water: { ...water, wells: water.wells + 1 },
          wealth: Math.max(0, territory.wealth - 5),
        });
        // Apply experience to workers
        await applyExperienceGain(ctx, actionResult.experienceGained);
        effects.message = `Well dug successfully! Workers gained experience. Quality: ${Math.round(actionResult.qualityModifier * 100)}%`;
      } else {
        effects.message = "Well construction failed! Workers need more practice.";
      }
    }
  }

  if (action === "build_sewer") {
    const skillCheck = await canPerformAction(ctx, territory._id, "build_sewer");
    if (!skillCheck.canPerform) {
      effects.message = skillCheck.reason;
      effects.actionBlocked = true;
    } else {
      const actionResult = await calculateActionSuccess(ctx, territory._id, "build_sewer");
      if (actionResult.success) {
        const territory_updated = await ctx.db.get(territory._id);
        const sanitation = territory_updated?.sanitation || { wasteLevel: 0, sewerCapacity: 0, latrines: 0 };
        await ctx.db.patch(territory._id, {
          sanitation: { ...sanitation, sewerCapacity: sanitation.sewerCapacity + 100 },
          wealth: Math.max(0, territory.wealth - 20),
        });
        await applyExperienceGain(ctx, actionResult.experienceGained);
        effects.message = `Sewer system built! Sanitation greatly improved. Workers gained engineering experience.`;
      } else {
        effects.message = "Sewer construction failed! Need more skilled masons and engineers.";
      }
    }
  }

  if (action === "build_latrine") {
    const skillCheck = await canPerformAction(ctx, territory._id, "build_latrine");
    if (!skillCheck.canPerform) {
      effects.message = skillCheck.reason;
      effects.actionBlocked = true;
    } else {
      const actionResult = await calculateActionSuccess(ctx, territory._id, "build_latrine");
      if (actionResult.success) {
        const territory_updated = await ctx.db.get(territory._id);
        const sanitation = territory_updated?.sanitation || { wasteLevel: 0, sewerCapacity: 0, latrines: 0 };
        await ctx.db.patch(territory._id, {
          sanitation: { ...sanitation, latrines: sanitation.latrines + 1 },
        });
        await applyExperienceGain(ctx, actionResult.experienceGained);
        effects.message = `Latrine built! Basic sanitation improved.`;
      } else {
        effects.message = "Failed to build latrine properly. Need carpentry skills.";
      }
    }
  }

  if (action === "build_smokehouse") {
    const skillCheck = await canPerformAction(ctx, territory._id, "build_smokehouse");
    if (!skillCheck.canPerform) {
      effects.message = skillCheck.reason;
      effects.actionBlocked = true;
    } else {
      const actionResult = await calculateActionSuccess(ctx, territory._id, "build_smokehouse");
      if (actionResult.success) {
        const territory_updated = await ctx.db.get(territory._id);
        const preservation = territory_updated?.preservation || { preservedFood: 0, salt: 0, smokehouses: 0 };
        await ctx.db.patch(territory._id, {
          preservation: { ...preservation, smokehouses: preservation.smokehouses + 1 },
        });
        await applyExperienceGain(ctx, actionResult.experienceGained);
        effects.message = `Smokehouse built! Can now preserve food for winter.`;
      } else {
        effects.message = "Failed to build smokehouse. Need carpentry skills.";
      }
    }
  }

  if (action === "train_healer" || action === "gather_herbs") {
    const skillCheck = await canPerformAction(ctx, territory._id, action);
    if (!skillCheck.canPerform) {
      effects.message = skillCheck.reason;
      effects.actionBlocked = true;
    } else {
      const actionResult = await calculateActionSuccess(ctx, territory._id, action);
      if (actionResult.success) {
        const territory_updated = await ctx.db.get(territory._id);
        const medicine = territory_updated?.medicine || { herbs: 0 };
        if (action === "gather_herbs") {
          await ctx.db.patch(territory._id, {
            medicine: { ...medicine, herbs: medicine.herbs + 10 },
          });
          effects.message = `Herbs gathered successfully! +10 medicinal herbs.`;
        } else {
          // Train healer - create a new healer character or upgrade existing
          effects.message = `Healer trained! Medical care improved.`;
        }
        await applyExperienceGain(ctx, actionResult.experienceGained);
      } else {
        effects.message = `Medical action failed. Need someone with medicine knowledge.`;
      }
    }
  }

  if (action === "make_clothing") {
    const skillCheck = await canPerformAction(ctx, territory._id, "make_clothing");
    if (!skillCheck.canPerform) {
      effects.message = skillCheck.reason;
      effects.actionBlocked = true;
    } else {
      const actionResult = await calculateActionSuccess(ctx, territory._id, "make_clothing");
      if (actionResult.success) {
        const territory_updated = await ctx.db.get(territory._id);
        const clothing = territory_updated?.clothing || { supply: 0, condition: 100 };
        await ctx.db.patch(territory._id, {
          clothing: { ...clothing, supply: clothing.supply + 10 },
          wealth: Math.max(0, territory.wealth - 3),
        });
        await applyExperienceGain(ctx, actionResult.experienceGained);
        effects.message = `Clothing made! +10 clothing supply. Essential for winter survival.`;
      } else {
        effects.message = "Clothing production failed. Need tailoring skills.";
      }
    }
  }

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
  // TREASURY & FINANCE ACTIONS
  // =============================================

  if (action === "mint_coins") {
    const result = await mintCoins(ctx, territory._id, "silver", 10, currentTick);
    effects.mintResult = result;
  }

  if (action === "debase_currency") {
    const result = await debaseCurrency(ctx, territory._id, 10, currentTick);
    effects.debaseResult = result;
  }

  if (action === "take_loan") {
    const result = await takeLoan(ctx, territory._id, "merchant", 100, 10, 12, currentTick);
    effects.loanResult = result;
  }

  if (action === "repay_loan") {
    // Find oldest active loan and repay it
    const loans = await ctx.db
      .query("loans")
      .withIndex("by_borrower", (q: any) => q.eq("borrowerTerritoryId", territory._id))
      .filter((q: any) => q.eq(q.field("status"), "active"))
      .collect();

    if (loans.length > 0) {
      const oldestLoan = loans[0];
      // Make a payment
      const treasury = await ctx.db
        .query("treasury")
        .withIndex("by_territory", (q: any) => q.eq("territoryId", territory._id))
        .first();

      if (treasury && treasury.copperCoins >= oldestLoan.monthlyPayment) {
        await ctx.db.patch(treasury._id, {
          copperCoins: treasury.copperCoins - oldestLoan.monthlyPayment,
        });
        await ctx.db.patch(oldestLoan._id, {
          monthsPaid: (oldestLoan.monthsPaid || 0) + 1,
          remainingAmount: Math.max(0, oldestLoan.remainingAmount - oldestLoan.monthlyPayment),
        });
        effects.repayResult = { success: true, amountPaid: oldestLoan.monthlyPayment };
      } else {
        effects.repayResult = { success: false, error: "Insufficient funds" };
      }
    } else {
      effects.repayResult = { success: false, error: "No active loans" };
    }
  }

  if (action === "raise_taxes") {
    const result = await setTaxRates(ctx, territory._id, { landTaxRate: 15, tradeTaxRate: 10, pollTaxRate: 5 });
    effects.taxResult = result;
    // Higher taxes = less happiness
    await ctx.db.patch(territory._id, {
      happiness: Math.max(0, territory.happiness - 5),
    });
  }

  if (action === "lower_taxes") {
    const result = await setTaxRates(ctx, territory._id, { landTaxRate: 5, tradeTaxRate: 3, pollTaxRate: 1 });
    effects.taxResult = result;
    // Lower taxes = more happiness
    await ctx.db.patch(territory._id, {
      happiness: Math.min(100, territory.happiness + 3),
    });
  }

  if (action === "establish_bank") {
    // Create a bank for this territory
    const existingBanks = await ctx.db
      .query("banks")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", territory._id))
      .collect();

    if (existingBanks.length < 3) {
      await ctx.db.insert("banks", {
        territoryId: territory._id,
        name: `${territory.name} Bank`,
        deposits: 0,
        loans: 0,
        interestRate: 8,
        foundedTick: currentTick,
        reputation: 50,
        isRoyal: existingBanks.length === 0, // First bank is royal
      });
      effects.bankResult = { success: true };
    } else {
      effects.bankResult = { success: false, error: "Too many banks already" };
    }
  }

  if (action === "set_price_controls") {
    const result = await setPriceControl(ctx, territory._id, "food", 15, currentTick);
    effects.priceControlResult = result;
    // Price controls may improve happiness short-term
    await ctx.db.patch(territory._id, {
      happiness: Math.min(100, territory.happiness + 2),
    });
  }

  if (action === "remove_price_controls") {
    const controls = await ctx.db
      .query("priceControls")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", territory._id))
      .filter((q: any) => q.eq(q.field("isActive"), true))
      .collect();

    for (const control of controls) {
      await ctx.db.patch(control._id, { isActive: false });
    }
    effects.priceControlsRemoved = controls.length;
  }

  if (action === "increase_wages") {
    const laborMarket = await ctx.db
      .query("laborMarket")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", territory._id))
      .first();

    if (laborMarket) {
      await ctx.db.patch(laborMarket._id, {
        unskilledWage: laborMarket.unskilledWage + 1,
        skilledWage: laborMarket.skilledWage + 2,
      });
      effects.wageResult = { success: true };
      // Higher wages = happier workers
      await ctx.db.patch(territory._id, {
        happiness: Math.min(100, territory.happiness + 2),
      });
    }
  }

  if (action === "crack_down_tax_evaders") {
    const taxPolicy = await ctx.db
      .query("taxPolicy")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", territory._id))
      .first();

    if (taxPolicy && taxPolicy.taxEvaders > 5) {
      await ctx.db.patch(taxPolicy._id, {
        taxEvaders: Math.max(0, taxPolicy.taxEvaders - 10),
        collectionEfficiency: Math.min(100, taxPolicy.collectionEfficiency + 5),
      });
      effects.crackdownResult = { success: true };
      // Crackdown angers the wealthy
      await ctx.db.patch(territory._id, {
        happiness: Math.max(0, territory.happiness - 2),
      });
    }
  }

  if (action === "grant_tax_exemption") {
    const taxPolicy = await ctx.db
      .query("taxPolicy")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", territory._id))
      .first();

    if (taxPolicy) {
      const exemptions = taxPolicy.taxExemptions || [];
      if (!exemptions.includes("nobles")) {
        await ctx.db.patch(taxPolicy._id, {
          taxExemptions: [...exemptions, "nobles"],
        });
        effects.exemptionResult = { success: true, group: "nobles" };
      }
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
  // EDUCATION & KNOWLEDGE TRANSFER ACTIONS
  // New generations can learn from schools/libraries
  // instead of rediscovering everything through crises!
  // =============================================

  if (action === "establish_school") {
    // Check if we have teachers available
    const teachers = await ctx.db
      .query("characters")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", territory._id))
      .filter((q: any) => q.and(
        q.eq(q.field("isAlive"), true),
        q.gte(q.field("skills.literacy"), 40)
      ))
      .collect();

    if (teachers.length < 2) {
      effects.message = "Cannot establish school: Need at least 2 literate people (literacy 40+) to teach.";
    } else if (territory.wealth < 20) {
      effects.message = "Cannot establish school: Need 20 wealth.";
    } else {
      // Create the school
      const result = await createSchool(ctx, territory._id, "primary", currentTick);
      effects.schoolResult = result;
      if (result.success) {
        await ctx.db.patch(territory._id, {
          wealth: territory.wealth - 20,
          knowledge: territory.knowledge + 3,
        });
        effects.message = `School established! Children can now learn skills 3x faster than trial-and-error.`;
      }
    }
  }

  if (action === "build_library") {
    // Check if we have scribes
    const scribes = await ctx.db
      .query("characters")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", territory._id))
      .filter((q: any) => q.and(
        q.eq(q.field("isAlive"), true),
        q.gte(q.field("skills.literacy"), 50)
      ))
      .collect();

    if (scribes.length < 1) {
      effects.message = "Cannot build library: Need at least 1 scribe (literacy 50+) to organize knowledge.";
    } else if (territory.wealth < 30) {
      effects.message = "Cannot build library: Need 30 wealth.";
    } else {
      // Create library as a type of school for now
      const result = await createSchool(ctx, territory._id, "library" as any, currentTick);
      effects.libraryResult = result;
      if (result.success || result.message?.includes("already")) {
        await ctx.db.patch(territory._id, {
          wealth: territory.wealth - 30,
          knowledge: territory.knowledge + 10,
        });
        effects.message = `Library built! Literate people can now self-study up to skill level 60. Knowledge preserved for future generations!`;
      }
    }
  }

  if (action === "establish_university") {
    // Check for existing schools
    const schools = await ctx.db
      .query("schools")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", territory._id))
      .collect();

    if (schools.length < 1) {
      effects.message = "Cannot establish university: Need at least one school first.";
    } else if (territory.wealth < 50) {
      effects.message = "Cannot establish university: Need 50 wealth.";
    } else if (territory.knowledge < 40) {
      effects.message = "Cannot establish university: Need at least 40 knowledge.";
    } else {
      const result = await createSchool(ctx, territory._id, "university", currentTick);
      effects.universityResult = result;
      if (result.success) {
        await ctx.db.patch(territory._id, {
          wealth: territory.wealth - 50,
          knowledge: territory.knowledge + 15,
        });
        effects.message = `University established! Advanced education now available. Technology breakthrough chance +25%!`;
      }
    }
  }

  if (action === "assign_apprentice") {
    // Find a master craftsman and a young person to apprentice
    const { assignApprentice } = await import("../simulation/knowledgeTransfer");

    const masters = await ctx.db
      .query("characters")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", territory._id))
      .filter((q: any) => q.and(
        q.eq(q.field("isAlive"), true),
        q.gte(q.field("age"), 25)
      ))
      .collect();

    // Find masters with good skills
    const qualifiedMasters = masters.filter(m => {
      const skills = m.skills;
      if (!skills) return false;
      return Object.values(skills as Record<string, number>).some(level => level >= 50);
    });

    const youngPeople = await ctx.db
      .query("characters")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", territory._id))
      .filter((q: any) => q.and(
        q.eq(q.field("isAlive"), true),
        q.gte(q.field("age"), 12),
        q.lte(q.field("age"), 25)
      ))
      .collect();

    // Find young people without apprenticeships
    const available = youngPeople.filter(y => !y.apprenticeMasterId);

    if (qualifiedMasters.length === 0) {
      effects.message = "Cannot assign apprentice: No master craftsmen available (need skill 50+).";
    } else if (available.length === 0) {
      effects.message = "Cannot assign apprentice: No young people available for apprenticeship.";
    } else if (territory.wealth < 5) {
      effects.message = "Cannot assign apprentice: Need 5 wealth.";
    } else {
      const master = qualifiedMasters[0];
      const apprentice = available[0];
      const result = await assignApprentice(ctx, apprentice._id, master._id);
      effects.apprenticeResult = result;
      if (result.success) {
        await ctx.db.patch(territory._id, {
          wealth: territory.wealth - 5,
        });
      }
    }
  }

  if (action === "hire_teacher") {
    const literate = await ctx.db
      .query("characters")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", territory._id))
      .filter((q: any) => q.and(
        q.eq(q.field("isAlive"), true),
        q.gte(q.field("skills.literacy"), 50)
      ))
      .collect();

    const availableTeachers = literate.filter(c => c.profession !== "teacher");

    if (availableTeachers.length === 0) {
      effects.message = "Cannot hire teacher: No literate people available (need literacy 50+).";
    } else if (territory.wealth < 10) {
      effects.message = "Cannot hire teacher: Need 10 wealth.";
    } else {
      const newTeacher = availableTeachers[0];
      await ctx.db.patch(newTeacher._id, {
        profession: "teacher",
      });
      await ctx.db.patch(territory._id, {
        wealth: territory.wealth - 10,
        knowledge: territory.knowledge + 2,
      });
      effects.message = `${newTeacher.name} is now a teacher! Can teach 10-20 students.`;
    }
  }

  if (action === "sponsor_scholar") {
    const literate = await ctx.db
      .query("characters")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", territory._id))
      .filter((q: any) => q.and(
        q.eq(q.field("isAlive"), true),
        q.gte(q.field("skills.literacy"), 60)
      ))
      .collect();

    const availableScholars = literate.filter(c => c.profession !== "scholar");

    if (availableScholars.length === 0) {
      effects.message = "Cannot sponsor scholar: No highly literate people available (need literacy 60+).";
    } else if (territory.wealth < 15) {
      effects.message = "Cannot sponsor scholar: Need 15 wealth to support full-time study.";
    } else {
      const newScholar = availableScholars[0];
      await ctx.db.patch(newScholar._id, {
        profession: "scholar",
      });
      await ctx.db.patch(territory._id, {
        wealth: territory.wealth - 15,
        knowledge: territory.knowledge + 5,
      });
      effects.message = `${newScholar.name} is now a sponsored scholar! They will dedicate themselves to learning and may discover new technologies.`;
    }
  }

  if (action === "copy_scrolls") {
    const scribes = await ctx.db
      .query("characters")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", territory._id))
      .filter((q: any) => q.and(
        q.eq(q.field("isAlive"), true),
        q.eq(q.field("profession"), "scribe")
      ))
      .collect();

    if (scribes.length === 0) {
      effects.message = "Cannot copy scrolls: No scribes available.";
    } else if (territory.wealth < 5) {
      effects.message = "Cannot copy scrolls: Need 5 wealth for materials.";
    } else {
      await ctx.db.patch(territory._id, {
        wealth: territory.wealth - 5,
        knowledge: territory.knowledge + 3,
      });
      effects.message = `Scribes have copied important texts. Knowledge is now better preserved for future generations!`;
    }
  }

  if (action === "establish_trade_school") {
    if (territory.wealth < 25) {
      effects.message = "Cannot establish trade school: Need 25 wealth.";
    } else {
      const result = await createSchool(ctx, territory._id, "trade_school", currentTick);
      effects.tradeSchoolResult = result;
      if (result.success) {
        await ctx.db.patch(territory._id, {
          wealth: territory.wealth - 25,
          knowledge: territory.knowledge + 2,
        });
        effects.message = `Trade school established! Workers learn smithing, carpentry, masonry, and tailoring 2x faster.`;
      }
    }
  }

  // =============================================
  // EDUCATION SABOTAGE & COVERT DISRUPTION ACTIONS
  // =============================================

  const educationSabotageActions = [
    "burn_enemy_library",
    "sabotage_enemy_school",
    "assassinate_enemy_scholar",
    "steal_enemy_scrolls",
    "spread_misinformation",
    "poison_enemy_teachers",
    "bribe_scholar_to_defect",
    "destroy_enemy_university",
    "kidnap_enemy_apprentices",
    "incite_student_riot",
    "corrupt_enemy_curriculum",
    "infiltrate_enemy_academy",
  ];

  if (educationSabotageActions.includes(action)) {
    const { executeEducationSabotage, EducationSabotageType } = await import("../simulation/educationSabotage");

    // Map action to sabotage type
    const sabotageTypeMap: Record<string, any> = {
      "burn_enemy_library": "burn_library",
      "sabotage_enemy_school": "sabotage_school",
      "assassinate_enemy_scholar": "assassinate_scholar",
      "steal_enemy_scrolls": "steal_scrolls",
      "spread_misinformation": "spread_misinformation",
      "poison_enemy_teachers": "poison_teachers",
      "bribe_scholar_to_defect": "bribe_scholar_defect",
      "destroy_enemy_university": "destroy_university",
      "kidnap_enemy_apprentices": "kidnap_apprentices",
      "incite_student_riot": "incite_student_riot",
      "corrupt_enemy_curriculum": "corrupt_curriculum",
      "infiltrate_enemy_academy": "infiltrate_academy",
    };

    const sabotageType = sabotageTypeMap[action];

    if (!targetTerritoryId) {
      effects.message = `${action} requires a target territory.`;
    } else {
      // Check if we have a spy in the target territory
      const spies = await ctx.db
        .query("spies")
        .withIndex("by_owner", (q: any) => q.eq("ownerTerritoryId", territory._id))
        .filter((q: any) => q.and(
          q.eq(q.field("targetTerritoryId"), targetTerritoryId),
          q.eq(q.field("status"), "active")
        ))
        .collect();

      const spy = spies.length > 0 ? spies[0] : undefined;

      // Some operations require a spy
      const requiresSpy = ["burn_enemy_library", "destroy_enemy_university", "infiltrate_enemy_academy"];
      if (requiresSpy.includes(action) && !spy) {
        effects.message = `${action} requires an active spy in the target territory. Deploy a spy first!`;
      } else {
        const result = await executeEducationSabotage(
          ctx,
          territory._id,
          targetTerritoryId,
          sabotageType,
          spy?._id,
          currentTick
        );

        effects.sabotageResult = result;
        effects.message = result.message;

        if (result.warDeclared) {
          effects.warDeclared = true;
          relationshipChanges.status = "at_war";
        }

        // Create event for this action
        await ctx.db.insert("events", {
          tick: currentTick,
          type: result.success ? "decision" : "crisis",
          territoryId: territory._id,
          targetTerritoryId,
          title: result.success
            ? `Covert Operation: ${action.replace(/_/g, " ")}`
            : `Failed Operation: ${action.replace(/_/g, " ")}`,
          description: result.message,
          severity: result.detected ? "negative" : "info",
          createdAt: Date.now(),
        });
      }
    }
  }

  // =============================================
  // MILITARY EDUCATION TARGETING (During War)
  // =============================================

  const warfareEducationActions = [
    "raze_enemy_library",
    "capture_enemy_scholars",
    "loot_scrolls_and_texts",
    "execute_enemy_teachers",
    "burn_enemy_schools",
    "demand_scholars_as_tribute",
  ];

  if (warfareEducationActions.includes(action)) {
    if (!targetTerritoryId) {
      effects.message = `${action} requires a target territory.`;
    } else {
      // Check if we're at war with target (except for tribute demand)
      const relationship = await ctx.db
        .query("relationships")
        .filter((q: any) => q.or(
          q.and(
            q.eq(q.field("territory1Id"), territory._id),
            q.eq(q.field("territory2Id"), targetTerritoryId)
          ),
          q.and(
            q.eq(q.field("territory1Id"), targetTerritoryId),
            q.eq(q.field("territory2Id"), territory._id)
          )
        ))
        .first();

      const atWar = relationship?.status === "at_war";
      const requiresWar = ["raze_enemy_library", "capture_enemy_scholars", "loot_scrolls_and_texts", "execute_enemy_teachers", "burn_enemy_schools"];

      if (requiresWar.includes(action) && !atWar) {
        effects.message = `${action} can only be used during war. You are not at war with this territory.`;
      } else {
        const targetTerritory = await ctx.db.get(targetTerritoryId);
        if (!targetTerritory) {
          effects.message = "Target territory not found.";
        } else {
          // Execute the warfare education action
          switch (action) {
            case "raze_enemy_library": {
              // Find and destroy library
              const libraries = await ctx.db
                .query("schools")
                .withIndex("by_territory", (q: any) => q.eq("territoryId", targetTerritoryId))
                .filter((q: any) => q.eq(q.field("schoolType"), "library"))
                .collect();

              if (libraries.length === 0) {
                effects.message = "Target has no library to raze.";
              } else {
                for (const lib of libraries) {
                  await ctx.db.delete(lib._id);
                }
                await ctx.db.patch(targetTerritoryId, {
                  knowledge: Math.max(0, targetTerritory.knowledge - 30),
                  happiness: Math.max(0, targetTerritory.happiness - 15),
                });
                effects.message = `Razed ${targetTerritory.name}'s library! -30 knowledge, -15 happiness. Their accumulated wisdom burns.`;
                relationshipChanges.trust = -50;
              }
              break;
            }

            case "capture_enemy_scholars": {
              const scholars = await ctx.db
                .query("characters")
                .withIndex("by_territory", (q: any) => q.eq("territoryId", targetTerritoryId))
                .filter((q: any) => q.and(
                  q.eq(q.field("isAlive"), true),
                  q.or(
                    q.eq(q.field("profession"), "scholar"),
                    q.eq(q.field("profession"), "teacher")
                  )
                ))
                .collect();

              const captureCount = Math.min(3, scholars.length);
              if (captureCount === 0) {
                effects.message = "Target has no scholars to capture.";
              } else {
                const captured = scholars.slice(0, captureCount);
                for (const scholar of captured) {
                  await ctx.db.patch(scholar._id, {
                    territoryId: territory._id,
                  });
                }
                await ctx.db.patch(territory._id, {
                  knowledge: Math.min(100, territory.knowledge + 10),
                });
                effects.message = `Captured ${captureCount} scholars from ${targetTerritory.name}! They now work for you. +10 knowledge.`;
              }
              break;
            }

            case "loot_scrolls_and_texts": {
              await ctx.db.patch(targetTerritoryId, {
                knowledge: Math.max(0, targetTerritory.knowledge - 15),
              });
              await ctx.db.patch(territory._id, {
                knowledge: Math.min(100, territory.knowledge + 10),
              });
              effects.message = `Looted scrolls and texts from ${targetTerritory.name}! -15 knowledge for them, +10 for you.`;
              break;
            }

            case "execute_enemy_teachers": {
              const educators = await ctx.db
                .query("characters")
                .withIndex("by_territory", (q: any) => q.eq("territoryId", targetTerritoryId))
                .filter((q: any) => q.and(
                  q.eq(q.field("isAlive"), true),
                  q.or(
                    q.eq(q.field("profession"), "scholar"),
                    q.eq(q.field("profession"), "teacher"),
                    q.eq(q.field("profession"), "scribe")
                  )
                ))
                .collect();

              for (const educator of educators) {
                await ctx.db.patch(educator._id, {
                  isAlive: false,
                  causeOfDeath: "executed",
                  deathTick: currentTick,
                });
              }

              await ctx.db.patch(targetTerritoryId, {
                knowledge: Math.max(0, targetTerritory.knowledge - 40),
                happiness: Math.max(0, targetTerritory.happiness - 30),
              });

              // Atrocity penalty for perpetrator
              await ctx.db.patch(territory._id, {
                influence: Math.max(0, territory.influence - 20),
              });

              effects.message = `ATROCITY: Executed ${educators.length} educators from ${targetTerritory.name}. -40 knowledge, -30 happiness for them. YOU lose -20 influence. This will be remembered for generations.`;
              relationshipChanges.trust = -100;

              // Record memory of atrocity
              const targetAgent = await ctx.db
                .query("agents")
                .withIndex("by_territory", (q: any) => q.eq("territoryId", targetTerritoryId))
                .first();
              if (targetAgent) {
                await recordMemory(ctx, targetAgent._id, {
                  type: "betrayal",
                  description: `${territory.name} committed a horrific atrocity - executing our scholars and teachers. This blood feud will last generations.`,
                  emotionalWeight: -100,
                  targetTerritoryId: territory._id,
                });
              }
              break;
            }

            case "burn_enemy_schools": {
              const schools = await ctx.db
                .query("schools")
                .withIndex("by_territory", (q: any) => q.eq("territoryId", targetTerritoryId))
                .collect();

              for (const school of schools) {
                await ctx.db.delete(school._id);
              }

              await ctx.db.patch(targetTerritoryId, {
                knowledge: Math.max(0, targetTerritory.knowledge - 20),
                happiness: Math.max(0, targetTerritory.happiness - 20),
              });

              effects.message = `Burned ${schools.length} schools in ${targetTerritory.name}! Their children have nowhere to learn. -20 knowledge, -20 happiness.`;
              relationshipChanges.trust = -40;
              break;
            }

            case "demand_scholars_as_tribute": {
              // This doesn't require war, but requires diplomatic leverage
              const ourMilitary = territory.military;
              const theirMilitary = targetTerritory.military;
              const powerRatio = ourMilitary / Math.max(1, theirMilitary);

              if (powerRatio < 1.5) {
                effects.message = `${targetTerritory.name} refuses your demand. You're not powerful enough to make such demands.`;
              } else if (Math.random() < 0.3 + (powerRatio - 1.5) * 0.2) {
                // They comply
                const scholars = await ctx.db
                  .query("characters")
                  .withIndex("by_territory", (q: any) => q.eq("territoryId", targetTerritoryId))
                  .filter((q: any) => q.and(
                    q.eq(q.field("isAlive"), true),
                    q.eq(q.field("profession"), "scholar")
                  ))
                  .collect();

                const tributeCount = Math.min(3, Math.max(1, Math.floor(scholars.length * 0.3)));
                const tribute = scholars.slice(0, tributeCount);

                for (const scholar of tribute) {
                  await ctx.db.patch(scholar._id, {
                    territoryId: territory._id,
                  });
                }

                await ctx.db.patch(territory._id, {
                  knowledge: Math.min(100, territory.knowledge + 8),
                });

                effects.message = `${targetTerritory.name} submits to your demand and sends ${tributeCount} scholars as tribute. +8 knowledge.`;
                relationshipChanges.trust = -30;
              } else {
                effects.message = `${targetTerritory.name} proudly refuses your demand. They will not surrender their scholars.`;
                relationshipChanges.trust = -20;
              }
              break;
            }
          }
        }
      }
    }
  }

  // =============================================
  // COMPREHENSIVE SABOTAGE SYSTEM
  // All forms of covert disruption
  // =============================================

  const sabotageActionMap: Record<string, string> = {
    // Economic
    "poison_enemy_crops": "poison_crops",
    "contaminate_enemy_water": "contaminate_water",
    "counterfeit_currency": "counterfeit_currency",
    "burn_enemy_granaries": "burn_granaries",
    "sabotage_enemy_mines": "sabotage_mines",
    "burn_enemy_market": "burn_market",
    "introduce_pests": "introduce_pests",
    "bribe_enemy_merchants": "bribe_merchants",
    "steal_trade_secrets": "steal_trade_secrets",
    "disrupt_enemy_caravans": "disrupt_caravans",
    // Military
    "poison_army_supplies": "poison_army_supplies",
    "sabotage_enemy_weapons": "sabotage_weapons",
    "steal_battle_plans": "steal_battle_plans",
    "assassinate_enemy_general": "assassinate_general",
    "incite_desertion": "incite_desertion",
    "spread_camp_disease": "spread_camp_disease",
    "sabotage_enemy_fortifications": "sabotage_fortifications",
    "burn_enemy_armory": "burn_armory",
    "disable_siege_equipment": "disable_siege_equipment",
    "bribe_soldiers_to_defect": "bribe_soldiers_defect",
    // Political
    "assassinate_enemy_heir": "assassinate_heir",
    "spread_enemy_propaganda": "spread_propaganda",
    "incite_enemy_rebellion": "incite_rebellion",
    "bribe_enemy_advisors": "bribe_advisors",
    "forge_enemy_documents": "forge_documents",
    "frame_noble_for_treason": "frame_noble_treason",
    "support_rival_faction": "support_rival_faction",
    "spread_ruler_rumors": "spread_ruler_rumors",
    "create_enemy_succession_crisis": "create_succession_crisis",
    "blackmail_enemy_officials": "blackmail_officials",
    // Religious
    "desecrate_enemy_temple": "desecrate_temple",
    "assassinate_enemy_priests": "assassinate_priests",
    "spread_heresy": "spread_heresy",
    "steal_holy_relics": "steal_holy_relics",
    "corrupt_religious_texts": "corrupt_religious_texts",
    "support_rival_cult": "support_rival_cult",
    "poison_holy_water": "poison_holy_water",
    "fake_divine_omens": "fake_divine_omens",
    // Infrastructure
    "destroy_enemy_bridges": "destroy_bridges",
    "block_mountain_passes": "block_mountain_passes",
    "burn_enemy_harbor": "burn_harbor",
    "collapse_enemy_mines": "collapse_mines",
    "destroy_enemy_aqueducts": "destroy_aqueducts",
    "set_enemy_city_fires": "set_city_fires",
    "dam_enemy_rivers": "dam_rivers",
    "destroy_enemy_roads": "destroy_roads",
    // Demographic
    "spread_enemy_plague": "spread_plague",
    "poison_enemy_food_supply": "poison_food_supply",
    "kidnap_enemy_craftsmen": "kidnap_craftsmen",
    "encourage_enemy_emigration": "encourage_emigration",
    "assassinate_enemy_healers": "assassinate_healers",
    // Psychological
    "spread_terror": "spread_terror",
    "display_enemy_heads": "display_enemy_heads",
    "create_bad_omens": "create_bad_omens",
    "conduct_night_raids": "night_raids",
    "demoralize_with_losses": "demoralize_with_losses",
    // Social
    "incite_class_warfare": "incite_class_warfare",
    "spread_ethnic_hatred": "spread_ethnic_hatred",
    "corrupt_enemy_youth": "corrupt_youth",
    "undermine_political_marriages": "undermine_marriages",
    "spread_addiction": "spread_addiction",
    "destroy_cultural_artifacts": "destroy_cultural_artifacts",
  };

  if (sabotageActionMap[action]) {
    const { executeSabotage } = await import("../simulation/sabotage");

    if (!targetTerritoryId) {
      effects.message = `${action} requires a target territory.`;
    } else {
      const sabotageType = sabotageActionMap[action] as any;
      const result = await executeSabotage(
        ctx,
        territory._id,
        targetTerritoryId,
        sabotageType,
        currentTick
      );

      effects.sabotageResult = result;
      effects.message = result.message;

      if (result.warDeclared) {
        effects.warDeclared = true;
        relationshipChanges.status = "at_war";
      }

      if (result.attackerGains) {
        effects.attackerGains = result.attackerGains;
      }

      // Create event for sabotage
      const targetTerritory = await ctx.db.get(targetTerritoryId);
      await ctx.db.insert("events", {
        tick: currentTick,
        type: result.success ? "decision" : "crisis",
        territoryId: territory._id,
        targetTerritoryId,
        title: result.success
          ? `Sabotage: ${action.replace(/_/g, " ").replace("enemy ", "")}`
          : `Failed Sabotage: ${action.replace(/_/g, " ").replace("enemy ", "")}`,
        description: result.message,
        severity: result.detected ? (result.warDeclared ? "critical" : "negative") : "info",
        createdAt: Date.now(),
      });

      // If detected, also create event for target
      if (result.detected && targetTerritory) {
        await ctx.db.insert("events", {
          tick: currentTick,
          type: "crisis",
          territoryId: targetTerritoryId,
          targetTerritoryId: territory._id,
          title: `Sabotage Detected!`,
          description: `${territory.name} attempted ${action.replace(/_/g, " ").replace("enemy ", "")} against us!`,
          severity: result.warDeclared ? "critical" : "negative",
          createdAt: Date.now(),
        });
      }
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

  // =============================================
  // ENDGAME - NUCLEAR ACTIONS
  // =============================================

  if (action === "start_nuclear_program") {
    // Check if they have the technology
    const hasFissionTech = await ctx.db
      .query("technologies")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", territory._id))
      .filter((q: any) => q.and(
        q.eq(q.field("techId"), "nuclear_fission"),
        q.eq(q.field("researched"), true)
      ))
      .first();

    if (!hasFissionTech) {
      effects.nuclearResult = { success: false, error: "Requires nuclear_fission technology" };
    } else {
      // Check or create arsenal
      let arsenal = await ctx.db
        .query("nuclearArsenals")
        .withIndex("by_territory", (q: any) => q.eq("territoryId", territory._id))
        .first();

      if (!arsenal) {
        await ctx.db.insert("nuclearArsenals", {
          territoryId: territory._id,
          warheads: 0,
          deliverySystems: 0,
          productionRate: 1,
          isProducing: true,
          nukesUsed: 0,
          targetedBy: [],
        });
        effects.nuclearResult = { success: true, message: "Nuclear weapons program initiated" };
      } else {
        await ctx.db.patch(arsenal._id, { isProducing: true });
        effects.nuclearResult = { success: true, message: "Nuclear production resumed" };
      }
    }
  }

  if (action === "stop_nuclear_production") {
    const arsenal = await ctx.db
      .query("nuclearArsenals")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", territory._id))
      .first();

    if (arsenal && arsenal.isProducing) {
      await ctx.db.patch(arsenal._id, { isProducing: false });
      effects.nuclearResult = { success: true, message: "Nuclear production halted" };
    } else {
      effects.nuclearResult = { success: false, error: "No active nuclear program" };
    }
  }

  // =============================================
  // RISE AND FALL - REFORM ACTIONS
  // =============================================

  if (action === "implement_reform") {
    const riseAndFall = await ctx.db
      .query("riseAndFall")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", territory._id))
      .first();

    if (!riseAndFall) {
      effects.reformResult = { success: false, error: "No rise/fall data found" };
    } else if (territory.wealth < 50) {
      effects.reformResult = { success: false, error: "Need 50 wealth to implement reforms" };
    } else {
      // Pay cost
      await ctx.db.patch(territory._id, {
        wealth: territory.wealth - 50,
        happiness: Math.max(0, territory.happiness - 20),
      });

      // Apply reform effects
      const newDecadence = Math.max(0, riseAndFall.decadenceLevel - 30);
      const newCorruption = Math.max(0, riseAndFall.corruptionLevel - 15);

      const reforms = riseAndFall.reforms || [];
      reforms.push("structural_reform");

      let newStatus = riseAndFall.status;
      let activeCrisis = riseAndFall.activeCrisis;

      // Clear crisis if decadence drops enough
      if (newDecadence < 50 && newCorruption < 40) {
        newStatus = "reforming";
        activeCrisis = undefined;
      }

      await ctx.db.patch(riseAndFall._id, {
        decadenceLevel: newDecadence,
        corruptionLevel: newCorruption,
        status: newStatus,
        activeCrisis,
        reforms,
      });

      effects.reformResult = { success: true, message: `Reforms implemented! Decadence -30, Corruption -15` };
    }
  }

  if (action === "purge_corruption") {
    const riseAndFall = await ctx.db
      .query("riseAndFall")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", territory._id))
      .first();

    if (riseAndFall && riseAndFall.corruptionLevel > 0) {
      const newCorruption = Math.max(0, riseAndFall.corruptionLevel - 25);
      await ctx.db.patch(riseAndFall._id, { corruptionLevel: newCorruption });

      // Purges cause unrest
      await ctx.db.patch(territory._id, {
        happiness: Math.max(0, territory.happiness - 10),
        unrest: (territory.unrest || 0) + 15,
      });

      effects.purgeResult = { success: true, message: `Corruption purged! Corruption -25, but unrest +15` };
    } else {
      effects.purgeResult = { success: false, error: "No significant corruption to purge" };
    }
  }

  if (action === "austerity_measures") {
    const riseAndFall = await ctx.db
      .query("riseAndFall")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", territory._id))
      .first();

    if (riseAndFall && riseAndFall.activeCrisis === "economic_depression") {
      // Helps stabilize during economic crisis
      await ctx.db.patch(territory._id, {
        happiness: Math.max(0, territory.happiness - 10),
      });

      // Slow decadence growth
      const newDecadence = Math.max(0, riseAndFall.decadenceLevel - 10);
      await ctx.db.patch(riseAndFall._id, { decadenceLevel: newDecadence });

      effects.austerityResult = { success: true, message: "Austerity measures help stabilize the economy" };
    } else {
      effects.austerityResult = { success: false, error: "Austerity only effective during economic crisis" };
    }
  }

  if (action === "bread_and_circuses") {
    // Spend wealth to boost happiness temporarily
    if (territory.wealth < 30) {
      effects.breadCircusResult = { success: false, error: "Need 30 wealth for bread and circuses" };
    } else {
      await ctx.db.patch(territory._id, {
        wealth: territory.wealth - 30,
        happiness: Math.min(100, territory.happiness + 20),
      });

      // Slightly increases decadence (distraction from real problems)
      const riseAndFall = await ctx.db
        .query("riseAndFall")
        .withIndex("by_territory", (q: any) => q.eq("territoryId", territory._id))
        .first();

      if (riseAndFall) {
        await ctx.db.patch(riseAndFall._id, {
          decadenceLevel: riseAndFall.decadenceLevel + 5,
        });
      }

      effects.breadCircusResult = { success: true, message: "The people are entertained! Happiness +20, but decadence +5" };
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

          // Check for automatic retaliation (may escalate to war)
          const { processRetaliation } = await import("../simulation/warEmergence");
          const retaliationResult = await processRetaliation(
            ctx,
            territory._id,
            targetTerritory._id,
            world?.tick || 0
          );
          if (retaliationResult.declaredWar) {
            effects.retaliationWarDeclared = true;
            // Override status to at_war if retaliation triggered
            relationshipChanges.status = "at_war";
          }
          break;

        case "nuclear_strike":
          // NUCLEAR ATTACK - devastating consequences
          {
            const attackerArsenal = await ctx.db
              .query("nuclearArsenals")
              .withIndex("by_territory", (q: any) => q.eq("territoryId", territory._id))
              .first();

            if (!attackerArsenal || attackerArsenal.warheads < 1) {
              effects.nuclearStrike = { success: false, error: "No nuclear weapons available" };
            } else {
              // Use all available warheads or up to 10
              const warheadsUsed = Math.min(attackerArsenal.warheads, 10);

              // Calculate damage (each warhead kills 5-15% of population)
              const damagePerWarhead = 0.05 + Math.random() * 0.1;
              const totalDamage = Math.min(0.9, warheadsUsed * damagePerWarhead);
              const casualties = Math.floor(targetTerritory.population * totalDamage);

              // Apply damage to target
              await ctx.db.patch(targetTerritory._id, {
                population: Math.max(5, targetTerritory.population - casualties),
                happiness: Math.max(0, targetTerritory.happiness - 50),
                wealth: Math.max(0, targetTerritory.wealth - 40),
                food: Math.max(0, targetTerritory.food - 30),
              });

              // Deduct warheads
              await ctx.db.patch(attackerArsenal._id, {
                warheads: attackerArsenal.warheads - warheadsUsed,
                nukesUsed: attackerArsenal.nukesUsed + warheadsUsed,
              });

              // Relationship destroyed
              relationshipChanges.trust = -100;
              relationshipChanges.status = "at_war";
              relationshipChanges.hasAlliance = false;
              relationshipChanges.hasTradeAgreement = false;

              effects.nuclearStrike = {
                success: true,
                warheadsUsed,
                casualties,
                message: `NUCLEAR STRIKE! ${warheadsUsed} warheads deployed, ${casualties.toLocaleString()} killed!`
              };

              // Check for MAD retaliation
              const targetArsenal = await ctx.db
                .query("nuclearArsenals")
                .withIndex("by_territory", (q: any) => q.eq("territoryId", targetTerritory._id))
                .first();

              if (targetArsenal && targetArsenal.warheads >= 5) {
                // Automatic retaliation!
                const survivingWarheads = Math.floor(targetArsenal.warheads * 0.3);
                if (survivingWarheads > 0) {
                  const retaliationDamage = Math.min(0.9, survivingWarheads * damagePerWarhead);
                  const retaliationCasualties = Math.floor(territory.population * retaliationDamage);

                  await ctx.db.patch(territory._id, {
                    population: Math.max(5, territory.population - retaliationCasualties),
                    happiness: Math.max(0, territory.happiness - 50),
                    wealth: Math.max(0, territory.wealth - 40),
                  });

                  await ctx.db.patch(targetArsenal._id, {
                    warheads: 0,
                    nukesUsed: targetArsenal.nukesUsed + survivingWarheads,
                  });

                  effects.nuclearStrike.retaliation = {
                    warheadsUsed: survivingWarheads,
                    casualties: retaliationCasualties,
                    message: `RETALIATION! ${survivingWarheads} warheads struck back, ${retaliationCasualties.toLocaleString()} killed!`
                  };
                }
              }

              // Record memories - nuclear war is never forgotten
              await recordActionMemory(
                ctx,
                targetTerritory._id,
                "nuclear_strike",
                territory._id,
                `${territory.name} launched NUCLEAR WEAPONS against us! ${casualties.toLocaleString()} of our people were incinerated!`,
                -100 // Maximum trauma
              );
            }
          }
          break;

        case "propose_disarmament":
          // Offer mutual nuclear disarmament
          {
            const arsenalA = await ctx.db
              .query("nuclearArsenals")
              .withIndex("by_territory", (q: any) => q.eq("territoryId", territory._id))
              .first();

            const arsenalB = await ctx.db
              .query("nuclearArsenals")
              .withIndex("by_territory", (q: any) => q.eq("territoryId", targetTerritory._id))
              .first();

            if (!arsenalA || !arsenalB || arsenalA.warheads < 1 || arsenalB.warheads < 1) {
              effects.disarmament = { success: false, error: "Both parties must have nuclear weapons" };
            } else {
              // For now, automatic acceptance if relations are not hostile
              if (relationship.status !== "hostile" && relationship.status !== "at_war") {
                // Both sides reduce by 50%
                const reductionA = Math.floor(arsenalA.warheads * 0.5);
                const reductionB = Math.floor(arsenalB.warheads * 0.5);

                await ctx.db.patch(arsenalA._id, { warheads: arsenalA.warheads - reductionA });
                await ctx.db.patch(arsenalB._id, { warheads: arsenalB.warheads - reductionB });

                // Improve relations
                relationshipChanges.trust = relationship.trust + 30;

                effects.disarmament = {
                  success: true,
                  reductionA,
                  reductionB,
                  message: `Disarmament treaty signed! Both sides reduce arsenals by 50%.`
                };
              } else {
                effects.disarmament = { success: false, error: "Relations too hostile for disarmament talks" };
              }
            }
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
        // SABOTAGE - EDUCATION & KNOWLEDGE WARFARE
        // =============================================

        case "capture_enemy_scholars":
        case "kidnap_enemy_apprentices": {
          const scholars = await ctx.db
            .query("characters")
            .withIndex("by_territory", (q: any) => q.eq("territoryId", targetTerritory._id))
            .filter((q: any) => q.and(
              q.eq(q.field("isAlive"), true),
              q.or(q.eq(q.field("role"), "scholar"), q.eq(q.field("role"), "teacher"))
            ))
            .collect();

          if (scholars.length > 0) {
            const captured = scholars[Math.floor(Math.random() * scholars.length)];
            await ctx.db.patch(captured._id, { territoryId: territory._id });
            effects.captureResult = { success: true, captured: captured.name };
            relationshipChanges.trust = Math.max(-100, relationship.trust - 25);
            await ctx.db.patch(territory._id, { knowledge: territory.knowledge + 5 });
          } else {
            effects.captureResult = { success: false, error: "No scholars found" };
          }
          break;
        }

        case "loot_scrolls_and_texts":
        case "steal_enemy_scrolls": {
          const theirKnowledge = targetTerritory.knowledge || 0;
          if (theirKnowledge > 5) {
            const stolen = Math.min(10, Math.floor(theirKnowledge * 0.2));
            await ctx.db.patch(targetTerritory._id, { knowledge: theirKnowledge - stolen });
            await ctx.db.patch(territory._id, { knowledge: territory.knowledge + stolen });
            effects.lootResult = { success: true, knowledgeStolen: stolen };
            relationshipChanges.trust = Math.max(-100, relationship.trust - 20);
          } else {
            effects.lootResult = { success: false, error: "Nothing worth stealing" };
          }
          break;
        }

        case "execute_enemy_teachers":
        case "assassinate_enemy_scholar":
        case "poison_enemy_teachers": {
          const teachers = await ctx.db
            .query("characters")
            .withIndex("by_territory", (q: any) => q.eq("territoryId", targetTerritory._id))
            .filter((q: any) => q.and(
              q.eq(q.field("isAlive"), true),
              q.or(q.eq(q.field("role"), "scholar"), q.eq(q.field("role"), "teacher"))
            ))
            .collect();

          if (teachers.length > 0) {
            const victim = teachers[Math.floor(Math.random() * teachers.length)];
            await ctx.db.patch(victim._id, { isAlive: false, deathCause: "assassination" });
            effects.assassinationResult = { success: true, victim: victim.name };
            relationshipChanges.trust = Math.max(-100, relationship.trust - 40);
            relationshipChanges.status = "hostile";
          } else {
            effects.assassinationResult = { success: false, error: "No teachers found" };
          }
          break;
        }

        case "burn_enemy_schools":
        case "burn_enemy_library":
        case "sabotage_enemy_school":
        case "destroy_enemy_university": {
          const schools = await ctx.db
            .query("schools")
            .withIndex("by_territory", (q: any) => q.eq("territoryId", targetTerritory._id))
            .collect();

          if (schools.length > 0) {
            const target = schools[Math.floor(Math.random() * schools.length)];
            await ctx.db.delete(target._id);
            effects.destructionResult = { success: true, destroyed: target.name };
            relationshipChanges.trust = Math.max(-100, relationship.trust - 35);
            relationshipChanges.status = "hostile";
          } else {
            effects.destructionResult = { success: false, error: "No schools found" };
          }
          break;
        }

        case "demand_scholars_as_tribute": {
          if (relationship.trust < -20 || relationship.status === "at_war") {
            const scholars = await ctx.db
              .query("characters")
              .withIndex("by_territory", (q: any) => q.eq("territoryId", targetTerritory._id))
              .filter((q: any) => q.eq(q.field("role"), "scholar"))
              .collect();

            if (scholars.length > 0 && targetTerritory.military < territory.military) {
              const tribute = scholars[0];
              await ctx.db.patch(tribute._id, { territoryId: territory._id });
              effects.tributeResult = { success: true, received: tribute.name };
            }
          }
          break;
        }

        case "spread_misinformation":
        case "corrupt_enemy_curriculum": {
          await ctx.db.patch(targetTerritory._id, {
            knowledge: Math.max(0, targetTerritory.knowledge - 3),
            happiness: Math.max(0, targetTerritory.happiness - 2),
          });
          effects.misinfoResult = { success: true };
          relationshipChanges.trust = Math.max(-100, relationship.trust - 15);
          break;
        }

        case "bribe_scholar_to_defect": {
          const scholars = await ctx.db
            .query("characters")
            .withIndex("by_territory", (q: any) => q.eq("territoryId", targetTerritory._id))
            .filter((q: any) => q.and(
              q.eq(q.field("isAlive"), true),
              q.eq(q.field("role"), "scholar")
            ))
            .collect();

          if (scholars.length > 0 && territory.wealth >= 10) {
            const defector = scholars.find((s: any) => s.traits?.greed > 50) || scholars[0];
            await ctx.db.patch(defector._id, { territoryId: territory._id });
            await ctx.db.patch(territory._id, { wealth: territory.wealth - 10 });
            effects.defectionResult = { success: true, defector: defector.name };
          }
          break;
        }

        case "incite_student_riot":
        case "infiltrate_enemy_academy": {
          await ctx.db.patch(targetTerritory._id, {
            happiness: Math.max(0, targetTerritory.happiness - 8),
          });
          effects.riotResult = { success: true };
          relationshipChanges.trust = Math.max(-100, relationship.trust - 20);
          break;
        }

        // =============================================
        // SABOTAGE - ECONOMIC WARFARE
        // =============================================

        case "poison_enemy_crops":
        case "introduce_pests": {
          await ctx.db.patch(targetTerritory._id, {
            food: Math.max(0, targetTerritory.food - 20),
          });
          effects.cropSabotageResult = { success: true, foodDestroyed: 20 };
          relationshipChanges.trust = Math.max(-100, relationship.trust - 30);
          relationshipChanges.status = "hostile";
          break;
        }

        case "contaminate_enemy_water":
        case "poison_enemy_food_supply": {
          await ctx.db.patch(targetTerritory._id, {
            food: Math.max(0, targetTerritory.food - 15),
            happiness: Math.max(0, targetTerritory.happiness - 10),
            population: Math.max(1, targetTerritory.population - Math.floor(targetTerritory.population * 0.05)),
          });
          effects.poisonResult = { success: true };
          relationshipChanges.trust = Math.max(-100, relationship.trust - 50);
          relationshipChanges.status = "at_war";
          break;
        }

        case "counterfeit_currency": {
          const theirTreasury = await ctx.db
            .query("treasury")
            .withIndex("by_territory", (q: any) => q.eq("territoryId", targetTerritory._id))
            .first();

          if (theirTreasury) {
            await ctx.db.patch(theirTreasury._id, {
              inflationRate: theirTreasury.inflationRate + 10,
              debasementLevel: Math.min(100, theirTreasury.debasementLevel + 15),
            });
            effects.counterfeitResult = { success: true };
          }
          relationshipChanges.trust = Math.max(-100, relationship.trust - 25);
          break;
        }

        case "burn_enemy_granaries": {
          await ctx.db.patch(targetTerritory._id, {
            food: Math.max(0, Math.floor(targetTerritory.food * 0.3)),
          });
          effects.arsonResult = { success: true, foodDestroyed: Math.floor(targetTerritory.food * 0.7) };
          relationshipChanges.trust = Math.max(-100, relationship.trust - 40);
          relationshipChanges.status = "hostile";
          break;
        }

        case "sabotage_enemy_mines":
        case "collapse_enemy_mines": {
          const mines = await ctx.db
            .query("buildings")
            .withIndex("by_territory", (q: any) => q.eq("territoryId", targetTerritory._id))
            .filter((q: any) => q.eq(q.field("type"), "mine"))
            .collect();

          if (mines.length > 0) {
            await ctx.db.delete(mines[0]._id);
            effects.mineSabotageResult = { success: true };
            relationshipChanges.trust = Math.max(-100, relationship.trust - 30);
          }
          break;
        }

        case "burn_enemy_market": {
          const markets = await ctx.db
            .query("buildings")
            .withIndex("by_territory", (q: any) => q.eq("territoryId", targetTerritory._id))
            .filter((q: any) => q.eq(q.field("type"), "market"))
            .collect();

          if (markets.length > 0) {
            await ctx.db.delete(markets[0]._id);
            await ctx.db.patch(targetTerritory._id, { wealth: Math.max(0, targetTerritory.wealth - 10) });
            effects.marketArsonResult = { success: true };
            relationshipChanges.trust = Math.max(-100, relationship.trust - 35);
          }
          break;
        }

        case "bribe_enemy_merchants":
        case "steal_trade_secrets": {
          await ctx.db.patch(territory._id, { wealth: territory.wealth + 5 });
          await ctx.db.patch(targetTerritory._id, { wealth: Math.max(0, targetTerritory.wealth - 5) });
          effects.bribeResult = { success: true };
          relationshipChanges.trust = Math.max(-100, relationship.trust - 15);
          break;
        }

        case "disrupt_enemy_caravans": {
          const routes = await ctx.db
            .query("tradeRoutes")
            .filter((q: any) => q.or(
              q.eq(q.field("territory1Id"), targetTerritory._id),
              q.eq(q.field("territory2Id"), targetTerritory._id)
            ))
            .collect();

          if (routes.length > 0) {
            await ctx.db.patch(routes[0]._id, { status: "disrupted" });
            effects.disruptResult = { success: true };
          }
          break;
        }

        // =============================================
        // SABOTAGE - MILITARY WARFARE
        // =============================================

        case "poison_army_supplies":
        case "sabotage_enemy_weapons":
        case "disable_siege_equipment": {
          await ctx.db.patch(targetTerritory._id, {
            military: Math.max(0, targetTerritory.military - 10),
          });
          effects.militarySabotageResult = { success: true, militaryReduced: 10 };
          relationshipChanges.trust = Math.max(-100, relationship.trust - 30);
          break;
        }

        case "steal_battle_plans": {
          effects.intelResult = {
            success: true,
            military: targetTerritory.military,
            technology: targetTerritory.technology
          };
          break;
        }

        case "assassinate_enemy_general": {
          const generals = await ctx.db
            .query("characters")
            .withIndex("by_territory", (q: any) => q.eq("territoryId", targetTerritory._id))
            .filter((q: any) => q.and(
              q.eq(q.field("isAlive"), true),
              q.eq(q.field("role"), "general")
            ))
            .collect();

          if (generals.length > 0) {
            const victim = generals[0];
            await ctx.db.patch(victim._id, { isAlive: false, deathCause: "assassination" });
            await ctx.db.patch(targetTerritory._id, { military: Math.max(0, targetTerritory.military - 15) });
            effects.generalAssassinationResult = { success: true, victim: victim.name };
            relationshipChanges.trust = Math.max(-100, relationship.trust - 50);
            relationshipChanges.status = "at_war";
          }
          break;
        }

        case "incite_desertion":
        case "bribe_soldiers_to_defect": {
          const desertionAmount = Math.floor(targetTerritory.military * 0.1);
          await ctx.db.patch(targetTerritory._id, {
            military: Math.max(0, targetTerritory.military - desertionAmount),
          });
          await ctx.db.patch(territory._id, {
            military: territory.military + Math.floor(desertionAmount * 0.5),
          });
          effects.desertionResult = { success: true, deserters: desertionAmount };
          relationshipChanges.trust = Math.max(-100, relationship.trust - 25);
          break;
        }

        case "spread_camp_disease": {
          await ctx.db.patch(targetTerritory._id, {
            military: Math.max(0, targetTerritory.military - 20),
            happiness: Math.max(0, targetTerritory.happiness - 10),
          });
          effects.diseaseResult = { success: true };
          relationshipChanges.trust = Math.max(-100, relationship.trust - 40);
          break;
        }

        case "sabotage_enemy_fortifications": {
          const fortifications = await ctx.db
            .query("infrastructure")
            .withIndex("by_territory", (q: any) => q.eq("territoryId", targetTerritory._id))
            .filter((q: any) => q.eq(q.field("type"), "wall"))
            .collect();

          if (fortifications.length > 0) {
            await ctx.db.patch(fortifications[0]._id, {
              condition: Math.max(0, fortifications[0].condition - 50),
            });
            effects.fortSabotageResult = { success: true };
          }
          break;
        }

        case "burn_enemy_armory": {
          await ctx.db.patch(targetTerritory._id, {
            military: Math.max(0, targetTerritory.military - 15),
          });
          effects.armoryArsonResult = { success: true };
          relationshipChanges.trust = Math.max(-100, relationship.trust - 35);
          break;
        }

        // =============================================
        // SABOTAGE - POLITICAL WARFARE
        // =============================================

        case "assassinate_enemy_heir": {
          const heirs = await ctx.db
            .query("characters")
            .withIndex("by_territory", (q: any) => q.eq("territoryId", targetTerritory._id))
            .filter((q: any) => q.and(
              q.eq(q.field("isAlive"), true),
              q.eq(q.field("role"), "heir")
            ))
            .collect();

          if (heirs.length > 0) {
            await ctx.db.patch(heirs[0]._id, { isAlive: false, deathCause: "assassination" });
            effects.heirAssassinationResult = { success: true, victim: heirs[0].name };
            relationshipChanges.trust = Math.max(-100, relationship.trust - 60);
            relationshipChanges.status = "at_war";
          }
          break;
        }

        case "spread_enemy_propaganda":
        case "spread_ruler_rumors": {
          await ctx.db.patch(targetTerritory._id, {
            happiness: Math.max(0, targetTerritory.happiness - 10),
          });
          effects.propagandaResult = { success: true };
          relationshipChanges.trust = Math.max(-100, relationship.trust - 20);
          break;
        }

        case "incite_enemy_rebellion":
        case "support_rival_faction": {
          await ctx.db.patch(targetTerritory._id, {
            happiness: Math.max(0, targetTerritory.happiness - 15),
          });
          // Create or strengthen rebel faction
          const existingFaction = await ctx.db
            .query("factions")
            .withIndex("by_territory", (q: any) => q.eq("territoryId", targetTerritory._id))
            .filter((q: any) => q.eq(q.field("factionType"), "rebels"))
            .first();

          if (existingFaction) {
            await ctx.db.patch(existingFaction._id, {
              rebellionRisk: Math.min(100, existingFaction.rebellionRisk + 20),
            });
          }
          effects.rebellionResult = { success: true };
          relationshipChanges.trust = Math.max(-100, relationship.trust - 35);
          break;
        }

        case "bribe_enemy_advisors": {
          effects.bribeAdvisorsResult = {
            success: true,
            intel: {
              plans: "Obtained intelligence on enemy plans",
              weakness: "Learned about internal conflicts"
            }
          };
          await ctx.db.patch(territory._id, { wealth: Math.max(0, territory.wealth - 10) });
          break;
        }

        case "forge_enemy_documents":
        case "frame_noble_for_treason": {
          await ctx.db.patch(targetTerritory._id, {
            happiness: Math.max(0, targetTerritory.happiness - 8),
          });
          effects.forgeryResult = { success: true };
          relationshipChanges.trust = Math.max(-100, relationship.trust - 15);
          break;
        }

        case "create_enemy_succession_crisis": {
          const rulers = await ctx.db
            .query("characters")
            .withIndex("by_territory", (q: any) => q.eq("territoryId", targetTerritory._id))
            .filter((q: any) => q.and(
              q.eq(q.field("isAlive"), true),
              q.or(q.eq(q.field("role"), "ruler"), q.eq(q.field("role"), "heir"))
            ))
            .collect();

          if (rulers.length >= 2) {
            // Create rivalry between ruler and heir
            await ctx.db.insert("rivalries", {
              character1Id: rulers[0]._id,
              character2Id: rulers[1]._id,
              territory1Id: targetTerritory._id,
              territory2Id: targetTerritory._id,
              intensity: 60,
              rivalryType: "succession",
              reasons: [{ reason: "foreign_manipulation", tick: currentTick, description: "Foreign agents sowed discord", intensityAdded: 60 }],
              isHereditary: false,
              status: "active",
              startTick: currentTick,
            });
            effects.successionCrisisResult = { success: true };
          }
          break;
        }

        case "blackmail_enemy_officials": {
          effects.blackmailResult = {
            success: true,
            leverage: "Obtained compromising information"
          };
          await ctx.db.patch(targetTerritory._id, {
            happiness: Math.max(0, targetTerritory.happiness - 5),
          });
          break;
        }

        // =============================================
        // SABOTAGE - RELIGIOUS WARFARE
        // =============================================

        case "desecrate_enemy_temple": {
          const temples = await ctx.db
            .query("temples")
            .withIndex("by_territory", (q: any) => q.eq("territoryId", targetTerritory._id))
            .collect();

          if (temples.length > 0) {
            await ctx.db.patch(temples[0]._id, {
              sanctity: Math.max(0, (temples[0].sanctity || 100) - 50),
            });
            await ctx.db.patch(targetTerritory._id, {
              happiness: Math.max(0, targetTerritory.happiness - 15),
            });
            effects.desecrationResult = { success: true };
            relationshipChanges.trust = Math.max(-100, relationship.trust - 50);
          }
          break;
        }

        case "assassinate_enemy_priests": {
          const priests = await ctx.db
            .query("characters")
            .withIndex("by_territory", (q: any) => q.eq("territoryId", targetTerritory._id))
            .filter((q: any) => q.and(
              q.eq(q.field("isAlive"), true),
              q.eq(q.field("role"), "priest")
            ))
            .collect();

          if (priests.length > 0) {
            await ctx.db.patch(priests[0]._id, { isAlive: false, deathCause: "assassination" });
            effects.priestAssassinationResult = { success: true, victim: priests[0].name };
            relationshipChanges.trust = Math.max(-100, relationship.trust - 45);
          }
          break;
        }

        case "spread_heresy":
        case "support_rival_cult": {
          await ctx.db.patch(targetTerritory._id, {
            happiness: Math.max(0, targetTerritory.happiness - 8),
          });
          effects.heresyResult = { success: true };
          relationshipChanges.trust = Math.max(-100, relationship.trust - 25);
          break;
        }

        case "steal_holy_relics": {
          effects.relicTheftResult = { success: true, relic: "Sacred artifact stolen" };
          await ctx.db.patch(targetTerritory._id, {
            happiness: Math.max(0, targetTerritory.happiness - 12),
          });
          await ctx.db.patch(territory._id, {
            happiness: Math.min(100, territory.happiness + 5),
          });
          relationshipChanges.trust = Math.max(-100, relationship.trust - 40);
          break;
        }

        case "corrupt_religious_texts":
        case "poison_holy_water": {
          await ctx.db.patch(targetTerritory._id, {
            happiness: Math.max(0, targetTerritory.happiness - 6),
          });
          effects.corruptionResult = { success: true };
          break;
        }

        case "fake_divine_omens": {
          // Create panic or false hope in enemy territory
          const effect = Math.random() > 0.5 ? -10 : 5; // Either panic or false complacency
          await ctx.db.patch(targetTerritory._id, {
            happiness: Math.max(0, Math.min(100, targetTerritory.happiness + effect)),
          });
          effects.omenResult = { success: true, effect: effect > 0 ? "false_hope" : "panic" };
          break;
        }

        // =============================================
        // SABOTAGE - INFRASTRUCTURE WARFARE
        // =============================================

        case "destroy_enemy_bridges":
        case "destroy_enemy_roads": {
          const roads = await ctx.db
            .query("infrastructure")
            .withIndex("by_territory", (q: any) => q.eq("territoryId", targetTerritory._id))
            .filter((q: any) => q.or(q.eq(q.field("type"), "road"), q.eq(q.field("type"), "bridge")))
            .collect();

          if (roads.length > 0) {
            await ctx.db.delete(roads[0]._id);
            effects.infraDestructionResult = { success: true, destroyed: roads[0].type };
            relationshipChanges.trust = Math.max(-100, relationship.trust - 25);
          }
          break;
        }

        case "block_mountain_passes": {
          // Reduce trade efficiency
          const routes = await ctx.db
            .query("tradeRoutes")
            .filter((q: any) => q.or(
              q.eq(q.field("territory1Id"), targetTerritory._id),
              q.eq(q.field("territory2Id"), targetTerritory._id)
            ))
            .collect();

          for (const route of routes.slice(0, 2)) {
            await ctx.db.patch(route._id, { status: "blocked" });
          }
          effects.blockadeResult = { success: true, routesBlocked: Math.min(2, routes.length) };
          break;
        }

        case "burn_enemy_harbor": {
          const harbors = await ctx.db
            .query("infrastructure")
            .withIndex("by_territory", (q: any) => q.eq("territoryId", targetTerritory._id))
            .filter((q: any) => q.eq(q.field("type"), "harbor"))
            .collect();

          if (harbors.length > 0) {
            await ctx.db.delete(harbors[0]._id);
            effects.harborArsonResult = { success: true };
            relationshipChanges.trust = Math.max(-100, relationship.trust - 40);
          }
          break;
        }

        case "destroy_enemy_aqueducts": {
          const aqueducts = await ctx.db
            .query("infrastructure")
            .withIndex("by_territory", (q: any) => q.eq("territoryId", targetTerritory._id))
            .filter((q: any) => q.eq(q.field("type"), "aqueduct"))
            .collect();

          if (aqueducts.length > 0) {
            await ctx.db.delete(aqueducts[0]._id);
            await ctx.db.patch(targetTerritory._id, {
              happiness: Math.max(0, targetTerritory.happiness - 10),
            });
            effects.aqueductDestructionResult = { success: true };
          }
          break;
        }

        case "set_enemy_city_fires": {
          await ctx.db.patch(targetTerritory._id, {
            happiness: Math.max(0, targetTerritory.happiness - 20),
            population: Math.max(1, targetTerritory.population - Math.floor(targetTerritory.population * 0.03)),
          });
          effects.arsonResult = { success: true };
          relationshipChanges.trust = Math.max(-100, relationship.trust - 50);
          relationshipChanges.status = "at_war";
          break;
        }

        case "dam_enemy_rivers": {
          await ctx.db.patch(targetTerritory._id, {
            food: Math.max(0, targetTerritory.food - 15),
            happiness: Math.max(0, targetTerritory.happiness - 8),
          });
          effects.damResult = { success: true };
          relationshipChanges.trust = Math.max(-100, relationship.trust - 30);
          break;
        }

        // =============================================
        // SABOTAGE - PSYCHOLOGICAL WARFARE
        // =============================================

        case "spread_enemy_plague": {
          await ctx.db.patch(targetTerritory._id, {
            population: Math.max(1, targetTerritory.population - Math.floor(targetTerritory.population * 0.1)),
            happiness: Math.max(0, targetTerritory.happiness - 25),
          });
          effects.plagueResult = { success: true };
          relationshipChanges.trust = -100;
          relationshipChanges.status = "at_war";
          break;
        }

        case "kidnap_enemy_craftsmen": {
          const craftsmen = await ctx.db
            .query("characters")
            .withIndex("by_territory", (q: any) => q.eq("territoryId", targetTerritory._id))
            .filter((q: any) => q.and(
              q.eq(q.field("isAlive"), true),
              q.eq(q.field("role"), "craftsman")
            ))
            .collect();

          if (craftsmen.length > 0) {
            await ctx.db.patch(craftsmen[0]._id, { territoryId: territory._id });
            effects.kidnappingResult = { success: true, kidnapped: craftsmen[0].name };
            relationshipChanges.trust = Math.max(-100, relationship.trust - 30);
          }
          break;
        }

        case "encourage_enemy_emigration": {
          const emigrationAmount = Math.floor(targetTerritory.population * 0.05);
          await ctx.db.patch(targetTerritory._id, {
            population: Math.max(1, targetTerritory.population - emigrationAmount),
          });
          await ctx.db.patch(territory._id, {
            population: territory.population + Math.floor(emigrationAmount * 0.3),
          });
          effects.emigrationResult = { success: true, emigrants: emigrationAmount };
          break;
        }

        case "assassinate_enemy_healers": {
          const healers = await ctx.db
            .query("characters")
            .withIndex("by_territory", (q: any) => q.eq("territoryId", targetTerritory._id))
            .filter((q: any) => q.and(
              q.eq(q.field("isAlive"), true),
              q.eq(q.field("role"), "healer")
            ))
            .collect();

          if (healers.length > 0) {
            await ctx.db.patch(healers[0]._id, { isAlive: false, deathCause: "assassination" });
            effects.healerAssassinationResult = { success: true, victim: healers[0].name };
          }
          break;
        }

        case "spread_terror":
        case "display_enemy_heads":
        case "conduct_night_raids": {
          await ctx.db.patch(targetTerritory._id, {
            happiness: Math.max(0, targetTerritory.happiness - 20),
          });
          effects.terrorResult = { success: true };
          relationshipChanges.trust = Math.max(-100, relationship.trust - 40);
          break;
        }

        case "create_bad_omens": {
          await ctx.db.patch(targetTerritory._id, {
            happiness: Math.max(0, targetTerritory.happiness - 8),
          });
          effects.omenResult = { success: true };
          break;
        }

        case "demoralize_with_losses": {
          await ctx.db.patch(targetTerritory._id, {
            happiness: Math.max(0, targetTerritory.happiness - 12),
            military: Math.max(0, targetTerritory.military - 5),
          });
          effects.demoralizeResult = { success: true };
          break;
        }

        // =============================================
        // SABOTAGE - SOCIAL WARFARE
        // =============================================

        case "incite_class_warfare":
        case "spread_ethnic_hatred": {
          // Create internal faction conflict
          await ctx.db.patch(targetTerritory._id, {
            happiness: Math.max(0, targetTerritory.happiness - 15),
          });
          const factions = await ctx.db
            .query("factions")
            .withIndex("by_territory", (q: any) => q.eq("territoryId", targetTerritory._id))
            .collect();

          for (const faction of factions.slice(0, 2)) {
            await ctx.db.patch(faction._id, {
              rebellionRisk: Math.min(100, faction.rebellionRisk + 15),
            });
          }
          effects.socialWarfareResult = { success: true };
          break;
        }

        case "corrupt_enemy_youth": {
          await ctx.db.patch(targetTerritory._id, {
            happiness: Math.max(0, targetTerritory.happiness - 5),
            knowledge: Math.max(0, targetTerritory.knowledge - 2),
          });
          effects.corruptYouthResult = { success: true };
          break;
        }

        case "undermine_political_marriages": {
          const marriages = await ctx.db
            .query("marriages")
            .withIndex("by_territory", (q: any) => q.eq("territoryId", targetTerritory._id))
            .filter((q: any) => q.eq(q.field("status"), "active"))
            .collect();

          if (marriages.length > 0) {
            await ctx.db.patch(marriages[0]._id, {
              maritalHappiness: Math.max(0, marriages[0].maritalHappiness - 30),
            });
            effects.marriageSabotageResult = { success: true };
          }
          break;
        }

        case "spread_addiction": {
          // Introduce addiction to enemy population
          const characters = await ctx.db
            .query("characters")
            .withIndex("by_territory", (q: any) => q.eq("territoryId", targetTerritory._id))
            .filter((q: any) => q.eq(q.field("isAlive"), true))
            .collect();

          const target = characters.find((c: any) => !c.hasAddiction);
          if (target) {
            await ctx.db.patch(target._id, {
              hasAddiction: true,
              addictionType: "alcohol",
            });
            effects.addictionResult = { success: true, victim: target.name };
          }
          break;
        }

        case "destroy_cultural_artifacts": {
          await ctx.db.patch(targetTerritory._id, {
            happiness: Math.max(0, targetTerritory.happiness - 10),
            influence: Math.max(0, targetTerritory.influence - 5),
          });
          effects.culturalDestructionResult = { success: true };
          relationshipChanges.trust = Math.max(-100, relationship.trust - 30);
          break;
        }

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

  // =============================================
  // HUMAN LIFE SYSTEMS - ACTION HANDLERS
  // =============================================

  // MARRIAGE & DYNASTY
  if (action === "arrange_political_marriage" && targetTerritory) {
    try {
      const characters = await ctx.db
        .query("characters")
        .withIndex("by_territory", (q: any) => q.eq("territoryId", territory._id))
        .filter((q: any) => q.and(q.eq(q.field("isAlive"), true), q.eq(q.field("isMarried"), false)))
        .collect();

      const candidate = characters.find((c: any) => c.gender === "male" || c.gender === "female");
      if (candidate) {
        const result = await arrangePoliticalMarriage(
          ctx,
          territory._id,
          candidate._id,
          targetTerritory._id,
          currentTick,
          50 // Default dowry
        );
        effects.politicalMarriageResult = result;
      } else {
        effects.politicalMarriageResult = { success: false, message: "No unmarried candidates for marriage" };
      }
    } catch (e: any) {
      effects.politicalMarriageResult = { success: false, message: e.message };
    }
  }

  if (action === "set_inheritance_law") {
    // Extract law from reasoning
    let inheritanceRule: "primogeniture" | "agnatic" | "elective" | "seniority" = "primogeniture";
    if (reasoning) {
      const lower = reasoning.toLowerCase();
      if (lower.includes("agnatic") || lower.includes("male only")) inheritanceRule = "agnatic";
      else if (lower.includes("elective") || lower.includes("council chooses")) inheritanceRule = "elective";
      else if (lower.includes("seniority") || lower.includes("oldest")) inheritanceRule = "seniority";
    }

    const dynasty = await ctx.db
      .query("dynastyTrees")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", territory._id))
      .first();

    if (dynasty) {
      const result = await setInheritanceRule(ctx, dynasty._id, inheritanceRule, currentTick);
      effects.inheritanceLawResult = result;
    } else {
      effects.inheritanceLawResult = { success: false, message: "No dynasty exists. Found a dynasty first!" };
    }
  }

  if (action === "legitimize_bastard") {
    const dynasty = await ctx.db
      .query("dynastyTrees")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", territory._id))
      .first();

    const bastards = await ctx.db
      .query("characters")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", territory._id))
      .filter((q: any) => q.eq(q.field("isAlive"), true))
      .collect();

    const bastard = bastards.find((c: any) => c.traits?.includes("bastard"));

    if (dynasty && bastard) {
      const result = await legitimizeBastard(ctx, dynasty._id, bastard._id, currentTick);
      effects.legitimizeResult = result;
    } else if (!dynasty) {
      effects.legitimizeResult = { success: false, message: "No dynasty exists" };
    } else {
      effects.legitimizeResult = { success: false, message: "No bastards to legitimize" };
    }
  }

  // ROMANCE
  if (action === "encourage_match") {
    const characters = await ctx.db
      .query("characters")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", territory._id))
      .filter((q: any) => q.and(q.eq(q.field("isAlive"), true), q.eq(q.field("isMarried"), false)))
      .collect();

    const males = characters.filter((c: any) => c.gender === "male");
    const females = characters.filter((c: any) => c.gender === "female");

    if (males.length > 0 && females.length > 0) {
      const result = await encourageMatch(ctx, males[0]._id, females[0]._id, currentTick);
      effects.matchResult = result;
    } else {
      effects.matchResult = { success: false, message: "Not enough unmarried characters" };
    }
  }

  if (action === "forbid_relationship") {
    const romances = await ctx.db
      .query("romances")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", territory._id))
      .filter((q: any) => q.eq(q.field("status"), "active"))
      .collect();

    // Find inappropriate relationships (affairs, etc.)
    const inappropriate = romances.find((r: any) => r.isAdulterous || r.romanceType === "affair");
    if (inappropriate) {
      const result = await forbidRelationship(ctx, inappropriate.lover1Id, inappropriate.lover2Id, currentTick);
      effects.forbidResult = result;
    } else {
      effects.forbidResult = { success: false, message: "No inappropriate relationships to forbid" };
    }
  }

  // INFRASTRUCTURE
  if (action === "build_road" && targetTerritory) {
    const result = await startInfrastructureConstruction(ctx, territory._id, "road", currentTick, targetTerritory._id);
    effects.roadResult = result;
  }

  if (action === "build_wall") {
    const result = await startInfrastructureConstruction(ctx, territory._id, "wall", currentTick);
    effects.wallResult = result;
  }

  if (action === "build_aqueduct_infrastructure") {
    const result = await startInfrastructureConstruction(ctx, territory._id, "aqueduct", currentTick);
    effects.aqueductInfraResult = result;
  }

  if (action === "build_harbor") {
    const result = await startInfrastructureConstruction(ctx, territory._id, "harbor", currentTick);
    effects.harborResult = result;
  }

  // EXPLORATION
  if (action === "launch_expedition") {
    // Extract direction from reasoning
    let direction: "north" | "south" | "east" | "west" | "overseas" = "east";
    if (reasoning) {
      const lower = reasoning.toLowerCase();
      if (lower.includes("north")) direction = "north";
      else if (lower.includes("south")) direction = "south";
      else if (lower.includes("west")) direction = "west";
      else if (lower.includes("overseas") || lower.includes("sea")) direction = "overseas";
    }

    try {
      const result = await launchExpedition(
        ctx,
        territory._id,
        direction,
        20, // explorers
        10, // soldiers
        100, // supplies
        undefined, // leader
        currentTick
      );
      effects.expeditionResult = result;
    } catch (e: any) {
      effects.expeditionResult = { success: false, message: e.message };
    }
  }

  if (action === "establish_colony") {
    // Establishing a colony requires a successful expedition first
    // For now, this triggers planning for colonization
    const expeditions = await ctx.db
      .query("expeditions")
      .withIndex("by_origin", (q: any) => q.eq("originTerritoryId", territory._id))
      .filter((q: any) => q.eq(q.field("status"), "completed"))
      .collect();

    const successfulExpedition = expeditions.find((e: any) =>
      e.discoveries.some((d: any) => d.type === "fertile_land")
    );
    if (successfulExpedition) {
      effects.colonyResult = {
        success: true,
        message: `Colonial planning initiated based on expedition discoveries to the ${successfulExpedition.targetDirection}.`,
      };
    } else {
      effects.colonyResult = {
        success: false,
        message: "No suitable land discovered yet. Launch expeditions first to find fertile lands.",
      };
    }
  }

  // ESPIONAGE
  if (action === "train_spy") {
    try {
      const result = await trainSpy(ctx, territory._id, undefined, `Agent-${Math.floor(Math.random() * 1000)}`, currentTick);
      effects.trainSpyResult = result;
    } catch (e: any) {
      effects.trainSpyResult = { success: false, message: e.message };
    }
  }

  if (action === "deploy_spy" && targetTerritory) {
    // Find an available spy
    const spies = await ctx.db
      .query("spies")
      .withIndex("by_owner", (q: any) => q.eq("ownerTerritoryId", territory._id))
      .filter((q: any) => q.eq(q.field("status"), "active"))
      .collect();

    // Find spy at home
    const homeSpy = spies.find((s: any) => s.targetTerritoryId === territory._id);

    if (homeSpy) {
      // Extract mission and cover from reasoning
      let mission: "gather_intel" | "sabotage" | "assassinate" | "steal_tech" | "incite_rebellion" = "gather_intel";
      let cover: "merchant" | "diplomat" | "servant" | "scholar" | "traveler" = "merchant";

      if (reasoning) {
        const lower = reasoning.toLowerCase();
        if (lower.includes("sabotage")) mission = "sabotage";
        else if (lower.includes("assassin")) mission = "assassinate";
        else if (lower.includes("steal") || lower.includes("tech")) mission = "steal_tech";
        else if (lower.includes("rebellion") || lower.includes("incite")) mission = "incite_rebellion";

        if (lower.includes("diplomat")) cover = "diplomat";
        else if (lower.includes("servant")) cover = "servant";
        else if (lower.includes("scholar")) cover = "scholar";
        else if (lower.includes("traveler")) cover = "traveler";
      }

      const result = await deploySpy(ctx, homeSpy._id, targetTerritory._id, cover, mission, currentTick);
      effects.deploySpyResult = result;
    } else {
      effects.deploySpyResult = { success: false, message: "No available spies at home. Train more spies!" };
    }
  }

  if (action === "extract_spy") {
    const spies = await ctx.db
      .query("spies")
      .withIndex("by_owner", (q: any) => q.eq("ownerTerritoryId", territory._id))
      .filter((q: any) => q.and(
        q.eq(q.field("status"), "active"),
        q.neq(q.field("targetTerritoryId"), territory._id)
      ))
      .collect();

    if (spies.length > 0) {
      const result = await extractSpy(ctx, spies[0]._id, currentTick);
      effects.extractSpyResult = result;
    } else {
      effects.extractSpyResult = { success: false, message: "No deployed spies to extract" };
    }
  }

  if (action === "increase_counter_intelligence") {
    const result = await increaseCounterIntelligence(ctx, territory._id, 10, currentTick);
    effects.counterIntelResult = result;
  }

  if (action === "execute_captured_spy") {
    const capturedSpies = await ctx.db
      .query("spies")
      .withIndex("by_target", (q: any) => q.eq("targetTerritoryId", territory._id))
      .filter((q: any) => q.eq(q.field("status"), "captured"))
      .collect();

    if (capturedSpies.length > 0) {
      const result = await handleCapturedSpy(ctx, capturedSpies[0]._id, "execute", currentTick);
      effects.executeSpyResult = result;
    } else {
      effects.executeSpyResult = { success: false, message: "No captured spies to execute" };
    }
  }

  if (action === "turn_captured_spy") {
    const capturedSpies = await ctx.db
      .query("spies")
      .withIndex("by_target", (q: any) => q.eq("targetTerritoryId", territory._id))
      .filter((q: any) => q.eq(q.field("status"), "captured"))
      .collect();

    if (capturedSpies.length > 0) {
      const result = await handleCapturedSpy(ctx, capturedSpies[0]._id, "turn", currentTick);
      effects.turnSpyResult = result;
    } else {
      effects.turnSpyResult = { success: false, message: "No captured spies to turn" };
    }
  }

  // GENDER & SOCIETY
  if (action === "grant_women_rights") {
    // Extract which right from reasoning
    let right: "work" | "own" | "rule" | "fight" = "work";
    if (reasoning) {
      const lower = reasoning.toLowerCase();
      if (lower.includes("own") || lower.includes("property")) right = "own";
      else if (lower.includes("rule") || lower.includes("lead")) right = "rule";
      else if (lower.includes("fight") || lower.includes("military")) right = "fight";
    }

    const result = await grantWomenRights(ctx, territory._id, right, currentTick);
    effects.womenRightsResult = result;
  }

  if (action === "restrict_women_roles") {
    // Extract which role to restrict
    let role: "work" | "own" | "rule" | "fight" = "work";
    if (reasoning) {
      const lower = reasoning.toLowerCase();
      if (lower.includes("own") || lower.includes("property")) role = "own";
      else if (lower.includes("rule") || lower.includes("lead")) role = "rule";
      else if (lower.includes("fight") || lower.includes("military")) role = "fight";
    }

    const result = await restrictWomenRoles(ctx, territory._id, role, currentTick);
    effects.restrictRolesResult = result;
  }

  // WAR DEMOGRAPHICS
  if (action === "conscript_reserves") {
    const result = await callUpReserves(ctx, territory._id, currentTick);
    effects.conscriptResult = result;
  }

  if (action === "emergency_conscription") {
    const result = await activateEmergencyMeasures(ctx, territory._id, "expanded_age", currentTick);
    effects.emergencyConscriptionResult = result;
  }

  if (action === "care_for_widows") {
    const result = await careForWidowsOrphans(ctx, territory._id, currentTick);
    effects.careResult = result;
  }

  // MENTAL HEALTH
  if (action === "establish_healing_sanctuary") {
    const result = await establishHealingSanctuary(ctx, territory._id, currentTick);
    effects.healingSanctuaryResult = result;
  }

  if (action === "exile_madman") {
    const madCharacters = await ctx.db
      .query("characters")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", territory._id))
      .filter((q: any) => q.eq(q.field("isAlive"), true))
      .collect();

    const madman = madCharacters.find((c: any) => c.mentalHealth?.madness);
    if (madman) {
      const result = await exileMadCharacter(ctx, madman._id, currentTick);
      effects.exileMadmanResult = result;
    } else {
      effects.exileMadmanResult = { success: false, message: "No mad characters to exile" };
    }
  }

  // ADDICTION
  if (action === "ban_substances") {
    let substance: "alcohol" | "gambling" | "opium" | "other" = "alcohol";
    if (reasoning) {
      const lower = reasoning.toLowerCase();
      if (lower.includes("gambling")) substance = "gambling";
      else if (lower.includes("opium") || lower.includes("drug")) substance = "opium";
    }
    const result = await banSubstances(ctx, territory._id, substance, currentTick);
    effects.banSubstancesResult = result;
  }

  if (action === "tavern_regulation") {
    const result = await regulateTaverns(ctx, territory._id, currentTick);
    effects.tavernRegulationResult = result;
  }

  // =============================================
  // GUT FEELING - INSTINCT-BASED DECISIONS
  // =============================================

  if (action === "harden_people") {
    // Institute rigorous training for the population
    const currentHappiness = territory.happiness;
    const currentWealth = territory.wealth;
    const currentMilitary = territory.military;

    // Harsh training reduces happiness but increases military potential
    const newHappiness = Math.max(0, currentHappiness - 15);
    const newWealth = Math.max(0, currentWealth - 10);
    const newMilitary = Math.min(100, currentMilitary + 5);

    await ctx.db.patch(territory._id, {
      happiness: newHappiness,
      wealth: newWealth,
      military: newMilitary,
    });

    // Create a memory about hardening the people
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", territory._id))
      .first();

    if (agent) {
      await recordMemory(ctx, agent._id, territory._id, "victory", currentTick,
        "Instituted rigorous training to harden our people. The weak shall become strong.",
        -5, 60);
    }

    // Make characters stronger over time - increase courage/strength traits
    const characters = await ctx.db
      .query("characters")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", territory._id))
      .filter((q: any) => q.eq(q.field("isAlive"), true))
      .take(20);

    for (const char of characters) {
      if (Math.random() < 0.3) { // 30% chance to improve
        await ctx.db.patch(char._id, {
          traits: {
            ...char.traits,
            courage: Math.min(100, (char.traits.courage || 50) + 5),
            strength: Math.min(100, ((char.traits as any).strength || 50) + 5),
          },
        });
      }
    }

    effects.hardenPeopleResult = {
      success: true,
      message: "The people undergo harsh training. Happiness falls but strength grows.",
      happinessLost: 15,
      wealthLost: 10,
      militaryGained: 5,
    };
  }

  if (action === "strengthen_bloodline") {
    // Ruler focuses on having many strong children
    const ruler = await ctx.db
      .query("characters")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", territory._id))
      .filter((q: any) => q.eq(q.field("role"), "ruler"))
      .first();

    if (ruler && ruler.isAlive) {
      // Create new children with enhanced traits
      const childrenToCreate = 2 + Math.floor(Math.random() * 3); // 2-4 children
      const childrenCreated: string[] = [];

      for (let i = 0; i < childrenToCreate; i++) {
        const gender = Math.random() < 0.5 ? "male" : "female";
        const childName = `Child of ${ruler.name} ${i + 1}`;

        // Enhanced traits from selective breeding
        const baseTraits = {
          ambition: 40 + Math.floor(Math.random() * 30),
          greed: 30 + Math.floor(Math.random() * 20),
          loyalty: 50 + Math.floor(Math.random() * 30),
          honor: 40 + Math.floor(Math.random() * 30),
          cruelty: 20 + Math.floor(Math.random() * 20),
          compassion: 40 + Math.floor(Math.random() * 30),
          cunning: 40 + Math.floor(Math.random() * 30),
          wisdom: 30 + Math.floor(Math.random() * 20),
          paranoia: 20 + Math.floor(Math.random() * 20),
          courage: 50 + Math.floor(Math.random() * 30), // Higher courage
          pride: 40 + Math.floor(Math.random() * 30),
          wrath: 20 + Math.floor(Math.random() * 20),
          charisma: 40 + Math.floor(Math.random() * 30),
          diplomacy: 30 + Math.floor(Math.random() * 20),
          strength: 50 + Math.floor(Math.random() * 30), // Higher strength
        };

        await ctx.db.insert("characters", {
          territoryId: territory._id,
          name: childName,
          title: "Child",
          role: "child",
          gender,
          age: 0,
          birthTick: currentTick,
          isAlive: true,
          canFight: false,
          traits: baseTraits,
          emotionalState: {
            hope: 80,
            fear: 10,
            shame: 0,
            despair: 0,
            contentment: 70,
            rage: 0,
          },
          profession: "none",
          activePlots: [],
        });

        childrenCreated.push(childName);
      }

      // Costs wealth to support children
      await ctx.db.patch(territory._id, {
        wealth: Math.max(0, territory.wealth - 5),
        population: territory.population + childrenToCreate,
      });

      effects.strengthenBloodlineResult = {
        success: true,
        message: `${ruler.name} has sired ${childrenToCreate} children to strengthen the bloodline.`,
        childrenCreated,
        wealthCost: 5,
      };
    } else {
      effects.strengthenBloodlineResult = {
        success: false,
        message: "No ruler available to strengthen the bloodline.",
      };
    }
  }

  if (action === "spartan_upbringing") {
    // Harsh training for children
    const children = await ctx.db
      .query("characters")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", territory._id))
      .filter((q: any) => q.and(
        q.eq(q.field("isAlive"), true),
        q.lt(q.field("age"), 16)
      ))
      .take(20);

    let childrenTrained = 0;
    for (const child of children) {
      // Enhance warrior traits
      await ctx.db.patch(child._id, {
        traits: {
          ...child.traits,
          courage: Math.min(100, (child.traits.courage || 50) + 15),
          loyalty: Math.min(100, (child.traits.loyalty || 50) + 10),
          strength: Math.min(100, ((child.traits as any).strength || 50) + 15),
          compassion: Math.max(0, (child.traits.compassion || 50) - 10), // Less compassion
        },
      });
      childrenTrained++;
    }

    // Happiness drops significantly
    await ctx.db.patch(territory._id, {
      happiness: Math.max(0, territory.happiness - 20),
      military: Math.min(100, territory.military + 3),
    });

    effects.spartanUpbringingResult = {
      success: true,
      message: `${childrenTrained} children undergo Spartan training. They will be warriors.`,
      childrenTrained,
      happinessLost: 20,
    };
  }

  if (action === "selective_marriages") {
    // Arrange marriages with strong families
    const eligibleCharacters = await ctx.db
      .query("characters")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", territory._id))
      .filter((q: any) => q.and(
        q.eq(q.field("isAlive"), true),
        q.gte(q.field("age"), 16),
        q.lte(q.field("age"), 50)
      ))
      .take(10);

    const marriagesArranged = Math.min(3, Math.floor(eligibleCharacters.length / 2));

    // Marriage costs dowry
    await ctx.db.patch(territory._id, {
      wealth: Math.max(0, territory.wealth - marriagesArranged * 5),
      happiness: Math.min(100, territory.happiness + 2), // Some happiness from weddings
    });

    effects.selectiveMarriagesResult = {
      success: true,
      message: `${marriagesArranged} strategic marriages arranged to strengthen bloodlines.`,
      marriagesArranged,
      dowryCost: marriagesArranged * 5,
    };
  }

  if (action === "cull_the_weak") {
    // Dark choice - remove those who cannot contribute
    const weakCharacters = await ctx.db
      .query("characters")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", territory._id))
      .filter((q: any) => q.and(
        q.eq(q.field("isAlive"), true),
        q.or(
          q.gte(q.field("age"), 65), // Elderly
          q.lte(q.field("age"), 5) // Very young
        )
      ))
      .take(20);

    let culled = 0;
    for (const char of weakCharacters) {
      if (Math.random() < 0.5) { // 50% chance to be culled
        await ctx.db.patch(char._id, {
          isAlive: false,
          deathTick: currentTick,
          deathCause: "exiled",
        });
        culled++;
      }
    }

    // Population decreases, food increases, happiness plummets
    await ctx.db.patch(territory._id, {
      population: Math.max(10, territory.population - culled),
      food: Math.min(200, territory.food + culled * 2),
      happiness: Math.max(0, territory.happiness - 30),
    });

    // Record traumatic memory
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", territory._id))
      .first();

    if (agent) {
      await recordMemory(ctx, agent._id, territory._id, "crisis", currentTick,
        `The ruler ordered the culling of ${culled} weak and elderly. A dark day our people will never forget.`,
        -80, 95);
    }

    effects.cullTheWeakResult = {
      success: true,
      message: `${culled} deemed unfit were exiled/abandoned. A cruel but efficient choice.`,
      culled,
      foodGained: culled * 2,
      happinessLost: 30,
    };
  }

  if (action === "trust_instincts") {
    // The AI describes what their gut tells them - we interpret it loosely
    // This action has variable effects based on the reasoning provided
    const randomOutcome = Math.random();

    if (randomOutcome < 0.4) {
      // Positive outcome - gut was right
      await ctx.db.patch(territory._id, {
        happiness: Math.min(100, territory.happiness + 5),
        knowledge: Math.min(100, territory.knowledge + 3),
      });
      effects.trustInstinctsResult = {
        success: true,
        outcome: "positive",
        message: "Your instincts proved correct. The people feel confident in your leadership.",
      };
    } else if (randomOutcome < 0.7) {
      // Neutral outcome
      effects.trustInstinctsResult = {
        success: true,
        outcome: "neutral",
        message: "Your instincts led to no significant change, but experience was gained.",
      };
    } else {
      // Negative outcome - gut was wrong
      await ctx.db.patch(territory._id, {
        happiness: Math.max(0, territory.happiness - 5),
      });
      effects.trustInstinctsResult = {
        success: true,
        outcome: "negative",
        message: "Your instincts misled you this time. The people question your judgment.",
      };
    }

    // Record the instinct-based decision
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", territory._id))
      .first();

    if (agent) {
      await recordMemory(ctx, agent._id, territory._id, "discovery", currentTick,
        "Made a decision based purely on gut instinct rather than rational analysis.",
        0, 50);
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
    // Treasury - positive
    case "establish_bank":
    case "repay_loan":
    case "lower_taxes":
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
    // Treasury - info
    case "mint_coins":
    case "set_price_controls":
    case "remove_price_controls":
    case "increase_wages":
    case "grant_tax_exemption":
      return "info";

    // Negative actions
    case "train_warriors":
    case "show_strength":
    case "establish_dictatorship":
    case "demand_surrender":
    case "surrender":
    // Treasury - negative (risky)
    case "debase_currency":
    case "raise_taxes":
    case "crack_down_tax_evaders":
    case "take_loan":
    // Sabotage - Negative Actions
    case "capture_enemy_scholars":
    case "kidnap_enemy_apprentices":
    case "loot_scrolls_and_texts":
    case "steal_enemy_scrolls":
    case "execute_enemy_teachers":
    case "poison_enemy_teachers":
    case "burn_enemy_schools":
    case "burn_enemy_library":
    case "sabotage_enemy_school":
    case "destroy_enemy_university":
    case "spread_misinformation":
    case "corrupt_enemy_curriculum":
    case "bribe_scholar_to_defect":
    case "incite_student_riot":
    case "infiltrate_enemy_academy":
    case "poison_enemy_crops":
    case "introduce_pests":
    case "counterfeit_currency":
    case "burn_enemy_granaries":
    case "sabotage_enemy_mines":
    case "collapse_enemy_mines":
    case "burn_enemy_market":
    case "bribe_enemy_merchants":
    case "steal_trade_secrets":
    case "disrupt_enemy_caravans":
    case "poison_army_supplies":
    case "sabotage_enemy_weapons":
    case "disable_siege_equipment":
    case "steal_battle_plans":
    case "incite_desertion":
    case "bribe_soldiers_to_defect":
    case "spread_camp_disease":
    case "sabotage_enemy_fortifications":
    case "burn_enemy_armory":
    case "spread_enemy_propaganda":
    case "spread_ruler_rumors":
    case "incite_enemy_rebellion":
    case "support_rival_faction":
    case "bribe_enemy_advisors":
    case "forge_enemy_documents":
    case "frame_noble_for_treason":
    case "create_enemy_succession_crisis":
    case "blackmail_enemy_officials":
    case "desecrate_enemy_temple":
    case "spread_heresy":
    case "support_rival_cult":
    case "steal_holy_relics":
    case "corrupt_religious_texts":
    case "poison_holy_water":
    case "fake_divine_omens":
    case "destroy_enemy_bridges":
    case "destroy_enemy_roads":
    case "block_mountain_passes":
    case "burn_enemy_harbor":
    case "destroy_enemy_aqueducts":
    case "dam_enemy_rivers":
    case "kidnap_enemy_craftsmen":
    case "encourage_enemy_emigration":
    case "create_bad_omens":
    case "conduct_night_raids":
    case "demoralize_with_losses":
    case "incite_class_warfare":
    case "spread_ethnic_hatred":
    case "corrupt_enemy_youth":
    case "undermine_political_marriages":
    case "spread_addiction":
    case "destroy_cultural_artifacts":
    case "demand_scholars_as_tribute":
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
    // Endgame Nuclear Actions
    case "start_nuclear_program":
    case "nuclear_strike":
    // Sabotage - Critical Actions
    case "assassinate_enemy_general":
    case "assassinate_enemy_heir":
    case "assassinate_enemy_priests":
    case "assassinate_enemy_scholar":
    case "assassinate_enemy_healers":
    case "spread_enemy_plague":
    case "contaminate_enemy_water":
    case "poison_enemy_food_supply":
    case "set_enemy_city_fires":
    case "spread_terror":
    case "display_enemy_heads":
      return "critical";

    // Rise and Fall - Reform Actions
    case "implement_reform":
    case "propose_disarmament":
      return "positive";
    case "purge_corruption":
    case "austerity_measures":
    case "bread_and_circuses":
    case "stop_nuclear_production":
      return "info";

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

    // Human Life Systems - Marriage & Dynasty (positive)
    case "arrange_political_marriage":
    case "legitimize_bastard":
    case "encourage_match":
      return "positive";
    case "set_inheritance_law":
    case "forbid_relationship":
      return "info";

    // Human Life Systems - Infrastructure (positive)
    case "build_road":
    case "build_aqueduct_infrastructure":
    case "build_harbor":
      return "positive";
    case "build_wall":
      return "info"; // Defensive, neutral

    // Human Life Systems - Exploration (positive/info)
    case "launch_expedition":
    case "establish_colony":
      return "positive";

    // Human Life Systems - Espionage (varies)
    case "train_spy":
    case "deploy_spy":
    case "extract_spy":
    case "increase_counter_intelligence":
      return "info";
    case "execute_captured_spy":
    case "turn_captured_spy":
      return "negative";

    // Human Life Systems - Gender & Society (info)
    case "grant_women_rights":
    case "restrict_women_roles":
      return "info";

    // Human Life Systems - War Demographics
    case "conscript_reserves":
    case "emergency_conscription":
      return "negative";
    case "care_for_widows":
      return "positive";

    // Human Life Systems - Mental Health
    case "establish_healing_sanctuary":
      return "positive";
    case "exile_madman":
      return "negative";

    // Human Life Systems - Addiction
    case "ban_substances":
    case "tavern_regulation":
      return "info";

    // Gut Feeling - Instinct-Based Decisions
    case "strengthen_bloodline":
    case "selective_marriages":
    case "trust_instincts":
      return "info";
    case "harden_people":
    case "spartan_upbringing":
      return "negative"; // Harsh but strategic
    case "cull_the_weak":
      return "critical"; // Dark and controversial

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
// ESPIONAGE CONTEXT - For military decisions
// =============================================

export const getEspionageContext = internalQuery({
  args: { territoryId: v.id("territories") },
  handler: async (ctx, args) => {
    const territory = await ctx.db.get(args.territoryId);
    if (!territory) return null;

    // Get our spies
    const ourSpies = await ctx.db
      .query("spies")
      .withIndex("by_owner", (q: any) => q.eq("ownerTerritoryId", args.territoryId))
      .collect();

    const activeSpies = ourSpies.filter(s => s.status === "active");
    const capturedSpies = ourSpies.filter(s => s.status === "captured");

    // Get enemy spies in our territory (detected ones)
    const enemySpies = await ctx.db
      .query("spies")
      .withIndex("by_target", (q: any) => q.eq("targetTerritoryId", args.territoryId))
      .filter((q: any) => q.eq(q.field("status"), "captured"))
      .collect();

    // Gather all intelligence reports from our spies
    const intelligence: Array<{
      targetTerritoryName: string;
      intelType: string;
      info: string;
      tickGathered: number;
      reliability: "low" | "medium" | "high";
    }> = [];

    for (const spy of ourSpies) {
      if (spy.intelligence && spy.intelligence.length > 0) {
        const targetTerritory = await ctx.db.get(spy.targetTerritoryId);
        const targetName = targetTerritory?.name || "Unknown";

        for (const intel of spy.intelligence.slice(-5)) { // Last 5 reports per spy
          // Reliability based on spy skill and infiltration level
          let reliability: "low" | "medium" | "high" = "medium";
          if (spy.skill >= 70 && spy.infiltrationLevel >= 50) {
            reliability = "high";
          } else if (spy.skill < 40 || spy.infiltrationLevel < 20) {
            reliability = "low";
          }

          intelligence.push({
            targetTerritoryName: targetName,
            intelType: intel.type,
            info: intel.info,
            tickGathered: intel.tick,
            reliability,
          });
        }
      }
    }

    // Gather sabotage targets - education assets in rival territories
    const allTerritories = await ctx.db.query("territories").collect();
    const sabotageTargets: Array<{
      territoryName: string;
      hasLibrary: boolean;
      hasUniversity: boolean;
      hasSchools: number;
      scholarCount: number;
      educationVulnerability: number;
      hasSpy: boolean;
    }> = [];

    for (const otherTerritory of allTerritories) {
      if (otherTerritory._id === args.territoryId) continue;
      if ((otherTerritory as any).isEliminated) continue;

      // Get schools in this territory
      const schools = await ctx.db
        .query("schools")
        .withIndex("by_territory", (q: any) => q.eq("territoryId", otherTerritory._id))
        .collect();

      // Get scholars/teachers
      const educators = await ctx.db
        .query("characters")
        .withIndex("by_territory", (q: any) => q.eq("territoryId", otherTerritory._id))
        .filter((q: any) => q.and(
          q.eq(q.field("isAlive"), true),
          q.or(
            q.eq(q.field("profession"), "scholar"),
            q.eq(q.field("profession"), "teacher"),
            q.eq(q.field("profession"), "scribe")
          )
        ))
        .collect();

      // Check if we have a spy there
      const hasSpy = activeSpies.some(s => s.targetTerritoryId === otherTerritory._id);

      // Calculate vulnerability
      const counterIntel = otherTerritory.spyNetwork?.counterIntelligence || 10;
      const baseVulnerability = 60 - counterIntel / 2;
      const educationVulnerability = Math.max(10, Math.min(90, baseVulnerability));

      // Only include if they have education assets worth targeting
      const hasLibrary = schools.some(s => (s as any).schoolType === "library");
      const hasUniversity = schools.some(s => s.schoolType === "university");

      if (schools.length > 0 || educators.length > 0 || otherTerritory.knowledge > 30) {
        sabotageTargets.push({
          territoryName: otherTerritory.name,
          hasLibrary,
          hasUniversity,
          hasSchools: schools.length,
          scholarCount: educators.length,
          educationVulnerability,
          hasSpy,
        });
      }
    }

    return {
      activeSpies: activeSpies.length,
      capturedSpies: capturedSpies.length,
      counterIntelligence: territory.spyNetwork?.counterIntelligence || 10,
      intelligence,
      knownEnemySpies: enemySpies.length,
      sabotageTargets,
    };
  },
});

// Get religion context for AI decisions
export const getReligionContext = internalQuery({
  args: { territoryId: v.id("territories") },
  handler: async (ctx, args) => {
    const territory = await ctx.db.get(args.territoryId);
    if (!territory) return null;

    // Get state religion if exists
    let stateReligion;
    const religions = await ctx.db
      .query("religions")
      .withIndex("by_territory", (q: any) => q.eq("foundingTerritoryId", args.territoryId))
      .collect();

    const mainReligion = religions.find(r => r.isStateReligion) || religions[0];
    if (mainReligion) {
      stateReligion = {
        name: mainReligion.name,
        deity: mainReligion.deity,
        beliefs: mainReligion.beliefs || [],
        practices: mainReligion.practices || [],
        tolerance: mainReligion.tolerance || 50,
      };
    }

    // Get ruler piety
    const ruler = await ctx.db
      .query("characters")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", args.territoryId))
      .filter((q: any) => q.eq(q.field("role"), "ruler"))
      .first();
    const rulerPiety = ruler?.piety || 0;

    // Count temples
    const temples = await ctx.db
      .query("buildings")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", args.territoryId))
      .filter((q: any) => q.eq(q.field("type"), "temple"))
      .collect();

    // Count priests
    const priests = await ctx.db
      .query("characters")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", args.territoryId))
      .filter((q: any) => q.eq(q.field("role"), "priest"))
      .collect();

    // Calculate average population piety (estimate from ruler and religion spread)
    let averagePiety = rulerPiety * 0.3;
    if (stateReligion) {
      averagePiety += 20; // State religion adds base piety
    }
    if (temples.length > 0) {
      averagePiety += Math.min(30, temples.length * 10); // Temples add piety
    }
    if (priests.length > 0) {
      averagePiety += Math.min(20, priests.length * 5); // Priests add piety
    }

    return {
      stateReligion,
      rulerPiety,
      templeCount: temples.length,
      priestCount: priests.length,
      averagePopulationPiety: Math.min(100, averagePiety),
    };
  },
});

// Get education context for AI decisions
export const getEducationContext = internalQuery({
  args: { territoryId: v.id("territories") },
  handler: async (ctx, args) => {
    const territory = await ctx.db.get(args.territoryId);
    if (!territory) return null;

    // Get all schools
    const schools = await ctx.db
      .query("schools")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", args.territoryId))
      .collect();

    // Get all living characters
    const characters = await ctx.db
      .query("characters")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", args.territoryId))
      .filter((q: any) => q.eq(q.field("isAlive"), true))
      .collect();

    // Calculate literacy rate
    const literateCount = characters.filter(c => c.isLiterate).length;
    const literacyRate = characters.length > 0 ? (literateCount / characters.length) * 100 : 0;

    // Count apprentices
    const apprenticeCount = characters.filter(c => c.apprenticeMasterId).length;

    // Count children and those in school
    const children = characters.filter(c => (c.age || 0) < 16);
    const childrenInSchool = characters.filter(c =>
      (c.age || 0) < 16 && c.currentlyStudying
    ).length;

    // Aggregate skilled workers
    const skilledWorkers: Record<string, { count: number; maxLevel: number }> = {};

    for (const char of characters) {
      const skills = char.skills;
      if (!skills) continue;

      for (const [skillType, level] of Object.entries(skills)) {
        if (typeof level !== "number" || level <= 10) continue; // Only count meaningful skills

        if (!skilledWorkers[skillType]) {
          skilledWorkers[skillType] = { count: 0, maxLevel: 0 };
        }

        skilledWorkers[skillType].count++;
        skilledWorkers[skillType].maxLevel = Math.max(
          skilledWorkers[skillType].maxLevel,
          level
        );
      }
    }

    // Get blocked actions due to missing skills
    const { getBlockedActions } = await import("../simulation/professionSkills");
    const blockedActions = await getBlockedActions(ctx, args.territoryId);

    return {
      schools: schools.map(s => ({
        type: s.schoolType,
        students: s.currentEnrollment,
        capacity: s.studentCapacity,
      })),
      literacyRate,
      apprenticeCount,
      childrenInSchool,
      totalChildren: children.length,
      skilledWorkers,
      blockedActions: blockedActions.slice(0, 8), // Limit to 8 most important
    };
  },
});

// Get sabotage motivation context for AI decisions
export const getSabotageContext = internalQuery({
  args: { territoryId: v.id("territories") },
  handler: async (ctx, args) => {
    // Import the sabotage motive system
    const { getSabotageContext: calculateSabotage } = await import("../simulation/sabotageMotive");

    // Get sabotage pressure and motivations
    const sabotageInfo = await calculateSabotage(ctx, args.territoryId);

    return sabotageInfo;
  },
});

// =============================================
// 15 NEW CONTEXT QUERIES
// =============================================

// 1. Weather Context
export const getWeatherContext = internalQuery({
  args: { territoryId: v.id("territories") },
  handler: async (ctx, args) => {
    const weather = await ctx.db
      .query("weather")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", args.territoryId))
      .first();

    if (!weather) return null;

    const world = await ctx.db.query("world").first();
    const currentTick = world?.tick || 0;

    return {
      currentWeather: weather.currentWeather,
      temperature: weather.temperature,
      isExtreme: weather.isExtreme,
      farmingModifier: weather.farmingModifier,
      militaryModifier: weather.militaryModifier,
      travelModifier: weather.travelModifier,
      moodModifier: weather.moodModifier,
      expectedDuration: Math.max(0, weather.expectedEndTick - currentTick),
    };
  },
});

// 2. Disaster Context
export const getDisasterContext = internalQuery({
  args: { territoryId: v.id("territories") },
  handler: async (ctx, args) => {
    const disasters = await ctx.db
      .query("disasters")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", args.territoryId))
      .collect();

    const activeDisasters = disasters
      .filter(d => d.status === "active" || d.status === "recovering")
      .map(d => ({
        type: d.type,
        severity: d.severity,
        casualties: d.populationCasualties,
        buildingsDestroyed: d.buildingsDestroyed,
        recoveryProgress: d.recoveryProgress,
      }));

    const recentDisasters = disasters
      .filter(d => d.status === "recovered")
      .slice(-3)
      .map(d => ({
        type: d.type,
        tick: d.endTick,
      }));

    // Calculate risk based on conditions
    const territory = await ctx.db.get(args.territoryId);
    let disasterRisk = 10; // Base risk
    if (territory) {
      if (territory.population > 500) disasterRisk += 10;
      if (territory.food < 20) disasterRisk += 15;
    }

    return {
      activeDisasters,
      recentDisasters,
      disasterRisk: Math.min(100, disasterRisk),
    };
  },
});

// 3. Infrastructure Context
export const getInfrastructureContext = internalQuery({
  args: { territoryId: v.id("territories") },
  handler: async (ctx, args) => {
    const infrastructure = await ctx.db
      .query("infrastructure")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", args.territoryId))
      .collect();

    const allTerritories = await ctx.db.query("territories").collect();
    const territoryNames = new Map(allTerritories.map(t => [t._id.toString(), t.name]));

    const infraList = infrastructure.map(i => ({
      type: i.type,
      level: i.level,
      condition: i.condition,
      isUnderConstruction: i.isUnderConstruction,
      constructionProgress: i.constructionProgress,
      connectsTo: i.connectsTo ? territoryNames.get(i.connectsTo.toString()) : undefined,
    }));

    // Calculate total bonuses
    let tradeBonus = 0, defenseBonus = 0, travelSpeed = 0, waterAccess = 0;
    for (const i of infrastructure) {
      if (!i.isUnderConstruction) {
        if (i.type === "road") travelSpeed += i.level * 5;
        if (i.type === "harbor") tradeBonus += i.level * 10;
        if (i.type === "wall") defenseBonus += i.level * 15;
        if (i.type === "aqueduct") waterAccess += i.level * 20;
      }
    }

    return {
      infrastructure: infraList,
      totalBonuses: { tradeBonus, defenseBonus, travelSpeed, waterAccess },
    };
  },
});

// 4. Dynasty Context
export const getDynastyContext = internalQuery({
  args: { territoryId: v.id("territories") },
  handler: async (ctx, args) => {
    const dynasty = await ctx.db
      .query("dynastyTrees")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", args.territoryId))
      .first();

    const characters = await ctx.db
      .query("characters")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", args.territoryId))
      .filter((q: any) => q.eq(q.field("isAlive"), true))
      .collect();

    const ruler = characters.find(c => c.role === "ruler");
    const heir = characters.find(c => c.role === "heir");
    const rivalClaimants = characters.filter(c =>
      c.secretGoal === "claim_throne" || (c.traits && c.traits.includes("ambitious"))
    ).length;

    // Find marriage opportunities (unmarried nobles from other territories)
    const allCharacters = await ctx.db
      .query("characters")
      .filter((q: any) => q.and(
        q.eq(q.field("isAlive"), true),
        q.neq(q.field("territoryId"), args.territoryId)
      ))
      .collect();

    const unmarriedNobles = allCharacters
      .filter(c => !c.spouseId && (c.role === "heir" || c.role === "noble") && (c.age || 16) >= 16)
      .slice(0, 3);

    const territories = await ctx.db.query("territories").collect();
    const territoryNames = new Map(territories.map(t => [t._id.toString(), t.name]));

    const marriageOpportunities = unmarriedNobles.map(c => ({
      characterName: c.name,
      targetTerritory: territoryNames.get(c.territoryId.toString()) || "Unknown",
      allianceValue: c.role === "heir" ? 80 : 50,
      politicalBenefit: c.role === "heir" ? "Potential alliance through heir marriage" : "Noble connection",
    }));

    // Count active marriages
    const marriages = await ctx.db
      .query("marriages")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", args.territoryId))
      .filter((q: any) => q.eq(q.field("status"), "active"))
      .collect();

    const politicalAlliances = marriages.filter(m => m.marriageType === "political").length;

    return {
      currentDynasty: dynasty ? {
        name: dynasty.dynastyName,
        generations: dynasty.totalGenerations,
        prestige: dynasty.prestige,
        inheritanceRule: dynasty.inheritanceRule,
      } : undefined,
      successionStatus: {
        hasHeir: !!heir,
        heirName: heir?.name,
        heirAge: heir?.age,
        successionRisk: heir ? (rivalClaimants * 10) : 70,
        rivalClaimants,
      },
      marriageOpportunities,
      activeMarriages: marriages.length,
      politicalAlliances,
    };
  },
});

// 5. Romance Context
export const getRomanceContext = internalQuery({
  args: { territoryId: v.id("territories") },
  handler: async (ctx, args) => {
    const romances = await ctx.db
      .query("romances")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", args.territoryId))
      .filter((q: any) => q.eq(q.field("status"), "active"))
      .collect();

    const characters = await ctx.db
      .query("characters")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", args.territoryId))
      .filter((q: any) => q.eq(q.field("isAlive"), true))
      .collect();

    const charNames = new Map(characters.map(c => [c._id.toString(), c.name]));

    const activeRomances = romances.map(r => ({
      person1: charNames.get(r.lover1Id.toString()) || "Unknown",
      person2: charNames.get(r.lover2Id.toString()) || "Unknown",
      type: r.romanceType,
      isSecret: r.isSecret,
      isAdulterous: r.isAdulterous,
      scandalRisk: r.isAdulterous ? (r.isSecret ? 40 : 80) : (r.isSecret ? 20 : 0),
    }));

    // Count eligible singles
    const eligibleBachelors = characters.filter(c =>
      c.gender === "male" && !c.spouseId && (c.age || 16) >= 16
    ).length;
    const eligibleMaidens = characters.filter(c =>
      c.gender === "female" && !c.spouseId && (c.age || 16) >= 16
    ).length;

    // Get recent scandals from events
    const world = await ctx.db.query("world").first();
    const recentEvents = await ctx.db
      .query("events")
      .filter((q: any) => q.and(
        q.eq(q.field("territoryId"), args.territoryId),
        q.gte(q.field("tick"), (world?.tick || 0) - 12)
      ))
      .collect();

    const recentScandals = recentEvents
      .filter(e => e.title?.includes("Scandal") || e.description?.includes("affair"))
      .map(e => e.description || "A scandal occurred")
      .slice(0, 3);

    return {
      activeRomances,
      eligibleBachelors,
      eligibleMaidens,
      recentScandals,
    };
  },
});

// 6. Friendship Context
export const getFriendshipContext = internalQuery({
  args: { territoryId: v.id("territories") },
  handler: async (ctx, args) => {
    const friendships = await ctx.db
      .query("friendships")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", args.territoryId))
      .collect();

    const characters = await ctx.db
      .query("characters")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", args.territoryId))
      .filter((q: any) => q.eq(q.field("isAlive"), true))
      .collect();

    const charNames = new Map(characters.map(c => [c._id.toString(), c.name]));

    const notableFriendships = friendships
      .filter(f => f.friendshipType !== "acquaintance")
      .slice(0, 5)
      .map(f => ({
        character1: charNames.get(f.character1Id.toString()) || "Unknown",
        character2: charNames.get(f.character2Id.toString()) || "Unknown",
        type: f.friendshipType,
        sharedExperiences: f.sharedExperiences.slice(0, 2),
      }));

    const swornBrotherhoodsCount = friendships.filter(f => f.friendshipType === "sworn_brother").length;

    // Find isolated characters (no close friends)
    const characterIds = new Set(characters.map(c => c._id.toString()));
    const friendedIds = new Set<string>();
    for (const f of friendships) {
      if (f.friendshipType !== "acquaintance") {
        friendedIds.add(f.character1Id.toString());
        friendedIds.add(f.character2Id.toString());
      }
    }

    const isolatedCharacters = characters
      .filter(c => c.role !== "commoner" && !friendedIds.has(c._id.toString()))
      .map(c => c.name)
      .slice(0, 3);

    return {
      notableFriendships,
      swornBrotherhoodsCount,
      isolatedCharacters,
    };
  },
});

// 7. Mental Health Context
export const getMentalHealthContext = internalQuery({
  args: { territoryId: v.id("territories") },
  handler: async (ctx, args) => {
    const characters = await ctx.db
      .query("characters")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", args.territoryId))
      .filter((q: any) => q.eq(q.field("isAlive"), true))
      .collect();

    const troubledCharacters = characters
      .filter(c => c.mentalHealth && (
        c.mentalHealth.sanity < 60 ||
        c.mentalHealth.trauma > 40 ||
        c.mentalHealth.depression > 40 ||
        c.mentalHealth.ptsd ||
        c.mentalHealth.madness
      ))
      .map(c => ({
        name: c.name,
        role: c.role,
        issues: {
          sanity: c.mentalHealth?.sanity || 100,
          trauma: c.mentalHealth?.trauma || 0,
          depression: c.mentalHealth?.depression || 0,
          hasPTSD: c.mentalHealth?.ptsd || false,
          madnessType: c.mentalHealth?.madness,
        },
        needsTreatment: (c.mentalHealth?.sanity || 100) < 50 || (c.mentalHealth?.trauma || 0) > 60,
      }));

    // Check for healing sanctuary
    const buildings = await ctx.db
      .query("buildings")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", args.territoryId))
      .collect();
    const hasHealingSanctuary = buildings.some(b => b.buildingType === "healing_sanctuary");

    // Calculate average morale
    const territory = await ctx.db.get(args.territoryId);
    const averageMorale = territory?.happiness || 50;

    // Get recent traumas from events
    const world = await ctx.db.query("world").first();
    const recentEvents = await ctx.db
      .query("events")
      .filter((q: any) => q.and(
        q.eq(q.field("territoryId"), args.territoryId),
        q.gte(q.field("tick"), (world?.tick || 0) - 6)
      ))
      .collect();

    const recentTraumas = recentEvents
      .filter(e => e.severity === "critical" || e.type === "crisis")
      .map(e => e.title || "Crisis")
      .slice(0, 3);

    return {
      troubledCharacters,
      hasHealingSanctuary,
      averageMorale,
      recentTraumas,
    };
  },
});

// 8. Addiction Context
export const getAddictionContext = internalQuery({
  args: { territoryId: v.id("territories") },
  handler: async (ctx, args) => {
    const addictions = await ctx.db
      .query("addictions")
      .filter((q: any) => q.eq(q.field("territoryId"), args.territoryId))
      .collect();

    const characters = await ctx.db
      .query("characters")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", args.territoryId))
      .filter((q: any) => q.eq(q.field("isAlive"), true))
      .collect();

    const charNames = new Map(characters.map(c => [c._id.toString(), c.name]));
    const charRoles = new Map(characters.map(c => [c._id.toString(), c.role]));

    const addictedCharacters = addictions.map(a => ({
      name: charNames.get(a.characterId.toString()) || "Unknown",
      role: charRoles.get(a.characterId.toString()) || "unknown",
      addictionType: a.type,
      severity: a.severity,
      functionalityImpact: a.functionalityImpact,
      wealthDrain: a.wealthDrain,
    }));

    // Check for substances and prohibition
    const territory = await ctx.db.get(args.territoryId);
    const substancesAvailable = ["alcohol"]; // Base, always available
    if ((territory?.technology || 0) > 50) substancesAvailable.push("opium");

    return {
      addictedCharacters,
      substancesAvailable,
      hasProhibition: false, // Would need to check laws/edicts
    };
  },
});

// 9. War Demographics Context
export const getWarDemographicsContext = internalQuery({
  args: { territoryId: v.id("territories") },
  handler: async (ctx, args) => {
    const territory = await ctx.db.get(args.territoryId);
    if (!territory) return null;

    const fightingPop = territory.fightingPopulation || {
      eligibleMen: Math.floor(territory.population * 0.2),
      currentSoldiers: territory.military,
      reserves: 0,
      casualties: 0,
      widows: 0,
      orphans: 0,
    };

    const percentageOfPopulation = territory.population > 0
      ? Math.round((fightingPop.eligibleMen / territory.population) * 100)
      : 0;

    let manpowerStatus = "abundant";
    const soldierRatio = fightingPop.eligibleMen > 0
      ? fightingPop.currentSoldiers / fightingPop.eligibleMen
      : 1;

    if (soldierRatio > 0.8) manpowerStatus = "critical";
    else if (soldierRatio > 0.6) manpowerStatus = "strained";
    else if (soldierRatio > 0.4) manpowerStatus = "adequate";

    return {
      fightingPopulation: {
        eligibleMen: fightingPop.eligibleMen,
        currentSoldiers: fightingPop.currentSoldiers,
        reserves: fightingPop.reserves,
        percentageOfPopulation,
      },
      warCasualties: {
        recentDeaths: fightingPop.casualties,
        widows: fightingPop.widows,
        orphans: fightingPop.orphans,
        disabledVeterans: Math.floor(fightingPop.casualties * 0.3),
      },
      manpowerStatus,
      canConscriptMore: soldierRatio < 0.9,
    };
  },
});

// 10. Gender Context
export const getGenderContext = internalQuery({
  args: { territoryId: v.id("territories") },
  handler: async (ctx, args) => {
    const territory = await ctx.db.get(args.territoryId);
    if (!territory) return null;

    const genderRoles = territory.genderRoles || {
      womenCanWork: false,
      womenCanOwn: false,
      womenCanRule: false,
      womenCanFight: false,
      progressLevel: 10,
    };

    // Calculate workforce impact
    const characters = await ctx.db
      .query("characters")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", args.territoryId))
      .filter((q: any) => q.eq(q.field("isAlive"), true))
      .collect();

    const workingAgeMen = characters.filter(c => c.gender === "male" && (c.age || 20) >= 16 && (c.age || 20) < 60).length;
    const workingAgeWomen = characters.filter(c => c.gender === "female" && (c.age || 20) >= 16 && (c.age || 20) < 60).length;

    const currentLaborPool = genderRoles.womenCanWork ? workingAgeMen + workingAgeWomen : workingAgeMen;
    const potentialIfProgressive = workingAgeMen + workingAgeWomen;

    return {
      currentRoles: genderRoles,
      workforceImpact: {
        currentLaborPool,
        potentialIfProgressive,
        restrictionCost: potentialIfProgressive - currentLaborPool,
      },
      socialTension: genderRoles.progressLevel > 50 ? 20 : 0, // Tension from rapid change
    };
  },
});

// 11. Expedition Context
export const getExpeditionContext = internalQuery({
  args: { territoryId: v.id("territories") },
  handler: async (ctx, args) => {
    const expeditions = await ctx.db
      .query("expeditions")
      .withIndex("by_origin", (q: any) => q.eq("originTerritoryId", args.territoryId))
      .collect();

    const world = await ctx.db.query("world").first();
    const currentTick = world?.tick || 0;

    const characters = await ctx.db
      .query("characters")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", args.territoryId))
      .collect();
    const charNames = new Map(characters.map(c => [c._id.toString(), c.name]));

    const activeExpeditions = expeditions
      .filter(e => e.status !== "completed" && e.status !== "lost")
      .map(e => ({
        direction: e.targetDirection || "unknown",
        leaderName: e.leaderId ? charNames.get(e.leaderId.toString()) : undefined,
        explorerCount: e.explorerCount,
        soldierCount: e.soldierCount,
        status: e.status,
        daysUntilReturn: Math.max(0, e.expectedReturnTick - currentTick),
        discoveries: e.discoveries.map(d => d.description),
      }));

    // Determine unexplored directions (simplified)
    const exploredDirections = new Set(expeditions.map(e => e.targetDirection));
    const allDirections = ["north", "south", "east", "west", "overseas"];
    const unexploredDirections = allDirections.filter(d => !exploredDirections.has(d));

    const totalDiscoveries = expeditions.reduce((sum, e) => sum + e.discoveries.length, 0);

    return {
      activeExpeditions,
      unexploredDirections,
      totalDiscoveries,
    };
  },
});

// 12. Trade Context
export const getTradeContext = internalQuery({
  args: { territoryId: v.id("territories") },
  handler: async (ctx, args) => {
    const tradeRoutes = await ctx.db
      .query("tradeRoutes")
      .filter((q: any) => q.or(
        q.eq(q.field("territory1Id"), args.territoryId),
        q.eq(q.field("territory2Id"), args.territoryId)
      ))
      .collect();

    const territories = await ctx.db.query("territories").collect();
    const territoryNames = new Map(territories.map(t => [t._id.toString(), t.name]));

    const activeTradeRoutes = tradeRoutes.map(r => {
      const partnerId = r.territory1Id === args.territoryId ? r.territory2Id : r.territory1Id;
      return {
        partnerTerritory: territoryNames.get(partnerId.toString()) || "Unknown",
        goods: r.primaryGoods || "mixed",
        profitability: r.profitMargin || 20,
        isActive: r.isActive,
      };
    });

    // Get caravan info
    const caravans = await ctx.db
      .query("caravans")
      .filter((q: any) => q.or(
        q.eq(q.field("originTerritoryId"), args.territoryId),
        q.eq(q.field("destinationTerritoryId"), args.territoryId)
      ))
      .collect();

    const world = await ctx.db.query("world").first();
    const currentTick = world?.tick || 0;

    const inTransit = caravans.filter(c => c.status === "traveling").length;
    const recentArrivals = caravans.filter(c =>
      c.status === "arrived" && c.arrivalTick && c.arrivalTick > currentTick - 3
    ).length;
    const recentRaids = caravans.filter(c =>
      c.status === "raided" && c.arrivalTick && c.arrivalTick > currentTick - 6
    ).length;

    // Get market prices (from territory or defaults)
    const territory = await ctx.db.get(args.territoryId);
    const marketPrices = (territory as any)?.marketPrices || {
      food: 10,
      goods: 20,
      luxuries: 50,
    };

    return {
      activeTradeRoutes,
      caravans: { inTransit, recentArrivals, recentRaids },
      marketPrices: {
        food: marketPrices.food || 10,
        goods: marketPrices.goods || 20,
        luxuries: marketPrices.luxuries || 50,
        trend: "stable",
      },
    };
  },
});

// 13. Disease Context
export const getDiseaseContext = internalQuery({
  args: { territoryId: v.id("territories") },
  handler: async (ctx, args) => {
    const diseases = await ctx.db
      .query("diseases")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", args.territoryId))
      .collect();

    const activeOutbreaks = diseases
      .filter(d => d.status === "active" || d.status === "spreading")
      .map(d => ({
        diseaseName: d.diseaseName,
        severity: d.severity,
        infected: d.infected,
        deaths: d.deaths,
        spreadRate: d.spreadRate || 5,
      }));

    // Calculate disease risk
    const territory = await ctx.db.get(args.territoryId);
    let riskLevel = 10;
    const factors: string[] = [];

    if (territory) {
      if (territory.population > 200) {
        riskLevel += 15;
        factors.push("high population density");
      }
      if (territory.food < 30) {
        riskLevel += 20;
        factors.push("malnutrition");
      }
      if (territory.happiness < 40) {
        riskLevel += 10;
        factors.push("poor morale");
      }
    }

    // Check for quarantine
    const events = await ctx.db
      .query("events")
      .filter((q: any) => q.eq(q.field("territoryId"), args.territoryId))
      .collect();
    const quarantineActive = events.some(e =>
      e.title?.includes("Quarantine") && e.tick && e.tick > ((await ctx.db.query("world").first())?.tick || 0) - 6
    );

    // Count healers
    const characters = await ctx.db
      .query("characters")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", args.territoryId))
      .filter((q: any) => q.eq(q.field("isAlive"), true))
      .collect();
    const healerCount = characters.filter(c => c.profession === "healer" || c.profession === "physician").length;

    return {
      activeOutbreaks,
      diseaseRisk: {
        level: Math.min(100, riskLevel),
        factors,
      },
      quarantineActive,
      healerCount,
    };
  },
});

// 14. Rebellion Context
export const getRebellionContext = internalQuery({
  args: { territoryId: v.id("territories") },
  handler: async (ctx, args) => {
    const factions = await ctx.db
      .query("factions")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", args.territoryId))
      .collect();

    const factionUnrest = factions.map(f => ({
      factionName: f.name,
      unrestLevel: f.unrest || 0,
      demands: f.demands || [],
      willingness_to_revolt: f.unrest > 70 ? f.unrest : Math.max(0, f.unrest - 30),
    }));

    const rebellions = await ctx.db
      .query("rebellions")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", args.territoryId))
      .filter((q: any) => q.eq(q.field("status"), "active"))
      .collect();

    const activeRebellions = rebellions.map(r => ({
      factionName: r.factionName || "Rebels",
      strength: r.strength || 50,
      controlledAreas: r.controlledAreas || [],
    }));

    // Calculate overall stability
    const territory = await ctx.db.get(args.territoryId);
    let stability = 100;
    if (territory) {
      stability -= Math.max(0, 50 - territory.happiness);
      stability -= factions.reduce((sum, f) => sum + (f.unrest > 50 ? 10 : 0), 0);
      stability -= activeRebellions.length * 20;
    }

    // Get recent grievances from events
    const world = await ctx.db.query("world").first();
    const recentEvents = await ctx.db
      .query("events")
      .filter((q: any) => q.and(
        q.eq(q.field("territoryId"), args.territoryId),
        q.gte(q.field("tick"), (world?.tick || 0) - 6)
      ))
      .collect();

    const recentGrievances = recentEvents
      .filter(e => e.type === "crisis" || e.title?.includes("unrest"))
      .map(e => e.description || e.title || "Unknown grievance")
      .slice(0, 3);

    return {
      factionUnrest,
      activeRebellions,
      overallStability: Math.max(0, Math.min(100, stability)),
      recentGrievances,
    };
  },
});

// 15. Legitimacy Context
export const getLegitimacyContext = internalQuery({
  args: { territoryId: v.id("territories") },
  handler: async (ctx, args) => {
    const ruler = await ctx.db
      .query("characters")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", args.territoryId))
      .filter((q: any) => q.and(
        q.eq(q.field("role"), "ruler"),
        q.eq(q.field("isAlive"), true)
      ))
      .first();

    if (!ruler) {
      return {
        ruler: { name: "None", legitimacyScore: 0, popularSupport: 0, nobleSupport: 0, militarySupport: 0 },
        legitimacySources: [],
        threats: ["No ruler - power vacuum"],
        overthrowRisk: 90,
        recentActions: { positive: [], negative: [] },
      };
    }

    const legitimacy = ruler.legitimacy || {
      score: 50,
      popularTrust: 50,
      nobleLoyalty: 50,
      militaryLoyalty: 50,
      sources: ["birthright"],
    };

    // Calculate overthrow risk
    let overthrowRisk = 100 - legitimacy.score;
    const threats: string[] = [];

    if (legitimacy.popularTrust < 30) {
      overthrowRisk += 10;
      threats.push("popular unrest");
    }
    if (legitimacy.nobleLoyalty < 30) {
      overthrowRisk += 15;
      threats.push("noble conspiracy");
    }
    if (legitimacy.militaryLoyalty < 30) {
      overthrowRisk += 20;
      threats.push("military coup risk");
    }

    // Check for rival claimants
    const characters = await ctx.db
      .query("characters")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", args.territoryId))
      .filter((q: any) => q.eq(q.field("isAlive"), true))
      .collect();

    const rivalClaimants = characters.filter(c =>
      c.secretGoal === "claim_throne" || c.activePlots?.some((p: any) => p.plotType === "usurp")
    );
    if (rivalClaimants.length > 0) {
      threats.push(`${rivalClaimants.length} rival claimant(s)`);
      overthrowRisk += rivalClaimants.length * 10;
    }

    // Get recent actions from events
    const world = await ctx.db.query("world").first();
    const recentEvents = await ctx.db
      .query("events")
      .filter((q: any) => q.and(
        q.eq(q.field("territoryId"), args.territoryId),
        q.gte(q.field("tick"), (world?.tick || 0) - 6)
      ))
      .collect();

    const positiveActions = recentEvents
      .filter(e => e.severity === "positive")
      .map(e => e.title || "Good deed")
      .slice(0, 2);
    const negativeActions = recentEvents
      .filter(e => e.severity === "negative" || e.severity === "critical")
      .map(e => e.title || "Bad event")
      .slice(0, 2);

    return {
      ruler: {
        name: ruler.name,
        legitimacyScore: legitimacy.score,
        popularSupport: legitimacy.popularTrust,
        nobleSupport: legitimacy.nobleLoyalty,
        militarySupport: legitimacy.militaryLoyalty,
      },
      legitimacySources: legitimacy.sources || ["birthright"],
      threats,
      overthrowRisk: Math.min(100, Math.max(0, overthrowRisk)),
      recentActions: {
        positive: positiveActions,
        negative: negativeActions,
      },
    };
  },
});

// =============================================
// ECONOMY CONTEXT QUERY
// =============================================

export const getEconomyContext = internalQuery({
  args: { territoryId: v.id("territories") },
  handler: async (ctx, args) => {
    const treasury = await ctx.db
      .query("treasury")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", args.territoryId))
      .first();

    if (!treasury) return null;

    const taxPolicy = await ctx.db
      .query("taxPolicy")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", args.territoryId))
      .first();

    const loans = await ctx.db
      .query("loans")
      .withIndex("by_borrower", (q: any) => q.eq("borrowerTerritoryId", args.territoryId))
      .filter((q: any) => q.eq(q.field("status"), "active"))
      .collect();

    const laborMarket = await ctx.db
      .query("laborMarket")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", args.territoryId))
      .first();

    const banks = await ctx.db
      .query("banks")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", args.territoryId))
      .collect();

    const priceControls = await ctx.db
      .query("priceControls")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", args.territoryId))
      .filter((q: any) => q.eq(q.field("isActive"), true))
      .collect();

    // Calculate total wealth (in copper equivalent)
    const totalWealth = treasury.goldCoins * 1000 + treasury.silverCoins * 100 + treasury.copperCoins;

    // Determine economic health
    let economicHealth: "collapsing" | "struggling" | "stable" | "growing" | "booming" = "stable";
    if (treasury.inflationRate > 50 || treasury.totalDebt > totalWealth * 3) {
      economicHealth = "collapsing";
    } else if (treasury.inflationRate > 25 || treasury.lastMonthBalance < -30) {
      economicHealth = "struggling";
    } else if (treasury.lastMonthBalance > 50 && treasury.creditRating > 80) {
      economicHealth = "booming";
    } else if (treasury.lastMonthBalance > 20 && treasury.creditRating > 60) {
      economicHealth = "growing";
    }

    return {
      treasury: {
        goldCoins: treasury.goldCoins,
        silverCoins: treasury.silverCoins,
        copperCoins: treasury.copperCoins,
        totalWealth,
        totalDebt: treasury.totalDebt,
        creditRating: treasury.creditRating,
        inflationRate: treasury.inflationRate,
        debasementLevel: treasury.debasementLevel,
        economicPhase: treasury.economicPhase as "barter" | "commodity" | "coined" | "banking" | "paper" | "modern",
        lastMonthBalance: treasury.lastMonthBalance,
      },
      taxes: {
        landTaxRate: taxPolicy?.landTaxRate || 10,
        tradeTaxRate: taxPolicy?.tradeTaxRate || 5,
        pollTaxRate: taxPolicy?.pollTaxRate || 2,
        luxuryTaxRate: taxPolicy?.luxuryTaxRate || 15,
        collectionEfficiency: taxPolicy?.collectionEfficiency || 50,
        taxEvaders: taxPolicy?.taxEvaders || 10,
        happinessImpact: taxPolicy?.happinessImpact || -5,
      },
      laborMarket: {
        unskilledWage: laborMarket?.unskilledWage || 3,
        skilledWage: laborMarket?.skilledWage || 8,
        unemployment: laborMarket?.unemploymentRate || 10,
        workConditions: (laborMarket?.workConditions || "fair") as "harsh" | "poor" | "fair" | "good" | "excellent",
      },
      activeLoans: loans.map(l => ({
        lenderType: l.lenderType as "merchant" | "noble" | "temple" | "foreign" | "bank",
        amount: l.remainingAmount,
        interestRate: l.interestRate,
        monthsRemaining: l.termMonths - (l.monthsPaid || 0),
      })),
      economicHealth,
      bankCount: banks.length,
      priceControls: priceControls.map(pc => pc.resourceType),
    };
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
