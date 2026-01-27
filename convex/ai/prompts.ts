import { Doc, Id } from "../_generated/dataModel";

// =============================================
// ENGAGEMENT SYSTEM - CHARACTER & INTRIGUE CONTEXT
// =============================================

export interface CharacterContext {
  id: Id<"characters">;
  name: string;
  title: string;
  role: string;
  age: number;
  traits: {
    ambition: number;
    greed: number;
    loyalty: number;
    honor: number;
    cruelty: number;
    compassion: number;
    cunning: number;
    wisdom: number;
    paranoia: number;
    courage: number;
    pride: number;
    wrath: number;
    charisma: number;
    diplomacy: number;
  };
  emotionalState: {
    hope: number;
    fear: number;
    shame: number;
    despair: number;
    contentment: number;
    rage: number;
  };
  secretGoal?: string;
  isPlotting: boolean;
  plotType?: string;
}

export interface TensionContext {
  warLikelihood: number;
  coupLikelihood: number;
  famineLikelihood: number;
  successionCrisisLikelihood: number;
  rebellionLikelihood: number;
  brewingConflicts: Array<{
    targetName: string;
    likelihood: number;
    reason: string;
  }>;
}

export interface RivalryContext {
  opponentName: string;
  opponentTerritory: string;
  intensity: number;
  rivalryType: string;
  reasons: string[];
  isHereditary: boolean;
}

export interface ProsperityContext {
  currentTier: number;
  tierName: string;
  progressToNextTier: number;
  ticksAtCurrentTier: number;
  complacencyLevel: number;
  decadenceLevel: number;
  stabilityFactors: {
    economicStability: number;
    socialHarmony: number;
    militaryReadiness: number;
    politicalUnity: number;
  };
}

export interface EngagementContext {
  ruler?: CharacterContext;
  heir?: CharacterContext;
  courtMembers: CharacterContext[];
  tensions?: TensionContext;
  rivalries: RivalryContext[];
  prosperity?: ProsperityContext;
  suspectedPlots: number;
  recentSuccession?: {
    type: string;
    narrative: string;
  };
}

export const AVAILABLE_ACTIONS = [
  // === SURVIVAL ACTIONS ===
  {
    id: "gather_food",
    name: "Gather Food",
    description: "Send your people to hunt, fish, or forage for food",
    effects: "+8 Food, +1 Knowledge (learning about the land)",
  },
  {
    id: "build_shelter",
    name: "Build Shelter",
    description: "Construct shelters and improve living conditions",
    effects: "+5 Happiness, +2 Wealth (assets)",
  },
  {
    id: "explore_land",
    name: "Explore the Land",
    description: "Send scouts to explore and map your territory",
    effects: "+4 Knowledge, +2 Influence (claiming territory)",
  },
  {
    id: "develop_tools",
    name: "Develop Tools",
    description: "Craft better tools and discover new techniques",
    effects: "+5 Technology, +2 Knowledge",
  },
  {
    id: "grow_community",
    name: "Grow the Community",
    description: "Focus on families, children, and expanding your tribe",
    effects: "+3 Population (over time), +2 Happiness",
  },
  {
    id: "train_warriors",
    name: "Train Warriors",
    description: "Prepare some members for defense and protection",
    effects: "+4 Military, -1 Food (feeding warriors)",
  },
  {
    id: "rest",
    name: "Rest and Recover",
    description: "Let your people rest, heal, and bond",
    effects: "+3 Happiness, +1 Food (conservation)",
  },

  // === CULTURE & IDENTITY ACTIONS ===
  {
    id: "create_culture",
    name: "Create Culture",
    description: "Develop language, stories, traditions, art, or design symbols/flags. FORMAT your reasoning to include: NEW WORDS like \"Kairu\" means \"hello\", TRADITIONS like \"The Harvest Dance: we celebrate with...\", FLAGS like \"Our flag shows...\", BELIEFS like \"We believe in...\"",
    effects: "+6 Influence, +3 Happiness, +2 Knowledge",
  },
  {
    id: "name_tribe",
    name: "Name Your People",
    description: "Give your tribe an official name and identity. Include the tribe name AND an origin story: \"We call ourselves the X. Our people came from...\"",
    effects: "+4 Influence, +3 Happiness. Provide the name clearly in your reasoning!",
  },

  // === GOVERNANCE ACTIONS ===
  {
    id: "establish_council",
    name: "Establish Elder Council",
    description: "Form a council of elders who make decisions together through discussion",
    effects: "Creates council governance. +3 Knowledge, +2 Happiness. Balanced but slow decisions.",
  },
  {
    id: "establish_chief",
    name: "Appoint a Chief",
    description: "Choose one person to lead the tribe. Name them in your reasoning!",
    effects: "Creates chiefdom. +3 Military, +2 Influence. Fast decisions, depends on leader quality.",
  },
  {
    id: "establish_democracy",
    name: "Establish Democracy",
    description: "All adults vote on major decisions. Create rules for how voting works.",
    effects: "Creates democracy. +5 Happiness, +3 Knowledge. Slow but people feel heard.",
  },
  {
    id: "establish_dictatorship",
    name: "Seize Power",
    description: "One person takes absolute control by force or manipulation. Name them!",
    effects: "Creates dictatorship. +5 Military, -5 Happiness. Very fast decisions, risk of rebellion.",
  },
  {
    id: "establish_theocracy",
    name: "Rule by Spiritual Leader",
    description: "A spiritual leader or shaman guides all decisions through faith/visions.",
    effects: "Creates theocracy. +4 Influence, +3 Happiness. Decisions guided by beliefs.",
  },
  {
    id: "change_government",
    name: "Reform Government",
    description: "Change your system of governance to something new. Describe the change!",
    effects: "Transition period: -2 Happiness temporarily. New system takes effect.",
  },

  // === DIPLOMACY ACTIONS ===
  {
    id: "send_scouts",
    name: "Send Scouts to Others",
    description: "Send people to observe or make contact with another tribe",
    effects: "Discover information, may improve or worsen relations",
    requiresTarget: true,
  },
  {
    id: "share_knowledge",
    name: "Share Knowledge",
    description: "Offer to teach another tribe something you've learned",
    effects: "+15 Trust with target, both gain +2 Knowledge",
    requiresTarget: true,
  },
  {
    id: "trade_goods",
    name: "Trade Goods",
    description: "Exchange resources with another tribe",
    effects: "Creates trade relationship, mutual benefits",
    requiresTarget: true,
  },
  {
    id: "show_strength",
    name: "Show Strength",
    description: "Display your warriors to intimidate or warn others",
    effects: "-10 Trust with target, may prevent conflict",
    requiresTarget: true,
  },
  {
    id: "raid",
    name: "Raid",
    description: "Attack another tribe to take their resources (risky!)",
    effects: "Potential gains but creates enemies, costs lives",
    requiresTarget: true,
  },

  // === WAR RESOLUTION ACTIONS ===
  {
    id: "propose_peace",
    name: "Propose Peace",
    description: "Offer to end hostilities with another tribe. May require concessions.",
    effects: "If accepted: War ends, relations improve. Describe what peace terms you offer.",
    requiresTarget: true,
  },
  {
    id: "accept_peace",
    name: "Accept Peace",
    description: "Accept a peace offer from another tribe that has proposed it.",
    effects: "War ends, relations become neutral. Both tribes can rebuild.",
    requiresTarget: true,
  },
  {
    id: "surrender",
    name: "Surrender",
    description: "Admit defeat and submit to another tribe. Humiliating but ends the conflict.",
    effects: "War ends. Lose wealth/influence, but save your people from more death.",
    requiresTarget: true,
  },
  {
    id: "demand_surrender",
    name: "Demand Surrender",
    description: "Demand that a weaker enemy surrenders to you.",
    effects: "If they're weak enough, they may surrender. May backfire if they're proud.",
    requiresTarget: true,
  },
  {
    id: "form_alliance",
    name: "Form Alliance",
    description: "Propose a formal alliance with a friendly tribe for mutual defense.",
    effects: "Creates alliance: +10 Military bonus, automatic trade, mutual protection.",
    requiresTarget: true,
  },

  // =============================================
  // DEEP SIMULATION - ECONOMY ACTIONS
  // =============================================
  {
    id: "build_farm",
    name: "Build Farm",
    description: "Construct agricultural infrastructure to produce food sustainably",
    effects: "Creates farm building. Produces food each tick based on workers assigned.",
  },
  {
    id: "build_mine",
    name: "Build Mine",
    description: "Construct a mine to extract valuable resources from the earth",
    effects: "Creates mine building. Requires mining technology. Extracts resources.",
  },
  {
    id: "build_workshop",
    name: "Build Workshop",
    description: "Construct a workshop to process raw materials into goods",
    effects: "Creates workshop. Converts raw resources into valuable tools/goods.",
  },
  {
    id: "build_market",
    name: "Build Market",
    description: "Construct a marketplace to facilitate trade and commerce",
    effects: "Creates market. Boosts trade income and wealth generation.",
  },
  {
    id: "set_tax_rate",
    name: "Adjust Taxation",
    description: "Modify the tax rate on your population and trade",
    effects: "Higher taxes = more wealth but less happiness. Lower taxes = happier people.",
  },
  {
    id: "prospect_resources",
    name: "Prospect for Resources",
    description: "Send scouts to discover new resource deposits in your territory",
    effects: "May discover new resource deposits (iron, gold, etc.). Based on knowledge.",
  },

  // =============================================
  // DEEP SIMULATION - TRADE ACTIONS
  // =============================================
  {
    id: "establish_trade_route",
    name: "Establish Trade Route",
    description: "Create a formal trade route with another territory",
    effects: "Enables sending caravans. Distance and risk depend on relationship.",
    requiresTarget: true,
  },
  {
    id: "send_caravan",
    name: "Send Trade Caravan",
    description: "Dispatch goods to another territory for profit",
    effects: "Sends goods to sell. Returns with wealth. Risk of raids on route.",
    requiresTarget: true,
  },
  {
    id: "raid_caravan",
    name: "Raid Enemy Caravans",
    description: "Attack caravans belonging to or traveling to an enemy",
    effects: "Steal goods and wealth. Damages relations. May fail if guarded.",
    requiresTarget: true,
  },
  {
    id: "patrol_routes",
    name: "Patrol Trade Routes",
    description: "Assign military to protect trade routes from bandits",
    effects: "Reduces risk of caravan loss. Uses military resources.",
  },

  // =============================================
  // DEEP SIMULATION - DEMOGRAPHICS ACTIONS
  // =============================================
  {
    id: "promote_births",
    name: "Promote Population Growth",
    description: "Encourage families to have more children through incentives",
    effects: "+20% birth rate. Requires adequate food and happiness.",
  },
  {
    id: "class_reform",
    name: "Reform Social Classes",
    description: "Change wealth distribution or rights between social classes",
    effects: "redistribute_wealth, expand_rights, or strengthen_hierarchy. Affects class happiness.",
  },
  {
    id: "appease_faction",
    name: "Appease Faction",
    description: "Reduce a faction's rebellion risk through gold, concessions, or promises",
    effects: "Lowers rebellion risk. Gold is fast but costly. Concessions give them power.",
  },
  {
    id: "suppress_faction",
    name: "Suppress Faction",
    description: "Use military force to crush a rebellious faction",
    effects: "Risky. If successful, reduces faction power. If failed, faction grows stronger.",
  },
  {
    id: "quarantine",
    name: "Declare Quarantine",
    description: "Close borders and trade routes to prevent disease spread",
    effects: "Reduces disease spread. Closes all trade routes. -10 happiness from isolation.",
  },

  // =============================================
  // DEEP SIMULATION - MILITARY ACTIONS
  // =============================================
  {
    id: "raise_militia",
    name: "Raise Militia",
    description: "Quickly conscript local civilians into a fighting force",
    effects: "Creates army quickly. Cheap but weak. Max 20% of population.",
  },
  {
    id: "recruit_soldiers",
    name: "Recruit Professional Soldiers",
    description: "Train and equip professional military units",
    effects: "Adds soldiers to army. Infantry, cavalry, or archers. Requires wealth.",
  },
  {
    id: "build_fortifications",
    name: "Build Fortifications",
    description: "Construct defensive walls and structures",
    effects: "Palisade -> Wooden Wall -> Stone Wall -> Castle. Increases defense.",
  },
  {
    id: "move_army",
    name: "Move Army",
    description: "Relocate an army to another territory",
    effects: "Army marches to new location. Consumes supplies. Takes time.",
    requiresTarget: true,
  },
  {
    id: "lay_siege",
    name: "Lay Siege",
    description: "Begin a siege against an enemy fortification",
    effects: "Gradually damages enemy defenses. Can assault once breached. Costly.",
    requiresTarget: true,
  },
  {
    id: "assault_walls",
    name: "Storm the Walls",
    description: "Launch a direct assault on enemy fortifications (risky!)",
    effects: "Attempt to capture immediately. High casualties even if successful.",
    requiresTarget: true,
  },
  {
    id: "supply_army",
    name: "Resupply Army",
    description: "Send supplies to reinforce a distant army",
    effects: "Restores army supplies. Costs food. Prevents desertion.",
  },

  // =============================================
  // DEEP SIMULATION - TECHNOLOGY ACTIONS
  // =============================================
  {
    id: "research_technology",
    name: "Research Technology",
    description: "Focus scholars on researching a new technology",
    effects: "Progress toward discovering new tech. Speed based on knowledge & academies.",
  },
  {
    id: "share_technology",
    name: "Share Technology with Ally",
    description: "Teach an allied territory one of your discovered technologies",
    effects: "Ally gains 50% research progress. Improves trust significantly.",
    requiresTarget: true,
  },
  {
    id: "steal_technology",
    name: "Steal Technology (Espionage)",
    description: "Attempt to steal technological secrets from another territory",
    effects: "If successful, gain their tech. Risk of discovery damages relations.",
    requiresTarget: true,
  },
  {
    id: "establish_academy",
    name: "Establish Academy",
    description: "Build a center of learning to accelerate research",
    effects: "Creates academy building. +research speed. Requires writing technology.",
  },

  // =============================================
  // ENGAGEMENT SYSTEM - CHARACTER & INTRIGUE ACTIONS
  // =============================================
  {
    id: "execute_character",
    name: "Execute Suspected Traitor",
    description: "Execute a court member suspected of plotting against you. They may be innocent!",
    effects: "Removes character. If innocent: -10 happiness, other characters fear you. If guilty: +5 stability.",
  },
  {
    id: "investigate_plot",
    name: "Investigate Suspected Plot",
    description: "Spend resources to uncover conspiracies in your court",
    effects: "May discover plots (chance based on your paranoia vs their cunning). Costs 5 wealth.",
  },
  {
    id: "bribe_character",
    name: "Bribe Court Member",
    description: "Pay off a potentially disloyal court member to secure their loyalty",
    effects: "Target loyalty +20, but greed +10. Costs 10 wealth. May backfire if they're too ambitious.",
  },
  {
    id: "arrange_marriage",
    name: "Arrange Political Marriage",
    description: "Marry your heir to another ruler's family for alliance",
    effects: "Creates or strengthens alliance. May reduce rivalry. Heir's loyalty may change.",
    requiresTarget: true,
  },
  {
    id: "name_heir",
    name: "Name Official Heir",
    description: "Designate an official successor to reduce succession crisis risk",
    effects: "-30% succession crisis likelihood. Other ambitious characters may start plotting.",
  },
  {
    id: "found_dynasty",
    name: "Found Dynasty",
    description: "Establish a named dynasty for your bloodline to build legacy",
    effects: "+10 influence. Enables inheritance tracking. Creates lasting legacy.",
  },
  {
    id: "purge_court",
    name: "Purge the Court",
    description: "Execute multiple suspected traitors at once (paranoid/desperate action)",
    effects: "Removes all characters with loyalty < 40. May kill innocents. -15 happiness, +fear.",
  },
  {
    id: "hold_feast",
    name: "Hold Grand Feast",
    description: "Host a celebration to improve morale and court loyalty",
    effects: "+5 happiness, +10 loyalty for all court. Costs 15 wealth, 10 food. Reduces tensions.",
  },
  {
    id: "address_decadence",
    name: "Address Decadence",
    description: "Implement austerity measures to combat corruption and excess",
    effects: "-20 decadence, -5 happiness (temporary). Reduces plot chances from prosperity.",
  },
  {
    id: "declare_vendetta",
    name: "Declare Vendetta",
    description: "Publicly declare a blood feud against a rival who wronged you",
    effects: "Creates hereditary rivalry. +10 military motivation vs target. Cannot make peace easily.",
    requiresTarget: true,
  },
  {
    id: "seek_reconciliation",
    name: "Seek Reconciliation",
    description: "Attempt to resolve a rivalry through diplomacy or compensation",
    effects: "May reduce rivalry intensity if both parties willing. Requires concessions.",
    requiresTarget: true,
  },
];

export interface RelationshipContext {
  territoryName: string;
  trust: number;
  status: string;
  hasTradeAgreement: boolean;
  hasAlliance: boolean;
}

export interface WorldContext {
  year: number;
  month: number;
  tick: number;
}

// =============================================
// ENGAGEMENT CONTEXT BUILDER
// =============================================

function getTraitDescription(value: number): string {
  if (value >= 90) return "Extreme";
  if (value >= 75) return "Very High";
  if (value >= 60) return "High";
  if (value >= 40) return "Moderate";
  if (value >= 25) return "Low";
  if (value >= 10) return "Very Low";
  return "Minimal";
}

function getEmotionalSummary(state: CharacterContext["emotionalState"]): string {
  const dominant: string[] = [];
  if (state.rage > 60) dominant.push("furious");
  if (state.fear > 60) dominant.push("fearful");
  if (state.despair > 60) dominant.push("despairing");
  if (state.shame > 60) dominant.push("ashamed");
  if (state.hope > 60) dominant.push("hopeful");
  if (state.contentment > 60) dominant.push("content");

  if (dominant.length === 0) {
    if (state.contentment > 40 && state.hope > 40) return "stable and calm";
    if (state.fear > 40 || state.despair > 40) return "uneasy";
    return "neutral";
  }
  return dominant.join(", ");
}

function getTopTraits(traits: CharacterContext["traits"]): string[] {
  const traitList = Object.entries(traits)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 3);

  return traitList.map(t => `${t.name} (${t.value})`);
}

function buildEngagementSection(context?: EngagementContext): string {
  if (!context) return "";

  const sections: string[] = [];

  // === YOUR RULER ===
  if (context.ruler) {
    const r = context.ruler;
    const topTraits = getTopTraits(r.traits);
    const mood = getEmotionalSummary(r.emotionalState);

    sections.push(`## Your Ruler: ${r.name} the ${r.title}

- **Age:** ${r.age} years old
- **Mood:** Currently ${mood}
- **Defining Traits:** ${topTraits.join(", ")}
- **Ambition:** ${getTraitDescription(r.traits.ambition)} (${r.traits.ambition})
- **Loyalty:** ${getTraitDescription(r.traits.loyalty)} (${r.traits.loyalty})
- **Cunning:** ${getTraitDescription(r.traits.cunning)} (${r.traits.cunning})
- **Paranoia:** ${getTraitDescription(r.traits.paranoia)} (${r.traits.paranoia})
${r.secretGoal && r.secretGoal !== "none" ? `- **Secret Desire:** ${formatSecretGoal(r.secretGoal)}` : ""}`);
  }

  // === HEIR ===
  if (context.heir) {
    const h = context.heir;
    const dangerLevel = h.traits.ambition > 70 && h.traits.loyalty < 40 ? "⚠️ DANGEROUS" :
                        h.traits.ambition > 50 && h.traits.loyalty < 50 ? "⚡ Watch closely" :
                        "Loyal";

    sections.push(`### Your Heir: ${h.name}
- **Age:** ${h.age} | **Loyalty:** ${h.traits.loyalty} | **Ambition:** ${h.traits.ambition}
- **Assessment:** ${dangerLevel}
${h.isPlotting ? `- ⚠️ **SUSPECTED OF PLOTTING** (${h.plotType})` : ""}`);
  }

  // === COURT INTRIGUE ===
  if (context.courtMembers.length > 0) {
    const suspiciousMembers = context.courtMembers.filter(
      m => m.traits.loyalty < 50 || m.traits.ambition > 60 || m.isPlotting
    );

    if (suspiciousMembers.length > 0 || context.suspectedPlots > 0) {
      let courtSection = `## Court Intrigue

**Suspected plots against you:** ${context.suspectedPlots}
`;

      for (const member of suspiciousMembers) {
        const warnings: string[] = [];
        if (member.traits.loyalty < 30) warnings.push("very disloyal");
        else if (member.traits.loyalty < 50) warnings.push("questionable loyalty");
        if (member.traits.ambition > 80) warnings.push("extremely ambitious");
        else if (member.traits.ambition > 60) warnings.push("ambitious");
        if (member.traits.greed > 70) warnings.push("greedy");
        if (member.isPlotting) warnings.push(`PLOTTING ${member.plotType?.toUpperCase()}`);

        if (warnings.length > 0) {
          courtSection += `
**${member.title} ${member.name}** (${member.role})
- Cunning: ${member.traits.cunning} | Loyalty: ${member.traits.loyalty} | Ambition: ${member.traits.ambition}
- ⚠️ Concerns: ${warnings.join(", ")}`;
        }
      }

      sections.push(courtSection);
    }
  }

  // === TENSIONS ===
  if (context.tensions) {
    const t = context.tensions;
    const highTensions: string[] = [];

    if (t.coupLikelihood > 40) highTensions.push(`Coup: ${t.coupLikelihood}%`);
    if (t.rebellionLikelihood > 40) highTensions.push(`Rebellion: ${t.rebellionLikelihood}%`);
    if (t.famineLikelihood > 40) highTensions.push(`Famine: ${t.famineLikelihood}%`);
    if (t.successionCrisisLikelihood > 40) highTensions.push(`Succession Crisis: ${t.successionCrisisLikelihood}%`);

    if (highTensions.length > 0 || t.brewingConflicts.length > 0) {
      let tensionSection = `## Tension Indicators

${highTensions.length > 0 ? `**Internal Threats:**
${highTensions.map(h => `- ${h}`).join("\n")}` : "Internal situation stable."}
`;

      if (t.brewingConflicts.length > 0) {
        tensionSection += `
**Brewing Conflicts:**
${t.brewingConflicts.map(c => `- War with ${c.targetName}: ${c.likelihood}% likely (${c.reason})`).join("\n")}`;
      }

      sections.push(tensionSection);
    }
  }

  // === RIVALRIES ===
  if (context.rivalries.length > 0) {
    const activeRivalries = context.rivalries.filter(r => r.intensity > 20);

    if (activeRivalries.length > 0) {
      let rivalrySection = `## Your Rivals & Feuds
`;
      for (const rivalry of activeRivalries) {
        const intensityDesc = rivalry.intensity >= 80 ? "🔥 BLOOD FEUD" :
                             rivalry.intensity >= 60 ? "⚔️ Bitter enemies" :
                             rivalry.intensity >= 40 ? "😠 Strong rivalry" :
                             "😤 Tension";

        rivalrySection += `
**${rivalry.opponentName}** of ${rivalry.opponentTerritory} - ${intensityDesc} (${rivalry.intensity}/100)
- Type: ${rivalry.rivalryType}${rivalry.isHereditary ? " (HEREDITARY - passes to heirs)" : ""}
- Causes: ${rivalry.reasons.slice(-2).join("; ")}`;
      }

      sections.push(rivalrySection);
    }
  }

  // === PROSPERITY ===
  if (context.prosperity) {
    const p = context.prosperity;
    const tierEmoji = ["😰", "😐", "🙂", "😊", "🌟", "👑"][p.currentTier] || "❓";

    let prosperitySection = `## Prosperity: ${tierEmoji} ${p.tierName} (Tier ${p.currentTier}/5)

- **Progress to next tier:** ${p.progressToNextTier}%
- **Time at current tier:** ${Math.floor(p.ticksAtCurrentTier / 12)} years`;

    if (p.complacencyLevel > 30 || p.decadenceLevel > 20) {
      prosperitySection += `

**⚠️ Warnings:**`;
      if (p.complacencyLevel > 30) {
        prosperitySection += `
- Complacency: ${p.complacencyLevel}/100 (${p.complacencyLevel > 60 ? "DANGEROUS - people grow lazy" : "Growing - watch for stagnation"})`;
      }
      if (p.decadenceLevel > 20) {
        prosperitySection += `
- Decadence: ${p.decadenceLevel}/100 (${p.decadenceLevel > 50 ? "CRITICAL - corruption breeds plots!" : "Rising - excess is taking hold"})`;
      }
    }

    // Stability factors
    const stability = p.stabilityFactors;
    const weakFactors: string[] = [];
    if (stability.economicStability < 40) weakFactors.push("Economy fragile");
    if (stability.socialHarmony < 40) weakFactors.push("Social unrest");
    if (stability.militaryReadiness < 40) weakFactors.push("Military weak");
    if (stability.politicalUnity < 40) weakFactors.push("Political division");

    if (weakFactors.length > 0) {
      prosperitySection += `
- **Weak points:** ${weakFactors.join(", ")}`;
    }

    sections.push(prosperitySection);
  }

  // === RECENT SUCCESSION ===
  if (context.recentSuccession) {
    sections.push(`## Recent Succession Event

**Type:** ${context.recentSuccession.type}
${context.recentSuccession.narrative}`);
  }

  return sections.length > 0 ? sections.join("\n\n") : "";
}

function formatSecretGoal(goal: string): string {
  const goalDescriptions: Record<string, string> = {
    seize_throne: "Covets the throne for themselves",
    accumulate_wealth: "Obsessed with amassing riches",
    revenge: "Seeks vengeance for past wrongs",
    protect_family: "Will do anything to protect their family",
    foreign_allegiance: "Secretly loyal to a foreign power",
    religious_dominance: "Wants to impose their faith",
    independence: "Dreams of breaking away",
    glory: "Craves personal glory and fame",
    none: "No hidden agenda",
  };
  return goalDescriptions[goal] || goal;
}

export function buildDecisionPrompt(
  territory: Doc<"territories">,
  relationships: RelationshipContext[],
  recentDecisions: Array<{ action: string; reasoning: string; tick: number }>,
  worldContext: WorldContext,
  otherTerritories: Array<{ name: string; resources: Doc<"territories"> }>,
  engagementContext?: EngagementContext
): string {
  const seasonNames = ["Early Spring", "Spring", "Late Spring", "Early Summer", "Summer", "Late Summer", "Early Autumn", "Autumn", "Late Autumn", "Early Winter", "Winter", "Late Winter"];
  const season = seasonNames[worldContext.month - 1];
  const year = worldContext.tick; // Each tick is a "moon" or month

  // Get governance and identity info
  const tribeName = (territory as any).tribeName || "unnamed tribe";
  const governance = (territory as any).governance || "none";
  const leaderName = (territory as any).leaderName;
  const governmentName = (territory as any).governmentName;
  const languageNotes = (territory as any).languageNotes;
  const languageWords = (territory as any).languageWords as Array<{word: string; meaning: string; type?: string}> | undefined;
  const flag = (territory as any).flag;
  const traditions = (territory as any).traditions as Array<{name: string; description: string}> | undefined;
  const originStory = (territory as any).originStory;
  const beliefs = (territory as any).beliefs;
  const naturalResources = (territory as any).naturalResources as string[] | undefined;

  const governanceDisplay = governance === "none"
    ? "No formal government (tribal/informal)"
    : `${governmentName || governance}${leaderName ? ` - Leader: ${leaderName}` : ""}`;

  const prompt = `
# The Story So Far

**Time:** ${season}, Year ${Math.floor(year / 12) + 1} (Moon ${year})

You are guiding your small tribe. Everything you build, every word you create, every tradition you establish - it all starts with you.

## Your People: ${tribeName !== "unnamed tribe" ? `The ${tribeName}` : "Your Tribe (not yet named)"}

- **Population:** ${territory.population} people
- **Government:** ${governanceDisplay}
- **Food Stores:** ${territory.food.toFixed(0)}/100 (${territory.food < 20 ? "CRITICAL - people may starve!" : territory.food < 40 ? "Low - need to gather more" : territory.food > 70 ? "Abundant" : "Adequate"})
- **Shelter/Wealth:** ${territory.wealth.toFixed(0)}/100
- **Tools/Technology:** ${territory.technology.toFixed(0)}/100
- **Warriors:** ${territory.military.toFixed(0)}/100
- **Morale:** ${territory.happiness.toFixed(0)}/100
- **Cultural Identity:** ${territory.influence.toFixed(0)}/100
- **Wisdom/Knowledge:** ${territory.knowledge.toFixed(0)}/100
${naturalResources && naturalResources.length > 0 ? `- **Natural Resources:** ${naturalResources.join(", ")} (unique to your land!)` : ""}

${tribeName !== "unnamed tribe" || languageWords?.length || flag || traditions?.length || beliefs ? `### Your Culture
${tribeName !== "unnamed tribe" ? `- **Name:** The ${tribeName}` : "- *Tribe not yet named*"}
${originStory ? `- **Origin:** ${originStory}` : ""}
${languageNotes ? `- **Language:** ${languageNotes}` : ""}
${languageWords && languageWords.length > 0 ? `- **Words we know:** ${languageWords.map(w => `"${w.word}" (${w.meaning})`).join(", ")}` : ""}
${flag ? `- **Flag/Symbol:** ${flag}` : ""}
${traditions && traditions.length > 0 ? `- **Traditions:** ${traditions.map(t => t.name).join(", ")}` : ""}
${beliefs ? `- **Beliefs:** ${beliefs}` : ""}
` : "*Your tribe has no established cultural identity yet. Consider naming your people and developing traditions!*"}

${buildEngagementSection(engagementContext)}

## Other Tribes (What You Know)

${otherTerritories.map(t => `**The people of ${t.name}:**
- About ${t.resources.population} people
- They seem ${t.resources.happiness > 60 ? "content" : t.resources.happiness > 40 ? "uncertain" : "troubled"}
- ${t.resources.military > territory.military ? "They appear stronger than us" : t.resources.military < territory.military ? "We are stronger than them" : "Similar strength to us"}
`).join("\n")}

## Relations with Other Tribes

${relationships.length > 0 ? relationships.map(r => {
  let statusInfo = r.status === "neutral" ? "Strangers" : r.status === "friendly" ? "Friendly" : r.status === "allied" ? "Close friends/allies (+10 military bonus each!)" : r.status === "tense" ? "Wary of each other" : r.status === "hostile" ? "Enemies" : r.status === "at_war" ? "AT WAR" : r.status;
  let extras = [];
  if (r.hasTradeAgreement) extras.push("Trading");
  if (r.hasAlliance) extras.push("Alliance (+military bonus)");
  // Note: pendingPeaceOffer info would need to be passed through - for now show war status
  return `**${r.territoryName}:**
- Feeling: ${getTrustDescription(r.trust)}
- Status: ${statusInfo}
${extras.length > 0 ? `- Agreements: ${extras.join(", ")}` : ""}`;
}).join("\n\n") : "You have not yet made contact with the other tribes."}

## Recent Events

${recentDecisions.length > 0 ? recentDecisions.map(d => `- Moon ${d.tick}: ${d.reasoning}`).join("\n") : "Your tribe has just formed. Everything begins now."}

# What Will You Do?

Available choices:

${AVAILABLE_ACTIONS.map(a => `**${a.name}** (${a.id})
${a.description}
→ ${a.effects}${(a as any).requiresTarget ? " [Must choose target: North America, Europe, Africa, Asia, South America, or Australia]" : ""}`).join("\n\n")}

# Your Response

Think about:
1. What does your tribe need most urgently?
2. What kind of culture and identity are you building?
3. How do you want to relate to other tribes?

BE CREATIVE in your reasoning! Use words from your developing language. Reference your tribe's name, beliefs, or traditions. Tell the story of your people.

Respond with ONLY a JSON object:
{
  "action": "action_id",
  "target": "territory_name or null",
  "reasoning": "A narrative explanation from your tribe's perspective. Be creative! Use your culture, language, beliefs."
}`;

  return prompt;
}

function getTrustDescription(trust: number): string {
  if (trust >= 75) return "Deep bond, like family";
  if (trust >= 50) return "Strong friendship";
  if (trust >= 25) return "Friendly, warming to each other";
  if (trust >= 0) return "Neutral, cautious";
  if (trust >= -25) return "Suspicious, uneasy";
  if (trust >= -50) return "Distrustful, tense";
  if (trust >= -75) return "Hostile, dangerous";
  return "Enemies, hatred";
}
