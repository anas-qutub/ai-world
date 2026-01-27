import { internalMutation, query, MutationCtx } from "../_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "../_generated/dataModel";

// =============================================
// GENERATE YEARLY CHRONICLE
// =============================================

export async function generateYearlyChronicle(
  ctx: MutationCtx,
  year: number,
  startTick: number,
  endTick: number
): Promise<{
  year: number;
  globalSummary: string;
  majorEventsCount: number;
  rulerChangesCount: number;
  warsCount: number;
}> {
  const territories = await ctx.db.query("territories").collect();

  // Get all events from this year
  const events = await ctx.db
    .query("events")
    .withIndex("by_tick")
    .filter((q) =>
      q.and(
        q.gte(q.field("tick"), startTick),
        q.lte(q.field("tick"), endTick)
      )
    )
    .collect();

  // Get wars that were active this year
  const wars = await ctx.db.query("wars").collect();
  const yearWars = wars.filter((w) =>
    (w.startTick <= endTick) &&
    (!w.endTick || w.endTick >= startTick)
  );

  // Get succession events from this year
  const successionEvents = await ctx.db
    .query("successionEvents")
    .withIndex("by_tick")
    .filter((q) =>
      q.and(
        q.gte(q.field("tick"), startTick),
        q.lte(q.field("tick"), endTick)
      )
    )
    .collect();

  // Get records broken this year
  const records = await ctx.db.query("records").collect();
  const yearRecords = records.filter((r) =>
    r.setAtTick >= startTick && r.setAtTick <= endTick
  );

  // =============================================
  // BUILD TERRITORY HIGHLIGHTS
  // =============================================

  const territoryHighlights: Doc<"chronicles">["territoryHighlights"] = [];

  for (const territory of territories) {
    const territoryEvents = events.filter((e) => e.territoryId === territory._id);

    // Find the most significant event for headline
    const criticalEvents = territoryEvents.filter((e) => e.severity === "critical");
    const positiveEvents = territoryEvents.filter((e) => e.severity === "positive");

    let headline = `${territory.name} had a stable year.`;

    if (criticalEvents.length > 0) {
      // Use most recent critical event
      headline = criticalEvents[criticalEvents.length - 1].title;
    } else if (positiveEvents.length > 0) {
      headline = `${territory.name} prospered with ${positiveEvents.length} positive developments.`;
    }

    // Get unique event summaries (deduplicate similar events)
    const eventSummaries = new Set<string>();
    for (const event of territoryEvents.slice(-10)) {
      eventSummaries.add(event.title);
    }

    territoryHighlights.push({
      territoryId: territory._id,
      territoryName: territory.name,
      headline,
      events: Array.from(eventSummaries),
    });
  }

  // =============================================
  // BUILD MAJOR EVENTS
  // =============================================

  const majorEvents: Doc<"chronicles">["majorEvents"] = [];

  // Critical events are major
  for (const event of events.filter((e) => e.severity === "critical")) {
    majorEvents.push({
      title: event.title,
      description: event.description,
      impactScore: 8,
      tick: event.tick,
    });
  }

  // War starts are major
  for (const war of yearWars.filter((w) => w.startTick >= startTick)) {
    majorEvents.push({
      title: `${war.name} Begins`,
      description: war.causeDescription,
      impactScore: 9,
      tick: war.startTick,
    });
  }

  // War ends are major
  for (const war of yearWars.filter((w) => w.endTick && w.endTick <= endTick)) {
    majorEvents.push({
      title: `${war.name} Ends`,
      description: war.outcome || "Peace was restored.",
      impactScore: 8,
      tick: war.endTick!,
    });
  }

  // Sort by impact and take top 10
  majorEvents.sort((a, b) => b.impactScore - a.impactScore);
  const topMajorEvents = majorEvents.slice(0, 10);

  // =============================================
  // BUILD RULER CHANGES
  // =============================================

  const rulerChanges: Doc<"chronicles">["rulerChanges"] = [];

  for (const succession of successionEvents) {
    const territory = territories.find((t) => t._id === succession.territoryId);
    const oldRuler = await ctx.db.get(succession.deceasedRulerId);
    const newRuler = await ctx.db.get(succession.newRulerId);

    if (territory && oldRuler && newRuler) {
      rulerChanges.push({
        territoryId: territory._id,
        territoryName: territory.name,
        oldRuler: `${oldRuler.title} ${oldRuler.name}`,
        newRuler: `${newRuler.title} ${newRuler.name}`,
        cause: succession.successionType,
      });
    }
  }

  // =============================================
  // BUILD WAR SUMMARIES
  // =============================================

  const warSummaries: Doc<"chronicles">["warSummaries"] = [];

  for (const war of yearWars) {
    let status = "ongoing";
    if (war.startTick >= startTick && war.startTick <= endTick) {
      status = "started";
    }
    if (war.endTick && war.endTick >= startTick && war.endTick <= endTick) {
      status = "ended";
    }

    const aggressor = territories.find((t) => t._id === war.aggressorId);
    const defender = territories.find((t) => t._id === war.defenderId);

    let description = `${war.name} between ${aggressor?.name || "Unknown"} and ${defender?.name || "Unknown"}`;
    if (status === "started") {
      description += ` began this year.`;
    } else if (status === "ended") {
      description += ` ended this year. ${war.outcome || ""}`;
    } else {
      description += ` continued to rage.`;
    }

    warSummaries.push({
      warName: war.name,
      status,
      description,
    });
  }

  // =============================================
  // BUILD RECORDS BROKEN
  // =============================================

  const recordsBroken: Doc<"chronicles">["recordsBroken"] = [];

  for (const record of yearRecords) {
    recordsBroken.push({
      recordType: record.recordType,
      territoryName: record.territoryName,
      newValue: record.value,
    });
  }

  // =============================================
  // BUILD GLOBAL SUMMARY
  // =============================================

  let globalSummary = `Year ${year} `;

  const warCount = yearWars.filter((w) => w.status === "active").length;
  if (warCount > 0) {
    globalSummary += `was marked by conflict, with ${warCount} war${warCount > 1 ? "s" : ""} raging. `;
  } else {
    globalSummary += `was a year of relative peace. `;
  }

  if (successionEvents.length > 0) {
    globalSummary += `${successionEvents.length} ruler${successionEvents.length > 1 ? "s" : ""} changed hands. `;
  }

  const totalCritical = events.filter((e) => e.severity === "critical").length;
  if (totalCritical > 5) {
    globalSummary += `It was a turbulent year with many significant events.`;
  } else if (totalCritical > 0) {
    globalSummary += `Several notable events shaped the world.`;
  } else {
    globalSummary += `The world continued to develop steadily.`;
  }

  // =============================================
  // INSERT CHRONICLE
  // =============================================

  await ctx.db.insert("chronicles", {
    year,
    globalSummary,
    territoryHighlights,
    majorEvents: topMajorEvents,
    rulerChanges,
    warSummaries,
    recordsBroken,
  });

  return {
    year,
    globalSummary,
    majorEventsCount: topMajorEvents.length,
    rulerChangesCount: rulerChanges.length,
    warsCount: warSummaries.length,
  };
}

// =============================================
// GENERATE "WHILE YOU WERE GONE" SUMMARY
// =============================================

export const generateAbsenceSummary = internalMutation({
  args: {
    lastSeenTick: v.number(),
    currentTick: v.number(),
  },
  handler: async (ctx, args) => {
    const ticksMissed = args.currentTick - args.lastSeenTick;
    const monthsMissed = ticksMissed;
    const yearsMissed = Math.floor(monthsMissed / 12);

    // Get critical events missed
    const criticalEvents = await ctx.db
      .query("events")
      .withIndex("by_tick")
      .filter((q) =>
        q.and(
          q.gt(q.field("tick"), args.lastSeenTick),
          q.lte(q.field("tick"), args.currentTick),
          q.eq(q.field("severity"), "critical")
        )
      )
      .collect();

    // Get succession events missed
    const successionEvents = await ctx.db
      .query("successionEvents")
      .withIndex("by_tick")
      .filter((q) =>
        q.and(
          q.gt(q.field("tick"), args.lastSeenTick),
          q.lte(q.field("tick"), args.currentTick)
        )
      )
      .collect();

    // Get wars started
    const wars = await ctx.db.query("wars").collect();
    const newWars = wars.filter(
      (w) => w.startTick > args.lastSeenTick && w.startTick <= args.currentTick
    );
    const endedWars = wars.filter(
      (w) => w.endTick && w.endTick > args.lastSeenTick && w.endTick <= args.currentTick
    );

    // Build summary
    let summary = "";

    if (yearsMissed > 0) {
      summary += `${yearsMissed} year${yearsMissed > 1 ? "s" : ""} have passed. `;
    } else {
      summary += `${monthsMissed} month${monthsMissed > 1 ? "s" : ""} have passed. `;
    }

    if (newWars.length > 0) {
      summary += `${newWars.length} new war${newWars.length > 1 ? "s" : ""} broke out. `;
    }

    if (endedWars.length > 0) {
      summary += `${endedWars.length} war${endedWars.length > 1 ? "s" : ""} ended. `;
    }

    if (successionEvents.length > 0) {
      summary += `${successionEvents.length} ruler${successionEvents.length > 1 ? "s" : ""} died or were overthrown. `;
    }

    if (criticalEvents.length > 0) {
      summary += `${criticalEvents.length} critical event${criticalEvents.length > 1 ? "s" : ""} occurred.`;
    }

    // Build highlights
    const highlights: string[] = [];

    for (const event of criticalEvents.slice(-5)) {
      highlights.push(event.title);
    }

    for (const war of newWars.slice(-3)) {
      highlights.push(`${war.name} began`);
    }

    for (const succession of successionEvents.slice(-3)) {
      const territory = await ctx.db.get(succession.territoryId);
      if (territory) {
        highlights.push(`New ruler in ${territory.name} (${succession.successionType})`);
      }
    }

    return {
      ticksMissed,
      monthsMissed,
      yearsMissed,
      summary,
      highlights,
      criticalEventsCount: criticalEvents.length,
      newWarsCount: newWars.length,
      endedWarsCount: endedWars.length,
      successionEventsCount: successionEvents.length,
    };
  },
});

// =============================================
// QUERIES
// =============================================

export const getChronicle = query({
  args: { year: v.number() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("chronicles")
      .withIndex("by_year", (q) => q.eq("year", args.year))
      .first();
  },
});

export const getRecentChronicles = query({
  args: { limit: v.number() },
  handler: async (ctx, args) => {
    const chronicles = await ctx.db
      .query("chronicles")
      .withIndex("by_year")
      .order("desc")
      .take(args.limit);

    return chronicles;
  },
});

export const getAllChronicles = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("chronicles")
      .withIndex("by_year")
      .order("desc")
      .collect();
  },
});
