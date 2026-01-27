import { internalMutation, query, MutationCtx } from "../_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "../_generated/dataModel";

// =============================================
// CHARACTER NAME GENERATION
// =============================================

const NAME_PREFIXES = [
  "Aelric", "Bjorn", "Cassius", "Draven", "Einar", "Fenris", "Godfrey", "Harald",
  "Ivar", "Jorah", "Kael", "Lucius", "Magnus", "Nikolai", "Odin", "Ragnar",
  "Sigurd", "Theron", "Ulric", "Viktor", "Wulfric", "Xander", "Yorick", "Zephyr",
  "Alaric", "Brennan", "Cedric", "Darius", "Edmund", "Felix", "Gareth", "Hector",
  "Aldara", "Brenna", "Cassandra", "Diana", "Elena", "Freya", "Gwendolyn", "Helena",
  "Isolde", "Jocelyn", "Kira", "Lyra", "Morgana", "Nadia", "Ophelia", "Priscilla",
  "Quinn", "Rowena", "Selena", "Thalia", "Una", "Vivienne", "Wren", "Yara", "Zara",
];

const TITLES = {
  ruler: ["King", "Queen", "Chief", "High Chief", "Lord Protector", "Emperor", "Empress", "Supreme Leader"],
  heir: ["Crown Prince", "Crown Princess", "Heir Apparent", "Prince", "Princess"],
  general: ["General", "War Chief", "Marshal", "Commander", "Warlord"],
  advisor: ["High Advisor", "Chancellor", "Vizier", "Sage", "Oracle", "Minister"],
  rival: ["Lord", "Lady", "Duke", "Duchess", "Count", "Countess"],
  rebel_leader: ["Rebel Leader", "Revolutionary", "Insurgent Chief", "Freedom Fighter"],
};

const DYNASTY_SUFFIXES = [
  "the Great", "the Wise", "the Bold", "the Cruel", "the Cunning", "the Just",
  "the Merciless", "the Peaceful", "the Conqueror", "the Builder", "the Pious",
  "the Magnificent", "the Terrible", "the Fearless", "the Shrewd",
];

// =============================================
// TRAIT GENERATION
// =============================================

function randomTrait(min: number = 20, max: number = 80): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomEmotionalState(): Doc<"characters">["emotionalState"] {
  return {
    hope: randomTrait(40, 70),
    fear: randomTrait(10, 40),
    shame: randomTrait(0, 20),
    despair: randomTrait(0, 20),
    contentment: randomTrait(40, 70),
    rage: randomTrait(0, 30),
  };
}

function generateTraits(role: string): Doc<"characters">["traits"] {
  const baseTraits = {
    ambition: randomTrait(),
    greed: randomTrait(),
    loyalty: randomTrait(),
    honor: randomTrait(),
    cruelty: randomTrait(10, 60),
    compassion: randomTrait(),
    cunning: randomTrait(),
    wisdom: randomTrait(),
    paranoia: randomTrait(10, 50),
    courage: randomTrait(),
    pride: randomTrait(),
    wrath: randomTrait(10, 50),
    charisma: randomTrait(),
    diplomacy: randomTrait(),
  };

  // Adjust traits based on role
  switch (role) {
    case "ruler":
      baseTraits.ambition = Math.min(100, baseTraits.ambition + 20);
      baseTraits.charisma = Math.min(100, baseTraits.charisma + 15);
      break;
    case "heir":
      baseTraits.pride = Math.min(100, baseTraits.pride + 15);
      break;
    case "general":
      baseTraits.courage = Math.min(100, baseTraits.courage + 25);
      baseTraits.wrath = Math.min(100, baseTraits.wrath + 15);
      break;
    case "advisor":
      baseTraits.wisdom = Math.min(100, baseTraits.wisdom + 20);
      baseTraits.cunning = Math.min(100, baseTraits.cunning + 15);
      break;
    case "rival":
      baseTraits.ambition = Math.min(100, baseTraits.ambition + 30);
      baseTraits.loyalty = Math.max(0, baseTraits.loyalty - 20);
      break;
    case "rebel_leader":
      baseTraits.courage = Math.min(100, baseTraits.courage + 20);
      baseTraits.loyalty = Math.max(0, baseTraits.loyalty - 30);
      baseTraits.ambition = Math.min(100, baseTraits.ambition + 25);
      break;
  }

  return baseTraits;
}

// =============================================
// SECRET GOAL GENERATION
// =============================================

type SecretGoal = "seize_throne" | "accumulate_wealth" | "revenge" | "protect_family" |
  "foreign_allegiance" | "religious_dominance" | "independence" | "glory" | "none";

function generateSecretGoal(role: string, traits: Doc<"characters">["traits"]): SecretGoal {
  // Probability weighted by traits
  if (role === "ruler") {
    return "none"; // Rulers already have power
  }

  if (traits.ambition > 70 && traits.loyalty < 40) {
    return Math.random() < 0.6 ? "seize_throne" : "independence";
  }

  if (traits.greed > 70) {
    return "accumulate_wealth";
  }

  if (traits.wrath > 60 && Math.random() < 0.3) {
    return "revenge";
  }

  if (traits.compassion > 70) {
    return "protect_family";
  }

  if (traits.pride > 70 && traits.courage > 60) {
    return "glory";
  }

  if (Math.random() < 0.5) {
    return "none";
  }

  const goals: SecretGoal[] = [
    "accumulate_wealth", "protect_family", "glory", "independence", "none"
  ];
  return goals[Math.floor(Math.random() * goals.length)];
}

// =============================================
// CHARACTER CREATION
// =============================================

type CharacterRole = "ruler" | "heir" | "general" | "advisor" | "rival" | "rebel_leader";

export async function createCharacterInternal(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  role: CharacterRole,
  tick: number,
  name?: string,
  dynastyName?: string,
  dynastyGeneration?: number
): Promise<Id<"characters">> {
  const characterName = name || NAME_PREFIXES[Math.floor(Math.random() * NAME_PREFIXES.length)];
  const titles = TITLES[role];
  const title = titles[Math.floor(Math.random() * titles.length)];
  const traits = generateTraits(role);
  const secretGoal = generateSecretGoal(role, traits);

  // Age varies by role
  let age = 30;
  switch (role) {
    case "ruler":
      age = Math.floor(Math.random() * 30) + 30; // 30-60
      break;
    case "heir":
      age = Math.floor(Math.random() * 15) + 15; // 15-30
      break;
    case "general":
      age = Math.floor(Math.random() * 20) + 35; // 35-55
      break;
    case "advisor":
      age = Math.floor(Math.random() * 25) + 40; // 40-65
      break;
    case "rival":
      age = Math.floor(Math.random() * 25) + 25; // 25-50
      break;
    case "rebel_leader":
      age = Math.floor(Math.random() * 20) + 25; // 25-45
      break;
  }

  const characterId = await ctx.db.insert("characters", {
    territoryId,
    name: characterName,
    title,
    role,
    birthTick: tick - (age * 12), // Convert years to ticks (months)
    isAlive: true,
    age,
    traits,
    emotionalState: randomEmotionalState(),
    secretGoal,
    relationships: [],
    activePlots: [],
    dynastyName,
    dynastyGeneration,
    coronationTick: role === "ruler" ? tick : undefined,
    deeds: [],
  });

  return characterId;
}

// Keep the internalMutation wrapper for external calls
export const createCharacter = internalMutation({
  args: {
    territoryId: v.id("territories"),
    role: v.union(
      v.literal("ruler"),
      v.literal("heir"),
      v.literal("general"),
      v.literal("advisor"),
      v.literal("rival"),
      v.literal("rebel_leader")
    ),
    name: v.optional(v.string()),
    tick: v.number(),
    dynastyName: v.optional(v.string()),
    dynastyGeneration: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return createCharacterInternal(
      ctx,
      args.territoryId,
      args.role,
      args.tick,
      args.name,
      args.dynastyName,
      args.dynastyGeneration
    );
  },
});

// =============================================
// CHARACTER LIFECYCLE
// =============================================

export async function processCharacterAging(
  ctx: MutationCtx,
  tick: number
): Promise<Array<{ type: string; characterId: Id<"characters">; description: string }>> {
  const characters = await ctx.db
    .query("characters")
    .withIndex("by_alive", (q) => q.eq("isAlive", true))
    .collect();

  const events: Array<{ type: string; characterId: Id<"characters">; description: string }> = [];

  for (const character of characters) {
    // Age characters (1 tick = 1 month, so every 12 ticks = 1 year)
    const newAge = Math.floor((tick - character.birthTick) / 12);

    if (newAge !== character.age) {
      await ctx.db.patch(character._id, { age: newAge });
    }

    // Natural death chance increases with age
    let deathChance = 0;
    if (newAge > 50) deathChance = (newAge - 50) * 0.005; // 0.5% per year over 50
    if (newAge > 70) deathChance += (newAge - 70) * 0.01; // Additional 1% per year over 70
    if (newAge > 85) deathChance += 0.15; // Very high at 85+

    if (Math.random() < deathChance) {
      const deathCauses = [
        "natural causes", "illness", "old age", "fever",
        "mysterious illness", "in their sleep"
      ];
      const deathCause = deathCauses[Math.floor(Math.random() * deathCauses.length)];

      await ctx.db.patch(character._id, {
        isAlive: false,
        deathTick: tick,
        deathCause,
      });

      events.push({
        type: "death",
        characterId: character._id,
        description: `${character.title} ${character.name} died of ${deathCause} at age ${newAge}.`,
      });
    }
  }

  return events;
}

// =============================================
// EMOTIONAL STATE UPDATES
// =============================================

export const updateEmotionalState = internalMutation({
  args: {
    characterId: v.id("characters"),
    changes: v.object({
      hope: v.optional(v.number()),
      fear: v.optional(v.number()),
      shame: v.optional(v.number()),
      despair: v.optional(v.number()),
      contentment: v.optional(v.number()),
      rage: v.optional(v.number()),
    }),
  },
  handler: async (ctx, args) => {
    const character = await ctx.db.get(args.characterId);
    if (!character) return;

    const newState = { ...character.emotionalState };

    for (const [key, delta] of Object.entries(args.changes)) {
      if (delta !== undefined) {
        const currentValue = newState[key as keyof typeof newState] || 50;
        newState[key as keyof typeof newState] = Math.max(0, Math.min(100, currentValue + delta));
      }
    }

    await ctx.db.patch(args.characterId, { emotionalState: newState });
  },
});

// =============================================
// PROSPERITY EFFECTS ON CHARACTERS
// =============================================

export async function applyCharacterProsperityEffects(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  prosperityTier: number,
  tick: number
): Promise<Array<{ type: string; description: string }>> {
  const characters = await ctx.db
    .query("characters")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .filter((q) => q.eq(q.field("isAlive"), true))
    .collect();

  const events: Array<{ type: string; description: string }> = [];

  for (const character of characters) {
    if (character.role === "ruler") continue; // Ruler is content

    // High prosperity breeds ambition in ambitious characters
    if (prosperityTier >= 3 && character.traits.ambition > 60) {
      // Prosperity makes ambitious characters think "I could do even better"
      const newEmotionalState = { ...character.emotionalState };

      // Increase hope (opportunity) but also fear of missing out
      newEmotionalState.hope = Math.min(100, newEmotionalState.hope + 5);

      // If already ambitious and cunning, they might start plotting
      if (character.traits.cunning > 50 && character.traits.loyalty < 50) {
        // Check if they're already plotting
        const hasPlot = character.activePlots.length > 0;

        if (!hasPlot && Math.random() < 0.1) {
          // Start a plot during prosperity (complacency breeds treachery)
          const newPlots = [...character.activePlots, {
            plotType: character.traits.greed > 60 ? "embezzlement" : "coup",
            startTick: tick,
            progressPercent: 5,
            discovered: false,
            conspirators: [],
          }];

          await ctx.db.patch(character._id, {
            activePlots: newPlots,
            emotionalState: newEmotionalState,
          });

          events.push({
            type: "plot_started",
            description: `${character.title} ${character.name} has begun scheming during the time of prosperity.`,
          });
        }
      }
    }

    // Golden age (tier 5) makes everyone complacent
    if (prosperityTier >= 4) {
      // Generals become soft
      if (character.role === "general" && Math.random() < 0.05) {
        const newTraits = { ...character.traits };
        newTraits.courage = Math.max(10, newTraits.courage - 2);
        await ctx.db.patch(character._id, { traits: newTraits });
      }

      // Advisors become corrupt
      if (character.role === "advisor" && character.traits.greed > 50 && Math.random() < 0.05) {
        const newTraits = { ...character.traits };
        newTraits.greed = Math.min(100, newTraits.greed + 3);
        newTraits.loyalty = Math.max(0, newTraits.loyalty - 2);
        await ctx.db.patch(character._id, { traits: newTraits });
      }
    }
  }

  return events;
}

// =============================================
// CHARACTER QUERIES
// =============================================

export const getCharactersByTerritory = query({
  args: { territoryId: v.id("territories") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("characters")
      .withIndex("by_territory", (q) => q.eq("territoryId", args.territoryId))
      .filter((q) => q.eq(q.field("isAlive"), true))
      .collect();
  },
});

export const getRuler = query({
  args: { territoryId: v.id("territories") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("characters")
      .withIndex("by_territory", (q) => q.eq("territoryId", args.territoryId))
      .filter((q) =>
        q.and(
          q.eq(q.field("isAlive"), true),
          q.eq(q.field("role"), "ruler")
        )
      )
      .first();
  },
});

export const getCharacterById = query({
  args: { characterId: v.id("characters") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.characterId);
  },
});

// =============================================
// TRAIT DESCRIPTION HELPERS
// =============================================

export function getTraitDescription(trait: string, value: number): string {
  const descriptions: Record<string, { low: string; mid: string; high: string }> = {
    ambition: {
      low: "content with their station",
      mid: "moderately ambitious",
      high: "burning with ambition",
    },
    greed: {
      low: "generous and content",
      mid: "practical about wealth",
      high: "consumed by greed",
    },
    loyalty: {
      low: "untrustworthy",
      mid: "pragmatic loyalty",
      high: "fiercely loyal",
    },
    honor: {
      low: "dishonorable",
      mid: "practical about honor",
      high: "bound by honor",
    },
    cruelty: {
      low: "merciful",
      mid: "pragmatic",
      high: "cruel and ruthless",
    },
    compassion: {
      low: "cold-hearted",
      mid: "practical compassion",
      high: "deeply compassionate",
    },
    cunning: {
      low: "simple and direct",
      mid: "reasonably shrewd",
      high: "masterfully cunning",
    },
    wisdom: {
      low: "foolish",
      mid: "reasonably wise",
      high: "profoundly wise",
    },
    paranoia: {
      low: "trusting",
      mid: "cautious",
      high: "deeply paranoid",
    },
    courage: {
      low: "cowardly",
      mid: "brave when needed",
      high: "fearlessly courageous",
    },
    pride: {
      low: "humble",
      mid: "appropriately proud",
      high: "consumed by pride",
    },
    wrath: {
      low: "peaceful",
      mid: "can be angered",
      high: "wrathful and vengeful",
    },
    charisma: {
      low: "off-putting",
      mid: "reasonably likable",
      high: "magnetically charismatic",
    },
    diplomacy: {
      low: "tactless",
      mid: "diplomatic when needed",
      high: "masterful diplomat",
    },
  };

  const desc = descriptions[trait];
  if (!desc) return "unknown";

  if (value < 35) return desc.low;
  if (value < 65) return desc.mid;
  return desc.high;
}

export function getEmotionalStateDescription(state: Doc<"characters">["emotionalState"]): string {
  const dominant: string[] = [];

  if (state.hope > 70) dominant.push("hopeful");
  if (state.fear > 70) dominant.push("fearful");
  if (state.shame > 50) dominant.push("ashamed");
  if (state.despair > 50) dominant.push("despairing");
  if (state.contentment > 70) dominant.push("content");
  if (state.rage > 60) dominant.push("angry");

  if (dominant.length === 0) {
    if (state.contentment > 50) return "stable";
    return "troubled";
  }

  return dominant.join(", ");
}

// =============================================
// RULER DEATH AND SUCCESSION
// =============================================

export const handleRulerDeath = internalMutation({
  args: {
    characterId: v.id("characters"),
    tick: v.number(),
    deathCause: v.string(),
  },
  handler: async (ctx, args) => {
    const ruler = await ctx.db.get(args.characterId);
    if (!ruler || ruler.role !== "ruler") return { success: false, error: "Not a ruler" };

    // Mark ruler as dead
    await ctx.db.patch(args.characterId, {
      isAlive: false,
      deathTick: args.tick,
      deathCause: args.deathCause,
    });

    // Calculate reign summary
    const yearsReigned = ruler.coronationTick
      ? Math.floor((args.tick - ruler.coronationTick) / 12)
      : 0;

    const obituary = `${ruler.title} ${ruler.name} ruled for ${yearsReigned} years before ${args.deathCause}.`;

    await ctx.db.patch(args.characterId, {
      reignSummary: {
        yearsReigned,
        warsStarted: 0, // TODO: Track these
        warsWon: 0,
        plotsSurvived: 0,
        advisorsExecuted: 0,
        obituary,
      },
    });

    // Find heir
    const heir = await ctx.db
      .query("characters")
      .withIndex("by_territory", (q) => q.eq("territoryId", ruler.territoryId))
      .filter((q) =>
        q.and(
          q.eq(q.field("isAlive"), true),
          q.eq(q.field("role"), "heir")
        )
      )
      .first();

    let successionType: "peaceful" | "coup" | "civil_war" | "election" = "peaceful";
    let newRulerId: Id<"characters"> | null = null;
    let plottersExecuted = 0;
    let civilWarCasualties: number | undefined;

    if (heir && heir.traits.loyalty > 50) {
      // Peaceful succession
      successionType = "peaceful";
      newRulerId = heir._id;

      // Promote heir to ruler
      await ctx.db.patch(heir._id, {
        role: "ruler",
        title: ruler.title, // Inherit title
        coronationTick: args.tick,
        dynastyGeneration: (ruler.dynastyGeneration || 1) + 1,
      });
    } else {
      // Check for ambitious characters who might seize power
      const candidates = await ctx.db
        .query("characters")
        .withIndex("by_territory", (q) => q.eq("territoryId", ruler.territoryId))
        .filter((q) => q.eq(q.field("isAlive"), true))
        .collect();

      const ambitiousCandidates = candidates.filter(
        (c) => c.traits.ambition > 60 && c._id !== args.characterId
      );

      if (ambitiousCandidates.length >= 2) {
        // Civil war between candidates
        successionType = "civil_war";
        civilWarCasualties = Math.floor(Math.random() * 1000) + 500;

        // The one with highest (courage + cunning + military experience) wins
        const winner = ambitiousCandidates.reduce((best, current) => {
          const bestScore = best.traits.courage + best.traits.cunning;
          const currentScore = current.traits.courage + current.traits.cunning;
          return currentScore > bestScore ? current : best;
        });

        newRulerId = winner._id;

        // Promote winner
        await ctx.db.patch(winner._id, {
          role: "ruler",
          title: "Lord Protector", // Not legitimate ruler
          coronationTick: args.tick,
        });

        // Kill some losers
        for (const loser of ambitiousCandidates) {
          if (loser._id !== winner._id && Math.random() < 0.5) {
            await ctx.db.patch(loser._id, {
              isAlive: false,
              deathTick: args.tick,
              deathCause: "killed in succession war",
            });
          }
        }
      } else if (ambitiousCandidates.length === 1) {
        // Single ambitious character seizes power
        successionType = "coup";
        newRulerId = ambitiousCandidates[0]._id;

        await ctx.db.patch(ambitiousCandidates[0]._id, {
          role: "ruler",
          title: "Usurper",
          coronationTick: args.tick,
        });
      } else if (heir) {
        // Heir exists but had low loyalty - contested succession
        successionType = "peaceful";
        newRulerId = heir._id;

        await ctx.db.patch(heir._id, {
          role: "ruler",
          title: ruler.title,
          coronationTick: args.tick,
          dynastyGeneration: (ruler.dynastyGeneration || 1) + 1,
        });
      } else {
        // No heir, create a new ruler
        newRulerId = await ctx.db.insert("characters", {
          territoryId: ruler.territoryId,
          name: NAME_PREFIXES[Math.floor(Math.random() * NAME_PREFIXES.length)],
          title: "Chief",
          role: "ruler",
          birthTick: args.tick - (35 * 12),
          isAlive: true,
          age: 35,
          traits: generateTraits("ruler"),
          emotionalState: randomEmotionalState(),
          secretGoal: "none",
          relationships: [],
          activePlots: [],
          coronationTick: args.tick,
          deeds: [],
        });
        successionType = "election";
      }
    }

    // Record succession event
    if (newRulerId) {
      const newRuler = await ctx.db.get(newRulerId);
      const narrative = buildSuccessionNarrative(
        ruler,
        newRuler!,
        successionType,
        args.deathCause,
        civilWarCasualties
      );

      await ctx.db.insert("successionEvents", {
        territoryId: ruler.territoryId,
        tick: args.tick,
        deceasedRulerId: args.characterId,
        newRulerId,
        successionType,
        plottersExecuted,
        civilWarCasualties,
        narrative,
      });
    }

    return {
      success: true,
      successionType,
      newRulerId,
      civilWarCasualties,
    };
  },
});

function buildSuccessionNarrative(
  oldRuler: Doc<"characters">,
  newRuler: Doc<"characters">,
  successionType: string,
  deathCause: string,
  civilWarCasualties?: number
): string {
  switch (successionType) {
    case "peaceful":
      return `Following the ${deathCause} of ${oldRuler.title} ${oldRuler.name}, ${newRuler.title} ${newRuler.name} ascended to power in a peaceful transition.`;
    case "coup":
      return `Upon learning of ${oldRuler.title} ${oldRuler.name}'s ${deathCause}, ${newRuler.name} seized power in a swift coup, declaring themselves ${newRuler.title}.`;
    case "civil_war":
      return `The ${deathCause} of ${oldRuler.title} ${oldRuler.name} sparked a bloody civil war. After ${civilWarCasualties} casualties, ${newRuler.name} emerged victorious as ${newRuler.title}.`;
    case "election":
      return `With no clear heir after ${oldRuler.title} ${oldRuler.name}'s ${deathCause}, the people chose ${newRuler.name} to lead them.`;
    default:
      return `${newRuler.title} ${newRuler.name} came to power following the ${deathCause} of ${oldRuler.title} ${oldRuler.name}.`;
  }
}

// =============================================
// ADD DEED TO CHARACTER
// =============================================

export const addDeed = internalMutation({
  args: {
    characterId: v.id("characters"),
    tick: v.number(),
    description: v.string(),
    type: v.string(),
  },
  handler: async (ctx, args) => {
    const character = await ctx.db.get(args.characterId);
    if (!character) return;

    const newDeeds = [...character.deeds, {
      tick: args.tick,
      description: args.description,
      type: args.type,
    }];

    // Keep only last 20 deeds
    if (newDeeds.length > 20) {
      newDeeds.shift();
    }

    await ctx.db.patch(args.characterId, { deeds: newDeeds });
  },
});
