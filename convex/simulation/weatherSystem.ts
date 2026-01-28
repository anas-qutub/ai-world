/**
 * Weather & Seasons System
 *
 * Generates weather per territory, with seasonal patterns and extreme events.
 * Weather affects farming, military operations, travel, and mood.
 */

import { MutationCtx, QueryCtx } from "../_generated/server";
import { Id, Doc } from "../_generated/dataModel";

// Weather types
export type WeatherType =
  | "clear"
  | "cloudy"
  | "rain"
  | "heavy_rain"
  | "thunderstorm"
  | "snow"
  | "blizzard"
  | "drought"
  | "heat_wave"
  | "fog"
  | "monsoon";

// Season to weather probability mapping
const SEASONAL_WEATHER: Record<string, Record<WeatherType, number>> = {
  spring: {
    clear: 30, cloudy: 25, rain: 25, heavy_rain: 10,
    thunderstorm: 5, snow: 2, blizzard: 0, drought: 0,
    heat_wave: 0, fog: 3, monsoon: 0
  },
  summer: {
    clear: 40, cloudy: 20, rain: 10, heavy_rain: 5,
    thunderstorm: 10, snow: 0, blizzard: 0, drought: 8,
    heat_wave: 5, fog: 2, monsoon: 0
  },
  autumn: {
    clear: 25, cloudy: 30, rain: 25, heavy_rain: 10,
    thunderstorm: 3, snow: 2, blizzard: 0, drought: 0,
    heat_wave: 0, fog: 5, monsoon: 0
  },
  winter: {
    clear: 20, cloudy: 25, rain: 10, heavy_rain: 5,
    thunderstorm: 0, snow: 25, blizzard: 10, drought: 0,
    heat_wave: 0, fog: 5, monsoon: 0
  },
};

// Weather duration in ticks (months)
const WEATHER_DURATION: Record<WeatherType, { min: number; max: number }> = {
  clear: { min: 1, max: 3 },
  cloudy: { min: 1, max: 2 },
  rain: { min: 1, max: 2 },
  heavy_rain: { min: 1, max: 2 },
  thunderstorm: { min: 1, max: 1 },
  snow: { min: 1, max: 3 },
  blizzard: { min: 1, max: 2 },
  drought: { min: 2, max: 6 },
  heat_wave: { min: 1, max: 3 },
  fog: { min: 1, max: 1 },
  monsoon: { min: 2, max: 4 },
};

// Weather effects (percentage modifiers)
const WEATHER_EFFECTS: Record<WeatherType, {
  farming: number;
  military: number;
  travel: number;
  mood: number;
  isExtreme: boolean;
}> = {
  clear: { farming: 10, military: 5, travel: 10, mood: 10, isExtreme: false },
  cloudy: { farming: 0, military: 0, travel: 0, mood: -5, isExtreme: false },
  rain: { farming: 15, military: -10, travel: -15, mood: -10, isExtreme: false },
  heavy_rain: { farming: 5, military: -25, travel: -30, mood: -15, isExtreme: false },
  thunderstorm: { farming: -10, military: -40, travel: -50, mood: -20, isExtreme: true },
  snow: { farming: -30, military: -20, travel: -40, mood: -10, isExtreme: false },
  blizzard: { farming: -50, military: -50, travel: -80, mood: -30, isExtreme: true },
  drought: { farming: -60, military: 0, travel: 5, mood: -25, isExtreme: true },
  heat_wave: { farming: -40, military: -20, travel: -10, mood: -20, isExtreme: true },
  fog: { farming: 0, military: -30, travel: -40, mood: -5, isExtreme: false },
  monsoon: { farming: 20, military: -40, travel: -60, mood: -15, isExtreme: true },
};

// Temperature ranges by season (0-100 scale: 0=freezing, 50=mild, 100=scorching)
const SEASONAL_TEMPERATURE: Record<string, { min: number; max: number }> = {
  spring: { min: 35, max: 55 },
  summer: { min: 55, max: 85 },
  autumn: { min: 30, max: 55 },
  winter: { min: 10, max: 35 },
};

export interface Weather {
  currentWeather: WeatherType;
  temperature: number;
  weatherStartTick: number;
  expectedEndTick: number;
  isExtreme: boolean;
  farmingModifier: number;
  militaryModifier: number;
  travelModifier: number;
  moodModifier: number;
}

/**
 * Generate random weather based on season
 */
function generateWeather(season: string, tick: number): Weather {
  const probabilities = SEASONAL_WEATHER[season] || SEASONAL_WEATHER.spring;

  // Weighted random selection
  const total = Object.values(probabilities).reduce((a, b) => a + b, 0);
  let random = Math.random() * total;

  let selectedWeather: WeatherType = "clear";
  for (const [weather, prob] of Object.entries(probabilities)) {
    random -= prob;
    if (random <= 0) {
      selectedWeather = weather as WeatherType;
      break;
    }
  }

  // Calculate duration
  const duration = WEATHER_DURATION[selectedWeather];
  const weatherDuration = Math.floor(
    Math.random() * (duration.max - duration.min + 1) + duration.min
  );

  // Calculate temperature
  const tempRange = SEASONAL_TEMPERATURE[season] || SEASONAL_TEMPERATURE.spring;
  let temperature = Math.floor(
    Math.random() * (tempRange.max - tempRange.min + 1) + tempRange.min
  );

  // Adjust temperature for extreme weather
  if (selectedWeather === "heat_wave") {
    temperature = Math.min(100, temperature + 20);
  } else if (selectedWeather === "blizzard" || selectedWeather === "snow") {
    temperature = Math.max(0, temperature - 15);
  }

  const effects = WEATHER_EFFECTS[selectedWeather];

  return {
    currentWeather: selectedWeather,
    temperature,
    weatherStartTick: tick,
    expectedEndTick: tick + weatherDuration,
    isExtreme: effects.isExtreme,
    farmingModifier: effects.farming,
    militaryModifier: effects.military,
    travelModifier: effects.travel,
    moodModifier: effects.mood,
  };
}

/**
 * Initialize weather for a territory
 */
export async function initializeWeather(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  season: string,
  tick: number
): Promise<Weather> {
  const weather = generateWeather(season, tick);

  await ctx.db.insert("weather", {
    territoryId,
    ...weather,
  });

  return weather;
}

/**
 * Process weather changes for a territory
 */
export async function processWeather(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  tick: number,
  season: string
): Promise<{ events: Array<{ type: string; description: string }> }> {
  const events: Array<{ type: string; description: string }> = [];

  // Get current weather
  let weatherRecord = await ctx.db
    .query("weather")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .first();

  // If no weather exists, create it
  if (!weatherRecord) {
    const weather = await initializeWeather(ctx, territoryId, season, tick);
    return { events };
  }

  // Check if weather should change
  if (tick >= weatherRecord.expectedEndTick) {
    const oldWeather = weatherRecord.currentWeather;
    const newWeather = generateWeather(season, tick);

    await ctx.db.patch(weatherRecord._id, newWeather);

    // Log significant weather changes
    if (newWeather.isExtreme) {
      const weatherNames: Record<WeatherType, string> = {
        clear: "clear skies",
        cloudy: "cloudy skies",
        rain: "rain",
        heavy_rain: "heavy rain",
        thunderstorm: "violent thunderstorms",
        snow: "snowfall",
        blizzard: "a devastating blizzard",
        drought: "severe drought",
        heat_wave: "a scorching heat wave",
        fog: "thick fog",
        monsoon: "monsoon rains",
      };

      events.push({
        type: "weather",
        description: `${weatherNames[newWeather.currentWeather]} has arrived. Conditions are extreme.`,
      });
    }

    // Log when extreme weather ends
    if (WEATHER_EFFECTS[oldWeather].isExtreme && !newWeather.isExtreme) {
      events.push({
        type: "weather",
        description: `The extreme weather has passed. Normal conditions return.`,
      });
    }
  }

  return { events };
}

/**
 * Get current weather for a territory
 */
export async function getWeather(
  ctx: QueryCtx,
  territoryId: Id<"territories">
): Promise<Weather | null> {
  const weatherRecord = await ctx.db
    .query("weather")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .first();

  if (!weatherRecord) return null;

  return {
    currentWeather: weatherRecord.currentWeather,
    temperature: weatherRecord.temperature,
    weatherStartTick: weatherRecord.weatherStartTick,
    expectedEndTick: weatherRecord.expectedEndTick,
    isExtreme: weatherRecord.isExtreme,
    farmingModifier: weatherRecord.farmingModifier,
    militaryModifier: weatherRecord.militaryModifier,
    travelModifier: weatherRecord.travelModifier,
    moodModifier: weatherRecord.moodModifier,
  };
}

/**
 * Apply weather effects to territory resources
 */
export async function applyWeatherEffects(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  tick: number
): Promise<void> {
  const territory = await ctx.db.get(territoryId);
  if (!territory) return;

  const weatherRecord = await ctx.db
    .query("weather")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .first();

  if (!weatherRecord) return;

  // Apply mood effects
  if (weatherRecord.moodModifier !== 0) {
    const moodChange = Math.floor(weatherRecord.moodModifier * 0.1); // Scale down
    await ctx.db.patch(territoryId, {
      happiness: Math.max(0, Math.min(100, territory.happiness + moodChange)),
    });
  }

  // Note: Farming modifiers are applied in the economy/production systems
  // Military modifiers are applied in combat/military systems
  // Travel modifiers affect caravans and army movement
}

/**
 * Get weather modifiers for external systems
 */
export async function getWeatherModifiers(
  ctx: QueryCtx,
  territoryId: Id<"territories">
): Promise<{
  farming: number;
  military: number;
  travel: number;
  mood: number;
  isExtreme: boolean;
}> {
  const weather = await getWeather(ctx, territoryId);

  if (!weather) {
    return { farming: 0, military: 0, travel: 0, mood: 0, isExtreme: false };
  }

  return {
    farming: weather.farmingModifier,
    military: weather.militaryModifier,
    travel: weather.travelModifier,
    mood: weather.moodModifier,
    isExtreme: weather.isExtreme,
  };
}

/**
 * Force a specific weather (for AI actions or events)
 */
export async function setWeather(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  weatherType: WeatherType,
  duration: number,
  tick: number
): Promise<void> {
  const effects = WEATHER_EFFECTS[weatherType];

  let weatherRecord = await ctx.db
    .query("weather")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .first();

  const weatherData = {
    currentWeather: weatherType,
    temperature: 50, // Default mild
    weatherStartTick: tick,
    expectedEndTick: tick + duration,
    isExtreme: effects.isExtreme,
    farmingModifier: effects.farming,
    militaryModifier: effects.military,
    travelModifier: effects.travel,
    moodModifier: effects.mood,
  };

  if (weatherRecord) {
    await ctx.db.patch(weatherRecord._id, weatherData);
  } else {
    await ctx.db.insert("weather", {
      territoryId,
      ...weatherData,
    });
  }
}

/**
 * Check if weather allows military operations
 */
export async function canConductMilitaryOperations(
  ctx: QueryCtx,
  territoryId: Id<"territories">
): Promise<{ allowed: boolean; penalty: number; reason: string }> {
  const weather = await getWeather(ctx, territoryId);

  if (!weather) {
    return { allowed: true, penalty: 0, reason: "Normal conditions" };
  }

  // Severe penalties prevent operations
  if (weather.militaryModifier <= -40) {
    return {
      allowed: false,
      penalty: weather.militaryModifier,
      reason: `${weather.currentWeather} prevents military operations`,
    };
  }

  if (weather.militaryModifier < 0) {
    return {
      allowed: true,
      penalty: weather.militaryModifier,
      reason: `${weather.currentWeather} hampers military operations`,
    };
  }

  return { allowed: true, penalty: 0, reason: "Good conditions" };
}

/**
 * Get weather summary for AI decision-making
 */
export async function getWeatherSummary(
  ctx: QueryCtx,
  territoryId: Id<"territories">
): Promise<string> {
  const weather = await getWeather(ctx, territoryId);
  const territory = await ctx.db.get(territoryId);

  if (!weather || !territory) {
    return "Weather unknown";
  }

  const descriptions: Record<WeatherType, string> = {
    clear: "clear and pleasant",
    cloudy: "overcast but mild",
    rain: "rainy",
    heavy_rain: "experiencing heavy rainfall",
    thunderstorm: "battered by thunderstorms",
    snow: "covered in snow",
    blizzard: "engulfed in a severe blizzard",
    drought: "suffering from drought",
    heat_wave: "sweltering under a heat wave",
    fog: "shrouded in fog",
    monsoon: "drenched by monsoon rains",
  };

  let summary = `Weather is ${descriptions[weather.currentWeather]}.`;

  if (weather.isExtreme) {
    summary += " Conditions are extreme.";

    if (weather.farmingModifier < -30) {
      summary += " Farming is severely impacted.";
    }
    if (weather.militaryModifier < -30) {
      summary += " Military operations are hindered.";
    }
  }

  return summary;
}
