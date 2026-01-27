'use client';

// Types and utilities for activity management
// Main logic is implemented in CharacterPool.tsx

export interface ActivityDistribution {
  farmers: number;
  miners: number;
  builders: number;
  soldiers: number;
  traders: number;
  civilians: number;
  total: number;
  isFestival: boolean;
}

export interface TerritoryData {
  population: number;
  food: number;
  wealth: number;
  technology: number;
  military: number;
  happiness: number;
  naturalResources: string[];
}

// Calculate activity distribution based on territory stats
export function calculateActivities(
  territory: TerritoryData,
  isAtWar: boolean
): ActivityDistribution {
  // Scale population logarithmically (max 50 visible characters)
  const totalVisible = Math.min(
    50,
    Math.max(5, Math.ceil(Math.log10(Math.max(territory.population, 10)) * 15))
  );

  // Check for specific resource types
  const hasMinerals = territory.naturalResources.some((r) =>
    ['gold', 'iron', 'copper', 'silver', 'gems', 'stone', 'coal'].includes(
      r.toLowerCase()
    )
  );
  const hasFarming =
    territory.naturalResources.some((r) =>
      ['wheat', 'rice', 'corn', 'vegetables', 'fruit'].includes(r.toLowerCase())
    ) || territory.food > 30;

  // Base distribution
  let farmers = hasFarming
    ? Math.ceil(totalVisible * 0.25)
    : Math.ceil(totalVisible * 0.1);
  let miners = hasMinerals ? Math.ceil(totalVisible * 0.15) : 0;
  let builders = Math.ceil(totalVisible * 0.1);
  let soldiers = Math.ceil((territory.military / 100) * totalVisible * 0.3);
  let traders = Math.ceil(totalVisible * 0.1);

  // War adjustments
  if (isAtWar) {
    soldiers = Math.ceil(soldiers * 1.5);
    farmers = Math.ceil(farmers * 0.7);
  }

  // Fill remaining with civilians
  const allocated = farmers + miners + builders + soldiers + traders;
  const civilians = Math.max(0, totalVisible - allocated);

  // Happy festivals
  const isFestival = territory.happiness > 70 && !isAtWar;

  return {
    farmers,
    miners,
    builders,
    soldiers,
    traders,
    civilians,
    total: totalVisible,
    isFestival,
  };
}

// Map natural resources to activity types
export function getResourceActivityType(
  resource: string
): 'farming' | 'mining' | 'fishing' | 'logging' | 'other' {
  const resourceLower = resource.toLowerCase();

  // Farming resources
  if (
    ['wheat', 'rice', 'corn', 'vegetables', 'fruit', 'grain', 'barley'].includes(
      resourceLower
    )
  ) {
    return 'farming';
  }

  // Mining resources
  if (
    ['gold', 'iron', 'copper', 'silver', 'gems', 'stone', 'coal', 'ore'].includes(
      resourceLower
    )
  ) {
    return 'mining';
  }

  // Fishing resources
  if (
    ['fish', 'pearls', 'coral', 'salt', 'seaweed'].includes(resourceLower)
  ) {
    return 'fishing';
  }

  // Logging resources
  if (['timber', 'wood', 'lumber', 'forest'].includes(resourceLower)) {
    return 'logging';
  }

  return 'other';
}
