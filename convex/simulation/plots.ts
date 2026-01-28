import { internalMutation, query, MutationCtx } from "../_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "../_generated/dataModel";

// =============================================
// PLOT TYPES AND MECHANICS
// =============================================

export const PLOT_TYPES = {
  coup: {
    name: "Coup d'État",
    description: "Seize power from the current ruler",
    baseProgressRate: 8, // Per tick
    discoveryBaseChance: 0.03, // 3% per tick
    requiredProgress: 100,
    successEffects: "Plotter becomes ruler, old ruler dies or imprisoned",
    failureEffects: "Plotter executed or imprisoned",
  },
  assassination: {
    name: "Assassination",
    description: "Kill a specific target",
    baseProgressRate: 10,
    discoveryBaseChance: 0.04,
    requiredProgress: 100,
    successEffects: "Target dies",
    failureEffects: "Plotter may be caught and executed",
  },
  embezzlement: {
    name: "Embezzlement",
    description: "Secretly steal from the treasury",
    baseProgressRate: 12,
    discoveryBaseChance: 0.02,
    requiredProgress: 100,
    successEffects: "Plotter gains wealth, treasury loses",
    failureEffects: "Plotter caught, loses position, possible execution",
  },
  sabotage: {
    name: "Sabotage",
    description: "Undermine military or economy",
    baseProgressRate: 15,
    discoveryBaseChance: 0.02,
    requiredProgress: 100,
    successEffects: "Territory suffers setback",
    failureEffects: "Plotter caught",
  },
  defection: {
    name: "Defection",
    description: "Plan to switch allegiance to another territory",
    baseProgressRate: 6,
    discoveryBaseChance: 0.025,
    requiredProgress: 100,
    successEffects: "Character defects with secrets/forces",
    failureEffects: "Caught for treason",
  },
  rebellion: {
    name: "Rebellion",
    description: "Incite and lead a popular uprising",
    baseProgressRate: 5,
    discoveryBaseChance: 0.04,
    requiredProgress: 100,
    successEffects: "Rebellion starts with bonus strength",
    failureEffects: "Rebellion fails before starting",
  },
};

// =============================================
// PROCESS PLOTS EACH TICK
// =============================================

export async function processPlots(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  tick: number
): Promise<Array<{
  type: string;
  characterId: Id<"characters">;
  plotType: string;
  description: string;
  severity: "info" | "critical";
}>> {
  const characters = await ctx.db
    .query("characters")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .filter((q) => q.eq(q.field("isAlive"), true))
    .collect();

  const events: Array<{
    type: string;
    characterId: Id<"characters">;
    plotType: string;
    description: string;
    severity: "info" | "critical";
  }> = [];

  const ruler = characters.find((c) => c.role === "ruler");

  for (const character of characters) {
    if (character.activePlots.length === 0) continue;

    const updatedPlots: typeof character.activePlots = [];

    for (const plot of character.activePlots) {
      const plotConfig = PLOT_TYPES[plot.plotType as keyof typeof PLOT_TYPES];
      if (!plotConfig) {
        updatedPlots.push(plot);
        continue;
      }

      // Progress the plot
      let progressRate = plotConfig.baseProgressRate;

      // Cunning increases progress rate
      progressRate += Math.floor((character.traits.cunning - 50) / 10);

      // Conspirators help
      progressRate += plot.conspirators.length * 2;

      const newProgress = Math.min(100, plot.progressPercent + progressRate);

      // Check for discovery (if not already discovered)
      let discovered = plot.discovered;
      if (!discovered && ruler) {
        // Discovery chance based on ruler's paranoia and character's cunning
        let discoveryChance = plotConfig.discoveryBaseChance;
        discoveryChance += (ruler.traits.paranoia / 1000); // High paranoia = more detection
        discoveryChance -= (character.traits.cunning / 500); // High cunning = less detection

        // More conspirators = higher discovery chance
        discoveryChance += plot.conspirators.length * 0.01;

        if (Math.random() < discoveryChance) {
          discovered = true;
          events.push({
            type: "plot_discovered",
            characterId: character._id,
            plotType: plot.plotType,
            description: `${ruler.title} ${ruler.name}'s spies have uncovered a ${plotConfig.name.toLowerCase()} plot by ${character.title} ${character.name}!`,
            severity: "critical",
          });
        }
      }

      // Check if plot completes
      if (newProgress >= 100 && !discovered) {
        // Plot succeeds!
        const result = await executePlot(ctx, character, plot, ruler, tick);
        events.push({
          type: "plot_executed",
          characterId: character._id,
          plotType: plot.plotType,
          description: result.description,
          severity: "critical",
        });
        // Don't add to updated plots - it's done
      } else if (discovered && ruler && ruler.traits.cruelty > 50) {
        // Cruel ruler executes plotters immediately
        await ctx.db.patch(character._id, {
          isAlive: false,
          deathTick: tick,
          deathCause: `executed for ${plot.plotType}`,
        });
        events.push({
          type: "plotter_executed",
          characterId: character._id,
          plotType: plot.plotType,
          description: `${ruler.title} ${ruler.name} has executed ${character.name} for plotting ${plotConfig.name.toLowerCase()}.`,
          severity: "critical",
        });
      } else {
        // Update plot progress
        updatedPlots.push({
          ...plot,
          progressPercent: newProgress,
          discovered,
        });
      }
    }

    // Update character with remaining plots
    if (updatedPlots.length !== character.activePlots.length ||
        JSON.stringify(updatedPlots) !== JSON.stringify(character.activePlots)) {
      await ctx.db.patch(character._id, { activePlots: updatedPlots });
    }
  }

  return events;
}

// =============================================
// EXECUTE A COMPLETED PLOT
// =============================================

async function executePlot(
  ctx: any,
  plotter: Doc<"characters">,
  plot: Doc<"characters">["activePlots"][0],
  ruler: Doc<"characters"> | undefined,
  tick: number
): Promise<{ success: boolean; description: string }> {
  const plotConfig = PLOT_TYPES[plot.plotType as keyof typeof PLOT_TYPES];

  switch (plot.plotType) {
    case "coup": {
      if (!ruler) {
        return { success: false, description: "No ruler to overthrow" };
      }

      // Coup success chance based on plotter's traits vs ruler's
      let successChance = 0.5;
      successChance += (plotter.traits.cunning - ruler.traits.paranoia) / 200;
      successChance += (plotter.traits.courage - ruler.traits.courage) / 200;
      successChance += plot.conspirators.length * 0.1;

      if (Math.random() < successChance) {
        // Coup succeeds!
        const deathChance = plotter.traits.cruelty > 60 ? 0.8 : 0.4;
        const rulerDied = Math.random() < deathChance;

        if (rulerDied) {
          await ctx.db.patch(ruler._id, {
            isAlive: false,
            deathTick: tick,
            deathCause: "killed in coup",
            reignSummary: {
              yearsReigned: ruler.coronationTick ? Math.floor((tick - ruler.coronationTick) / 12) : 0,
              warsStarted: 0,
              warsWon: 0,
              plotsSurvived: 0,
              advisorsExecuted: 0,
              obituary: `${ruler.title} ${ruler.name} was overthrown and killed in a coup led by ${plotter.name}.`,
            },
          });
        } else {
          await ctx.db.patch(ruler._id, {
            role: "rival" as const,
            title: "Exile",
          });
        }

        // Plotter becomes ruler
        await ctx.db.patch(plotter._id, {
          role: "ruler",
          title: plotter.traits.honor > 50 ? "Lord Protector" : "Usurper",
          coronationTick: tick,
          activePlots: [],
        });

        // Record succession event
        await ctx.db.insert("successionEvents", {
          territoryId: plotter.territoryId,
          tick,
          deceasedRulerId: ruler._id,
          newRulerId: plotter._id,
          successionType: "coup",
          plottersExecuted: 0,
          narrative: `${plotter.name} successfully overthrew ${ruler.title} ${ruler.name} in a carefully planned coup.`,
        });

        return {
          success: true,
          description: `${plotter.name} has overthrown ${ruler.title} ${ruler.name} in a successful coup! ${rulerDied ? "The former ruler is dead." : "The former ruler has fled into exile."}`,
        };
      } else {
        // Coup fails
        await ctx.db.patch(plotter._id, {
          isAlive: false,
          deathTick: tick,
          deathCause: "executed for failed coup",
        });
        return {
          success: false,
          description: `${plotter.name}'s coup attempt has failed! They have been captured and executed.`,
        };
      }
    }

    case "assassination": {
      const target = plot.targetId ? await ctx.db.get(plot.targetId) : ruler;
      if (!target || !target.isAlive) {
        return { success: false, description: "Target not available" };
      }

      // Assassination success
      let successChance = 0.6;
      successChance += plotter.traits.cunning / 200;
      successChance -= target.traits.paranoia / 200;

      if (Math.random() < successChance) {
        await ctx.db.patch(target._id, {
          isAlive: false,
          deathTick: tick,
          deathCause: "assassinated",
        });

        // Add to plotter's deeds
        const newDeeds = [...plotter.deeds, {
          tick,
          description: `Orchestrated the assassination of ${target.title} ${target.name}`,
          type: "villainous",
        }];
        await ctx.db.patch(plotter._id, { deeds: newDeeds, activePlots: [] });

        return {
          success: true,
          description: `${target.title} ${target.name} has been assassinated! The killer remains unknown.`,
        };
      } else {
        // Assassination fails, plotter might be caught
        if (Math.random() < 0.5) {
          await ctx.db.patch(plotter._id, {
            isAlive: false,
            deathTick: tick,
            deathCause: "killed during failed assassination",
          });
          return {
            success: false,
            description: `An assassination attempt on ${target.title} ${target.name} has failed! The assassin, ${plotter.name}, was killed.`,
          };
        }
        return {
          success: false,
          description: `An assassination attempt on ${target.title} ${target.name} has failed! The assassin escaped.`,
        };
      }
    }

    case "embezzlement": {
      // Get territory to steal from
      const territory = await ctx.db.get(plotter.territoryId);
      if (!territory) {
        return { success: false, description: "No territory to embezzle from" };
      }

      const stolen = Math.floor(Math.random() * 10) + 5;
      await ctx.db.patch(territory._id, {
        wealth: Math.max(0, territory.wealth - stolen),
      });

      // Update plotter's greed
      const newTraits = { ...plotter.traits };
      newTraits.greed = Math.min(100, newTraits.greed + 5);
      await ctx.db.patch(plotter._id, { traits: newTraits, activePlots: [] });

      return {
        success: true,
        description: `${plotter.title} ${plotter.name} has been secretly embezzling from the treasury.`,
      };
    }

    case "sabotage": {
      const territory = await ctx.db.get(plotter.territoryId);
      if (!territory) {
        return { success: false, description: "No territory to sabotage" };
      }

      // Random sabotage effect
      const effects = ["military", "food", "technology"];
      const targetStat = effects[Math.floor(Math.random() * effects.length)];
      const damage = Math.floor(Math.random() * 10) + 5;

      await ctx.db.patch(territory._id, {
        [targetStat]: Math.max(0, (territory as any)[targetStat] - damage),
      });

      await ctx.db.patch(plotter._id, { activePlots: [] });

      return {
        success: true,
        description: `Mysterious sabotage has damaged the ${targetStat} of the realm!`,
      };
    }

    case "defection": {
      // Mark character as wanting to defect - actual defection handled elsewhere
      await ctx.db.patch(plotter._id, {
        secretGoal: "foreign_allegiance" as const,
        activePlots: [],
      });

      return {
        success: true,
        description: `${plotter.title} ${plotter.name} has prepared to defect to a foreign power.`,
      };
    }

    case "rebellion": {
      // Start a rebellion with bonus strength
      const territory = await ctx.db.get(plotter.territoryId);
      if (!territory) {
        return { success: false, description: "No territory for rebellion" };
      }

      // Create a faction for the rebellion
      const factionId = await ctx.db.insert("factions", {
        territoryId: plotter.territoryId,
        name: `${plotter.name}'s Rebels`,
        type: "political",
        ideology: "overthrow the current regime",
        power: 30 + Math.floor(plotter.traits.charisma / 3),
        happiness: 20,
        rebellionRisk: 100,
        memberCount: Math.floor(territory.population * 0.1),
        leaderId: plotter.name,
        foundedAtTick: tick,
      });

      // Start the rebellion
      await ctx.db.insert("rebellions", {
        territoryId: plotter.territoryId,
        factionId,
        startedAtTick: tick,
        strength: 40 + Math.floor(plotter.traits.courage / 3) + Math.floor(plotter.traits.charisma / 3),
        demands: "Overthrow the current ruler",
        status: "active",
      });

      // Update plotter
      await ctx.db.patch(plotter._id, {
        role: "rebel_leader",
        title: "Rebel Leader",
        activePlots: [],
      });

      return {
        success: true,
        description: `${plotter.name} has raised the banner of rebellion! The people rise against their rulers!`,
      };
    }

    default:
      return { success: false, description: "Unknown plot type" };
  }
}

// =============================================
// START A NEW PLOT
// =============================================

export const startPlot = internalMutation({
  args: {
    characterId: v.id("characters"),
    plotType: v.string(),
    targetId: v.optional(v.id("characters")),
    tick: v.number(),
  },
  handler: async (ctx, args) => {
    const character = await ctx.db.get(args.characterId);
    if (!character || !character.isAlive) {
      return { success: false, error: "Character not available" };
    }

    // Check if already plotting
    const existingPlot = character.activePlots.find((p) => p.plotType === args.plotType);
    if (existingPlot) {
      return { success: false, error: "Already plotting this" };
    }

    const newPlot = {
      plotType: args.plotType,
      targetId: args.targetId,
      startTick: args.tick,
      progressPercent: 0,
      discovered: false,
      conspirators: [] as Id<"characters">[],
    };

    await ctx.db.patch(args.characterId, {
      activePlots: [...character.activePlots, newPlot],
    });

    return { success: true };
  },
});

// =============================================
// JOIN AN EXISTING PLOT
// =============================================

export const joinPlot = internalMutation({
  args: {
    characterId: v.id("characters"),
    plotterCharacterId: v.id("characters"),
    plotType: v.string(),
  },
  handler: async (ctx, args) => {
    const plotter = await ctx.db.get(args.plotterCharacterId);
    const joiner = await ctx.db.get(args.characterId);

    if (!plotter || !joiner || !plotter.isAlive || !joiner.isAlive) {
      return { success: false, error: "Characters not available" };
    }

    const plotIndex = plotter.activePlots.findIndex((p) => p.plotType === args.plotType);
    if (plotIndex === -1) {
      return { success: false, error: "Plot not found" };
    }

    const updatedPlots = [...plotter.activePlots];
    if (!updatedPlots[plotIndex].conspirators.includes(args.characterId)) {
      updatedPlots[plotIndex].conspirators.push(args.characterId);
    }

    await ctx.db.patch(args.plotterCharacterId, { activePlots: updatedPlots });

    return { success: true };
  },
});

// =============================================
// CHECK IF CHARACTER SHOULD START PLOTTING
// =============================================

export async function checkPlotOpportunities(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  tick: number,
  prosperityTier: number,
  decadenceLevel: number
): Promise<string[]> {
  const characters = await ctx.db
    .query("characters")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .filter((q) =>
      q.and(
        q.eq(q.field("isAlive"), true),
        q.neq(q.field("role"), "ruler")
      )
    )
    .collect();

  const events: string[] = [];

  for (const character of characters) {
    // Skip if already plotting
    if (character.activePlots.length > 0) continue;

    // Base chance to start plotting
    let plotChance = 0;

    // High ambition + low loyalty = high plot chance
    plotChance += (character.traits.ambition - 50) / 200;
    plotChance -= (character.traits.loyalty - 50) / 200;

    // Prosperity breeds complacency and plotting
    plotChance += prosperityTier * 0.02;

    // Decadence increases plot chance
    plotChance += decadenceLevel / 500;

    // High greed increases embezzlement chance
    if (character.traits.greed > 70) {
      plotChance += 0.05;
    }

    // INTERCONNECTION: Addiction makes characters vulnerable to manipulation
    // Addicts are more desperate, easier to bribe, and may embezzle to fund habits
    if (character.hasAddiction && character.addictionId) {
      const addiction = await ctx.db.get(character.addictionId);
      if (addiction) {
        const addictionMultipliers: Record<string, number> = {
          mild: 0.02,
          moderate: 0.05,
          severe: 0.10,
          crippling: 0.20,
        };
        plotChance += addictionMultipliers[addiction.severity] || 0;

        // Gambling addicts especially likely to embezzle
        if (addiction.type === "gambling") {
          plotChance += 0.03;
        }
      }
    }

    // Secret goals increase specific plot chances
    if (character.secretGoal === "seize_throne") {
      plotChance += 0.1;
    }

    if (Math.random() < plotChance) {
      // Determine plot type based on traits
      let plotType: string;

      if (character.secretGoal === "seize_throne" || (character.traits.ambition > 70 && character.traits.courage > 50)) {
        plotType = "coup";
      } else if (character.traits.greed > 70) {
        plotType = "embezzlement";
      } else if (character.traits.wrath > 60 && character.emotionalState.rage > 50) {
        plotType = "assassination";
      } else if (character.traits.loyalty < 30) {
        plotType = "defection";
      } else {
        plotType = "sabotage";
      }

      // Start the plot
      await ctx.db.patch(character._id, {
        activePlots: [{
          plotType,
          startTick: tick,
          progressPercent: 0,
          discovered: false,
          conspirators: [],
        }],
      });

      events.push(`${character.title} ${character.name} has begun plotting ${plotType}...`);
    }
  }

  return events;
}

// =============================================
// QUERIES
// =============================================

export const getActivePlots = query({
  args: { territoryId: v.id("territories") },
  handler: async (ctx, args) => {
    const characters = await ctx.db
      .query("characters")
      .withIndex("by_territory", (q) => q.eq("territoryId", args.territoryId))
      .filter((q) => q.eq(q.field("isAlive"), true))
      .collect();

    const plots: Array<{
      characterId: Id<"characters">;
      characterName: string;
      plotType: string;
      progress: number;
      discovered: boolean;
    }> = [];

    for (const character of characters) {
      for (const plot of character.activePlots) {
        plots.push({
          characterId: character._id,
          characterName: character.name,
          plotType: plot.plotType,
          progress: plot.progressPercent,
          discovered: plot.discovered,
        });
      }
    }

    return plots;
  },
});
