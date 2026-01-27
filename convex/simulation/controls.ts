import { mutation, internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";

// Start or resume the simulation
export const startSimulation = mutation({
  args: {},
  handler: async (ctx) => {
    const world = await ctx.db.query("world").first();
    if (!world) {
      throw new Error("World not initialized. Call initializeWorld first.");
    }

    if (world.status === "running") {
      return { success: false, message: "Simulation is already running" };
    }

    // Update world status
    await ctx.db.patch(world._id, {
      status: "running",
      speed: world.speed === "paused" ? "1x" : world.speed,
    });

    // Schedule the first tick
    await ctx.scheduler.runAfter(0, internal.simulation.tick.processTick, {});
    await ctx.scheduler.runAfter(100, internal.simulation.tick.scheduleNextTick, {});

    // Log event
    await ctx.db.insert("events", {
      tick: world.tick,
      type: "system",
      title: "Simulation Started",
      description: "The world simulation has begun running.",
      severity: "info",
      createdAt: Date.now(),
    });

    return { success: true, message: "Simulation started" };
  },
});

// Pause the simulation
export const pauseSimulation = mutation({
  args: {},
  handler: async (ctx) => {
    const world = await ctx.db.query("world").first();
    if (!world) {
      throw new Error("World not initialized");
    }

    await ctx.db.patch(world._id, {
      status: "paused",
      speed: "paused",
    });

    // Log event
    await ctx.db.insert("events", {
      tick: world.tick,
      type: "system",
      title: "Simulation Paused",
      description: "The world simulation has been paused.",
      severity: "info",
      createdAt: Date.now(),
    });

    return { success: true, message: "Simulation paused" };
  },
});

// Change simulation speed
export const setSpeed = mutation({
  args: {
    speed: v.union(
      v.literal("paused"),
      v.literal("1x"),
      v.literal("10x"),
      v.literal("100x")
    ),
  },
  handler: async (ctx, args) => {
    const world = await ctx.db.query("world").first();
    if (!world) {
      throw new Error("World not initialized");
    }

    const wasRunning = world.status === "running";
    const newStatus = args.speed === "paused" ? "paused" : "running";

    await ctx.db.patch(world._id, {
      speed: args.speed,
      status: newStatus as "paused" | "running" | "initializing",
    });

    // If starting from paused state, kick off the scheduler
    if (!wasRunning && args.speed !== "paused") {
      await ctx.scheduler.runAfter(0, internal.simulation.tick.processTick, {});
      await ctx.scheduler.runAfter(100, internal.simulation.tick.scheduleNextTick, {});
    }

    return { success: true, speed: args.speed };
  },
});

// Manually trigger a single tick (useful for testing)
export const manualTick = mutation({
  args: {},
  handler: async (ctx) => {
    const world = await ctx.db.query("world").first();
    if (!world) {
      throw new Error("World not initialized");
    }

    // Temporarily set status to running for the tick
    const wasStatus = world.status;
    await ctx.db.patch(world._id, { status: "running" });

    // Process the tick immediately
    await ctx.scheduler.runAfter(0, internal.simulation.tick.processTick, {});

    // Restore status after a delay if it was paused
    if (wasStatus === "paused") {
      await ctx.scheduler.runAfter(1000, internal.simulation.controls.restoreStatus, {
        status: wasStatus,
      });
    }

    return { success: true, message: "Manual tick triggered" };
  },
});

// Internal helper to restore status
export const restoreStatus = internalMutation({
  args: { status: v.string() },
  handler: async (ctx, args) => {
    const world = await ctx.db.query("world").first();
    if (world) {
      await ctx.db.patch(world._id, {
        status: args.status as "paused" | "running" | "initializing",
      });
    }
  },
});
