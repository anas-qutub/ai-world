"use node";

import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import {
  buildDecisionPrompt, AVAILABLE_ACTIONS,
  EngagementContext, CharacterContext, TensionContext, RivalryContext, ProsperityContext,
  PersonalityParams, OrganicGrowthContext, MemoryContext, BondsContext, EmergentGoalContext,
  EspionageContext, ReligionContext, EducationContext, SabotageMotiveContext,
  // 15 new context types + economy
  WeatherContext, DisasterContext, InfrastructureContext, DynastyContext, RomanceContext,
  FriendshipContext, MentalHealthContext, AddictionContext, WarDemographicsContext, GenderContext,
  ExpeditionContext, TradeContext, DiseaseContext, RebellionContext, LegitimacyContext,
  EconomyContext
} from "./prompts";
import { callAnthropic, AIDecisionResponse } from "./providers/anthropic";
import { callOpenAI, isOpenAIAvailable } from "./providers/openai";
import { callXAI, isXAIAvailable } from "./providers/xai";
import { Doc, Id } from "../_generated/dataModel";

export const makeDecision = internalAction({
  args: {
    agentId: v.id("agents"),
    tick: v.number(),
  },
  handler: async (ctx, args): Promise<{
    territory: string;
    action: string;
    target: string | null;
    reasoning: string;
  }> => {
    // Get agent and territory
    const agent: Doc<"agents"> | null = await ctx.runQuery(internal.ai.helpers.getAgent, {
      agentId: args.agentId,
    });

    if (!agent) {
      throw new Error("Agent not found");
    }

    const territory: Doc<"territories"> | null = await ctx.runQuery(internal.ai.helpers.getTerritory, {
      territoryId: agent.territoryId,
    });

    if (!territory) {
      throw new Error("Territory not found");
    }

    // Get world context
    const world: Doc<"world"> | null = await ctx.runQuery(internal.ai.helpers.getWorld, {});
    if (!world) {
      throw new Error("World not found");
    }

    // Get relationships for this territory
    const relationships = await ctx.runQuery(
      internal.ai.helpers.getTerritoryRelationships,
      { territoryId: agent.territoryId }
    );

    // Get other territories
    const allTerritories: Doc<"territories">[] = await ctx.runQuery(
      internal.ai.helpers.getAllTerritories,
      {}
    );
    const otherTerritories = allTerritories
      .filter((t: Doc<"territories">) => t._id !== territory._id)
      .map((t: Doc<"territories">) => ({
        name: t.name,
        resources: t,
      }));

    // Get recent decisions
    const recentDecisions: Doc<"decisions">[] = await ctx.runQuery(
      internal.ai.helpers.getRecentDecisions,
      { territoryId: agent.territoryId, limit: 3 }
    );

    // =============================================
    // ENGAGEMENT CONTEXT - Characters, Tensions, Rivalries, Prosperity
    // =============================================

    // Fetch all engagement data in parallel
    const [characters, tensions, rivalries, prosperity, recentSuccession] = await Promise.all([
      ctx.runQuery(internal.ai.helpers.getTerritoryCharacters, { territoryId: agent.territoryId }),
      ctx.runQuery(internal.ai.helpers.getTerritoryTensions, { territoryId: agent.territoryId }),
      ctx.runQuery(internal.ai.helpers.getTerritoryRivalries, { territoryId: agent.territoryId }),
      ctx.runQuery(internal.ai.helpers.getTerritoryProsperity, { territoryId: agent.territoryId }),
      ctx.runQuery(internal.ai.helpers.getRecentSuccession, { territoryId: agent.territoryId, sinceTicksAgo: 12 }), // Last year
    ]);

    // Build engagement context
    let engagementContext: EngagementContext | undefined;

    if (characters && characters.length > 0) {
      // Transform characters to CharacterContext
      const transformCharacter = (char: Doc<"characters">): CharacterContext => ({
        id: char._id,
        name: char.name,
        title: char.title,
        role: char.role,
        age: char.age,
        traits: char.traits,
        emotionalState: char.emotionalState,
        secretGoal: char.secretGoal,
        isPlotting: char.activePlots.length > 0,
        plotType: char.activePlots.length > 0 ? char.activePlots[0].plotType : undefined,
        // Mental health data for madness-affected decisions
        mentalHealth: char.mentalHealth ? {
          sanity: char.mentalHealth.sanity,
          trauma: char.mentalHealth.trauma,
          depression: char.mentalHealth.depression,
          anxiety: char.mentalHealth.anxiety,
          ptsd: char.mentalHealth.ptsd,
          madness: char.mentalHealth.madness as "paranoid" | "megalomaniac" | "violent" | "delusional" | "depressive" | "manic" | undefined,
          inTherapy: char.mentalHealth.inTherapy,
        } : undefined,
        // Addiction data for impaired judgment
        addiction: char.hasAddiction && char.addictionType ? {
          type: char.addictionType as "alcohol" | "gambling" | "opium" | "other",
          severity: "moderate" as const, // Default - will be updated from addictions table if available
        } : undefined,
      });

      // Find ruler, heir, and other court members
      const ruler = characters.find((c: Doc<"characters">) => c.role === "ruler");
      const heir = characters.find((c: Doc<"characters">) => c.role === "heir");
      const courtMembers = characters.filter(
        (c: Doc<"characters">) => c.role !== "ruler" && c.role !== "heir"
      );

      // Count suspected plots
      const suspectedPlots = characters.reduce(
        (count: number, c: Doc<"characters">) => count + c.activePlots.filter((p: { discovered: boolean }) => p.discovered).length,
        0
      );

      // Build tension context
      let tensionContext: TensionContext | undefined;
      if (tensions) {
        tensionContext = {
          warLikelihood: tensions.warLikelihood,
          coupLikelihood: tensions.coupLikelihood,
          famineLikelihood: tensions.famineLikelihood,
          successionCrisisLikelihood: tensions.successionCrisisLikelihood,
          rebellionLikelihood: tensions.rebellionLikelihood,
          brewingConflicts: await Promise.all(
            tensions.brewingConflicts.map(async (conflict: { targetId: any; likelihood: number; reason: string }) => {
              const targetTerritory = await ctx.runQuery(internal.ai.helpers.getTerritory, {
                territoryId: conflict.targetId,
              });
              return {
                targetName: targetTerritory?.name || "Unknown",
                likelihood: conflict.likelihood,
                reason: conflict.reason,
              };
            })
          ),
        };
      }

      // Build rivalry contexts
      const rivalryContexts: RivalryContext[] = rivalries ? rivalries.map((r: any) => ({
        opponentName: r.opponentName,
        opponentTerritory: r.opponentTerritory,
        intensity: r.intensity,
        rivalryType: r.rivalryType,
        reasons: r.reasons.map((reason: { description: string }) => reason.description),
        isHereditary: r.isHereditary,
      })) : [];

      // Build prosperity context
      let prosperityContext: ProsperityContext | undefined;
      if (prosperity) {
        prosperityContext = {
          currentTier: prosperity.currentTier,
          tierName: prosperity.tierName,
          progressToNextTier: prosperity.progressToNextTier,
          ticksAtCurrentTier: prosperity.ticksAtCurrentTier,
          complacencyLevel: prosperity.complacencyLevel,
          decadenceLevel: prosperity.decadenceLevel,
          stabilityFactors: prosperity.stabilityFactors,
        };
      }

      engagementContext = {
        ruler: ruler ? transformCharacter(ruler) : undefined,
        heir: heir ? transformCharacter(heir) : undefined,
        courtMembers: courtMembers.map(transformCharacter),
        tensions: tensionContext,
        rivalries: rivalryContexts,
        prosperity: prosperityContext,
        suspectedPlots,
        recentSuccession: recentSuccession ? {
          type: recentSuccession.successionType,
          narrative: recentSuccession.narrative,
        } : undefined,
      };
    }

    // =============================================
    // ORGANIC AI GROWTH - Memories, Bonds, Goals
    // =============================================

    let organicGrowthContext: OrganicGrowthContext | undefined;

    // Fetch organic growth data and all context data in parallel
    const [
      agentMemories, agentBonds, agentGoals,
      espionageData, religionData, educationData, sabotageData,
      // 15 new context fetches + economy
      weatherData, disasterData, infrastructureData, dynastyData, romanceData,
      friendshipData, mentalHealthData, addictionData, warDemographicsData, genderData,
      expeditionData, tradeData, diseaseData, rebellionData, legitimacyData, economyData
    ] = await Promise.all([
      ctx.runQuery(internal.ai.helpers.getAgentMemories, { agentId: args.agentId, limit: 10 }),
      ctx.runQuery(internal.ai.helpers.getAgentBonds, { territoryId: agent.territoryId }),
      ctx.runQuery(internal.ai.helpers.getAgentGoals, { agentId: args.agentId }),
      ctx.runQuery(internal.ai.helpers.getEspionageContext, { territoryId: agent.territoryId }),
      ctx.runQuery(internal.ai.helpers.getReligionContext, { territoryId: agent.territoryId }),
      ctx.runQuery(internal.ai.helpers.getEducationContext, { territoryId: agent.territoryId }),
      ctx.runQuery(internal.ai.helpers.getSabotageContext, { territoryId: agent.territoryId }),
      // 15 new context queries + economy
      ctx.runQuery(internal.ai.helpers.getWeatherContext, { territoryId: agent.territoryId }),
      ctx.runQuery(internal.ai.helpers.getDisasterContext, { territoryId: agent.territoryId }),
      ctx.runQuery(internal.ai.helpers.getInfrastructureContext, { territoryId: agent.territoryId }),
      ctx.runQuery(internal.ai.helpers.getDynastyContext, { territoryId: agent.territoryId }),
      ctx.runQuery(internal.ai.helpers.getRomanceContext, { territoryId: agent.territoryId }),
      ctx.runQuery(internal.ai.helpers.getFriendshipContext, { territoryId: agent.territoryId }),
      ctx.runQuery(internal.ai.helpers.getMentalHealthContext, { territoryId: agent.territoryId }),
      ctx.runQuery(internal.ai.helpers.getAddictionContext, { territoryId: agent.territoryId }),
      ctx.runQuery(internal.ai.helpers.getWarDemographicsContext, { territoryId: agent.territoryId }),
      ctx.runQuery(internal.ai.helpers.getGenderContext, { territoryId: agent.territoryId }),
      ctx.runQuery(internal.ai.helpers.getExpeditionContext, { territoryId: agent.territoryId }),
      ctx.runQuery(internal.ai.helpers.getTradeContext, { territoryId: agent.territoryId }),
      ctx.runQuery(internal.ai.helpers.getDiseaseContext, { territoryId: agent.territoryId }),
      ctx.runQuery(internal.ai.helpers.getRebellionContext, { territoryId: agent.territoryId }),
      ctx.runQuery(internal.ai.helpers.getLegitimacyContext, { territoryId: agent.territoryId }),
      ctx.runQuery(internal.ai.helpers.getEconomyContext, { territoryId: agent.territoryId }),
    ]);

    // Build espionage context for military decisions
    let espionageContext: EspionageContext | undefined;
    if (espionageData) {
      espionageContext = {
        activeSpies: espionageData.activeSpies,
        capturedSpies: espionageData.capturedSpies,
        counterIntelligence: espionageData.counterIntelligence,
        intelligence: espionageData.intelligence,
        knownEnemySpies: espionageData.knownEnemySpies,
      };
    }

    // Build religion context for faith-influenced decisions
    let religionContext: ReligionContext | undefined;
    if (religionData) {
      religionContext = {
        stateReligion: religionData.stateReligion,
        rulerPiety: religionData.rulerPiety,
        templeCount: religionData.templeCount,
        priestCount: religionData.priestCount,
        averagePopulationPiety: religionData.averagePopulationPiety,
      };
    }

    // Build education context for workforce skill decisions
    let educationContext: EducationContext | undefined;
    if (educationData) {
      educationContext = {
        schools: educationData.schools,
        literacyRate: educationData.literacyRate,
        apprenticeCount: educationData.apprenticeCount,
        childrenInSchool: educationData.childrenInSchool,
        totalChildren: educationData.totalChildren,
        skilledWorkers: educationData.skilledWorkers,
        blockedActions: educationData.blockedActions,
      };
    }

    // Build sabotage motivation context for organic covert operations
    let sabotageContext: SabotageMotiveContext | undefined;
    if (sabotageData && sabotageData.pressure > 0) {
      sabotageContext = {
        pressure: sabotageData.pressure,
        topMotives: sabotageData.topMotives,
        suggestedTargets: sabotageData.suggestedTargets,
      };
    }

    // =============================================
    // BUILD ALL 15 NEW CONTEXT OBJECTS
    // =============================================

    // 1. Weather context
    let weatherContext: WeatherContext | undefined;
    if (weatherData) {
      weatherContext = weatherData as WeatherContext;
    }

    // 2. Disaster context
    let disasterContext: DisasterContext | undefined;
    if (disasterData) {
      disasterContext = disasterData as DisasterContext;
    }

    // 3. Infrastructure context
    let infrastructureContext: InfrastructureContext | undefined;
    if (infrastructureData) {
      infrastructureContext = infrastructureData as InfrastructureContext;
    }

    // 4. Dynasty context
    let dynastyContext: DynastyContext | undefined;
    if (dynastyData) {
      dynastyContext = dynastyData as DynastyContext;
    }

    // 5. Romance context
    let romanceContext: RomanceContext | undefined;
    if (romanceData) {
      romanceContext = romanceData as RomanceContext;
    }

    // 6. Friendship context
    let friendshipContext: FriendshipContext | undefined;
    if (friendshipData) {
      friendshipContext = friendshipData as FriendshipContext;
    }

    // 7. Mental health context
    let mentalHealthContext: MentalHealthContext | undefined;
    if (mentalHealthData) {
      mentalHealthContext = mentalHealthData as MentalHealthContext;
    }

    // 8. Addiction context
    let addictionContext: AddictionContext | undefined;
    if (addictionData) {
      addictionContext = addictionData as AddictionContext;
    }

    // 9. War demographics context
    let warDemographicsContext: WarDemographicsContext | undefined;
    if (warDemographicsData) {
      warDemographicsContext = warDemographicsData as WarDemographicsContext;
    }

    // 10. Gender context
    let genderContext: GenderContext | undefined;
    if (genderData) {
      genderContext = genderData as GenderContext;
    }

    // 11. Expedition context
    let expeditionContext: ExpeditionContext | undefined;
    if (expeditionData) {
      expeditionContext = expeditionData as ExpeditionContext;
    }

    // 12. Trade context
    let tradeContext: TradeContext | undefined;
    if (tradeData) {
      tradeContext = tradeData as TradeContext;
    }

    // 13. Disease context
    let diseaseContext: DiseaseContext | undefined;
    if (diseaseData) {
      diseaseContext = diseaseData as DiseaseContext;
    }

    // 14. Rebellion context
    let rebellionContext: RebellionContext | undefined;
    if (rebellionData) {
      rebellionContext = rebellionData as RebellionContext;
    }

    // 15. Legitimacy context
    let legitimacyContext: LegitimacyContext | undefined;
    if (legitimacyData) {
      legitimacyContext = legitimacyData as LegitimacyContext;
    }

    // 16. Economy context
    let economyContext: EconomyContext | undefined;
    if (economyData) {
      economyContext = economyData as EconomyContext;
    }

    // Build memory context
    let memoryContext: MemoryContext | undefined;
    if (agentMemories && agentMemories.length > 0) {
      const formattedMemories: string[] = [];
      const memoryDetails: MemoryContext["memories"] = [];

      for (const memory of agentMemories) {
        const ticksAgo = world.tick - memory.tick;
        const yearsAgo = Math.floor(ticksAgo / 12);
        const timeStr = yearsAgo > 0 ? `${yearsAgo} year${yearsAgo > 1 ? 's' : ''} ago` : `${ticksAgo} month${ticksAgo > 1 ? 's' : ''} ago`;

        // Get target territory name if applicable
        let targetName: string | undefined;
        if (memory.targetTerritoryId) {
          const targetTerritory = await ctx.runQuery(internal.ai.helpers.getTerritory, {
            territoryId: memory.targetTerritoryId,
          });
          targetName = targetTerritory?.name;
        }

        // Determine emotional intensity
        const intensity = Math.abs(memory.emotionalWeight);
        const isPositive = memory.emotionalWeight > 0;
        let emotionalDesc: string;
        if (intensity >= 80) emotionalDesc = isPositive ? "CHERISHED" : "TRAUMATIC";
        else if (intensity >= 60) emotionalDesc = isPositive ? "FOND" : "PAINFUL";
        else if (intensity >= 40) emotionalDesc = isPositive ? "Good" : "Bad";
        else emotionalDesc = "Fading";

        // Vividness based on salience
        const vividness = memory.salience >= 80 ? "VIVID" : memory.salience >= 50 ? "Clear" : "Fading";

        const typeLabel = memory.memoryType.toUpperCase().replace('_', ' ');
        formattedMemories.push(
          `- [${timeStr}] ${typeLabel}: "${memory.description}" (${emotionalDesc}, ${vividness})`
        );

        memoryDetails.push({
          type: memory.memoryType,
          description: memory.description,
          emotionalWeight: memory.emotionalWeight,
          salience: memory.salience,
          ticksAgo,
          targetTerritoryName: targetName,
        });
      }

      memoryContext = {
        memories: memoryDetails,
        formattedMemories: formattedMemories.join("\n"),
      };
    }

    // Build bonds context
    let bondsContext: BondsContext | undefined;
    if (agentBonds && agentBonds.length > 0) {
      const grudges: string[] = [];
      const gratitude: string[] = [];

      const positiveBondTypes = ["savior_debt", "gift_gratitude", "alliance_bond", "trade_bond", "honor_respect"];

      for (const bond of agentBonds) {
        if (bond.status === "forgotten") continue;

        // Get target territory name
        const targetTerritory = await ctx.runQuery(internal.ai.helpers.getTerritory, {
          territoryId: bond.toTerritoryId,
        });
        const targetName = targetTerritory?.name || "Unknown";

        const ticksAgo = world.tick - bond.originTick;
        const yearsAgo = Math.floor(ticksAgo / 12);
        const ageStr = yearsAgo > 0 ? `${yearsAgo} year${yearsAgo > 1 ? 's' : ''}` : "recent";

        // Intensity description
        let intensityDesc: string;
        if (bond.intensity >= 80) intensityDesc = "EXTREME";
        else if (bond.intensity >= 60) intensityDesc = "STRONG";
        else if (bond.intensity >= 40) intensityDesc = "MODERATE";
        else if (bond.intensity >= 20) intensityDesc = "WEAK";
        else intensityDesc = "FADING";

        const hereditaryNote = bond.isHereditary && bond.generationsPassed > 0
          ? ` [HEREDITARY - ${bond.generationsPassed} gen]`
          : bond.isHereditary ? " [HEREDITARY]" : "";

        const bondTypeName = bond.bondType.replace(/_/g, " ").toUpperCase();
        const line = `- ${targetName}: ${bondTypeName} (${intensityDesc}) - ${bond.originDescription} (${ageStr})${hereditaryNote}`;

        if (positiveBondTypes.includes(bond.bondType)) {
          gratitude.push(line);
        } else {
          grudges.push(line);
        }
      }

      bondsContext = {
        grudges: grudges.length > 0 ? grudges.join("\n") : "No active grudges.",
        gratitude: gratitude.length > 0 ? gratitude.join("\n") : "No debts of gratitude.",
      };
    }

    // Build goals context
    let goalsContext: EmergentGoalContext[] | undefined;
    if (agentGoals && agentGoals.length > 0) {
      goalsContext = agentGoals
        .filter((g: any) => g.status === "active")
        .map((g: any) => ({
          goalType: g.goalType,
          targetDescription: g.targetDescription,
          originReason: g.originReason,
          progress: g.progress,
          priority: g.priority,
        }));
    }

    // Combine into organic growth context
    if (memoryContext || bondsContext || (goalsContext && goalsContext.length > 0)) {
      organicGrowthContext = {
        memories: memoryContext,
        bonds: bondsContext,
        goals: goalsContext,
      };
    }

    // Build the prompt with personality parameters, organic growth context, and espionage intelligence
    const userPrompt = buildDecisionPrompt(
      territory,
      relationships.map((r: {
        otherTerritoryName?: string;
        trust: number;
        status: string;
        hasTradeAgreement: boolean;
        hasAlliance: boolean;
      }) => ({
        territoryName: r.otherTerritoryName || "Unknown",
        trust: r.trust,
        status: r.status,
        hasTradeAgreement: r.hasTradeAgreement,
        hasAlliance: r.hasAlliance,
      })),
      recentDecisions.map((d: Doc<"decisions">) => ({
        action: d.action,
        reasoning: d.reasoning,
        tick: d.tick,
      })),
      {
        year: world.year,
        month: world.month,
        tick: world.tick,
      },
      otherTerritories,
      engagementContext,
      agent.personalityParams as PersonalityParams | undefined,
      organicGrowthContext,
      undefined, // knowledgeContext - to be added later
      espionageContext, // spy intelligence for military decisions
      religionContext, // faith-based decision guidance
      educationContext, // education & skilled workers context
      sabotageContext, // organic sabotage motivations
      // 15 new context systems + economy
      weatherContext,
      disasterContext,
      infrastructureContext,
      dynastyContext,
      romanceContext,
      friendshipContext,
      mentalHealthContext,
      addictionContext,
      warDemographicsContext,
      genderContext,
      expeditionContext,
      tradeContext,
      diseaseContext,
      rebellionContext,
      legitimacyContext,
      economyContext
    );

    // Call the AI provider based on agent configuration
    let decision: AIDecisionResponse;
    try {
      switch (agent.provider) {
        case "anthropic":
          decision = await callAnthropic(
            agent.model,
            agent.systemPrompt,
            userPrompt
          );
          break;

        case "openai":
          if (isOpenAIAvailable()) {
            decision = await callOpenAI(
              agent.model,
              agent.systemPrompt,
              userPrompt
            );
          } else {
            // Fallback to Anthropic if OpenAI not configured
            console.log(`OpenAI not configured for ${territory.name}, falling back to Anthropic`);
            decision = await callAnthropic(
              "claude-sonnet-4-20250514",
              agent.systemPrompt,
              userPrompt
            );
          }
          break;

        case "xai":
          if (isXAIAvailable()) {
            decision = await callXAI(
              agent.model,
              agent.systemPrompt,
              userPrompt
            );
          } else {
            // Fallback to Anthropic if xAI not configured
            console.log(`xAI not configured for ${territory.name}, falling back to Anthropic`);
            decision = await callAnthropic(
              "claude-sonnet-4-20250514",
              agent.systemPrompt,
              userPrompt
            );
          }
          break;

        default:
          // Unknown provider, fall back to Anthropic
          decision = await callAnthropic(
            "claude-sonnet-4-20250514",
            agent.systemPrompt,
            userPrompt
          );
      }
    } catch (error) {
      console.error("AI decision error:", error);
      decision = {
        action: "rest",
        target: null,
        reasoning: "Error generating decision. The tribe rests while the elders deliberate.",
      };
    }

    // Validate the action - be flexible with matching
    const normalizeAction = (str: string) => str.toLowerCase().replace(/[\s_-]+/g, "_").trim();
    const normalizedInput = normalizeAction(decision.action);

    let validAction = AVAILABLE_ACTIONS.find((a) => a.id === decision.action);

    // If exact match fails, try normalized match
    if (!validAction) {
      validAction = AVAILABLE_ACTIONS.find((a) =>
        normalizeAction(a.id) === normalizedInput ||
        normalizeAction(a.name) === normalizedInput
      );
      if (validAction) {
        decision.action = validAction.id; // Use the correct ID
      }
    }

    if (!validAction) {
      console.log("Invalid action from AI:", decision.action, "- falling back to rest");
      decision.action = "rest"; // Default to rest instead of do_nothing
      decision.reasoning = decision.reasoning || "The tribe takes time to rest and recover.";
    }

    // Find target territory if needed
    let targetTerritoryId: Id<"territories"> | undefined = undefined;
    if (decision.target && validAction?.requiresTarget) {
      const targetTerritory = allTerritories.find(
        (t: Doc<"territories">) => t.name.toLowerCase() === decision.target?.toLowerCase()
      );
      if (targetTerritory) {
        targetTerritoryId = targetTerritory._id;
      }
    }

    // Record and apply the decision
    await ctx.runMutation(internal.ai.helpers.recordDecision, {
      territoryId: agent.territoryId,
      tick: args.tick,
      action: decision.action,
      targetTerritoryId,
      reasoning: decision.reasoning,
    });

    // Update agent's last decision time
    await ctx.runMutation(internal.ai.helpers.updateAgentLastDecision, {
      agentId: args.agentId,
    });

    return {
      territory: territory.name,
      action: decision.action,
      target: decision.target,
      reasoning: decision.reasoning,
    };
  },
});
