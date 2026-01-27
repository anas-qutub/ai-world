"use node";

import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import { buildDecisionPrompt, AVAILABLE_ACTIONS } from "./prompts";
import { callAnthropic } from "./providers/anthropic";
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

    // Build the prompt
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
      otherTerritories
    );

    // Call the AI provider
    let decision;
    try {
      if (agent.provider === "anthropic") {
        decision = await callAnthropic(
          agent.model,
          agent.systemPrompt,
          userPrompt
        );
      } else {
        // For now, default to do_nothing for unimplemented providers
        decision = {
          action: "do_nothing",
          target: null,
          reasoning: `Provider ${agent.provider} not yet implemented`,
        };
      }
    } catch (error) {
      console.error("AI decision error:", error);
      decision = {
        action: "do_nothing",
        target: null,
        reasoning: "Error generating decision. Maintaining status quo.",
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
