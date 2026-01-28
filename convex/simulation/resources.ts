import { Doc } from "../_generated/dataModel";
import { WOOD_CONSTANTS, SEASONAL_EFFECTS, Season } from "./survival";

// Natural minimum - resources can't go below 0
function naturalMin(value: number, min: number = 0): number {
  return Math.max(min, value);
}

// Legacy clamp - kept for backwards compatibility during transition
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// Diminishing returns for very high resources
// Returns a penalty factor (0-1) that increases problems at extreme values
export function calculateExcessPenalty(value: number, threshold: number = 80): number {
  if (value <= threshold) return 0;
  // Exponential penalty above threshold
  const excess = value - threshold;
  return 1 - Math.exp(-excess / 50);
}

// Calculate natural resource decay based on excess (attracts raiders, corruption, etc.)
export function calculateExcessDecay(value: number, threshold: number = 80): number {
  if (value <= threshold) return 0;
  // Resources above threshold decay faster - attracts problems
  const excess = value - threshold;
  return excess * 0.05; // 5% of excess decays per tick
}

// Calculate passive resource changes for a territory each tick
// Resources can grow beyond 100 but face natural consequences at high levels
export function calculateResourceChanges(
  territory: Doc<"territories">,
  season?: Season
): Partial<Doc<"territories">> {
  const changes: Partial<Doc<"territories">> = {};
  const currentSeason = season || "spring"; // Default to spring if not provided
  const seasonalEffects = SEASONAL_EFFECTS[currentSeason];

  // Food consumption - scales with population and season
  // Each person needs roughly 0.3 food units per tick, modified by season
  const baseFoodConsumption = territory.population * 0.3;
  const foodConsumption = baseFoodConsumption * seasonalEffects.foodConsumptionModifier;

  // Baseline food production from foraging/hunting/gathering
  // Even without farms, a small population can sustain itself through gathering
  // Production scales with population (more gatherers) but with diminishing returns
  // and is limited by carrying capacity of the land
  // Modified by season - harder to forage in winter
  const baselineGatheringCapacity = 40; // Land can support ~40 food from natural gathering
  const gatheringEfficiency = Math.exp(-territory.population / 50); // Diminishing returns
  const baseGatheringOutput = Math.min(
    baselineGatheringCapacity * 0.5, // Max gathering is 20 food/tick
    territory.population * 0.2 * gatheringEfficiency // Each person gathers ~0.2 food with efficiency
  );
  const baselineFoodProduction = baseGatheringOutput * seasonalEffects.gatheringModifier;

  let newFood = territory.food - foodConsumption + baselineFoodProduction;

  // High food stores attract pests, spoilage, raiders
  newFood -= calculateExcessDecay(territory.food, 80);
  changes.food = naturalMin(newFood, 0);

  // Population changes based on food and happiness
  // Handled primarily by demographics.ts for deep simulation
  // This is a fallback for simple mode
  const foodPerCapita = territory.food / Math.max(1, territory.population);
  if (foodPerCapita > 2 && territory.happiness > 40) {
    // Good conditions - slow growth
    if (Math.random() < 0.1) {
      changes.population = territory.population + 1;
    }
  } else if (foodPerCapita < 0.5) {
    // Starvation - people die (probability scales with severity)
    const starvationChance = Math.min(0.5, 0.5 - foodPerCapita);
    if (Math.random() < starvationChance) {
      changes.population = Math.max(1, territory.population - 1);
    }
  }

  // Happiness responds to conditions naturally
  let happinessChange = 0;
  if (foodPerCapita > 1.5) happinessChange += 1;
  else if (foodPerCapita < 0.7) happinessChange -= 3 * (0.7 - foodPerCapita);
  if (territory.wealth > 30) happinessChange += 0.5;

  // High wealth attracts envy, corruption - slight happiness drain
  if (territory.wealth > 80) {
    happinessChange -= calculateExcessPenalty(territory.wealth, 80) * 2;
  }
  changes.happiness = naturalMin(territory.happiness + happinessChange, 0);

  // Technology and knowledge slowly decay without maintenance
  // But very high tech/knowledge decays faster (harder to maintain cutting edge)
  const techDecay = 0.2 + calculateExcessDecay(territory.technology, 80) * 0.5;
  const knowledgeDecay = 0.1 + calculateExcessDecay(territory.knowledge, 80) * 0.3;
  changes.technology = naturalMin(territory.technology - techDecay, 0);
  changes.knowledge = naturalMin(territory.knowledge - knowledgeDecay, 0);

  // Military readiness decays (soldiers need constant training)
  // Large militaries are harder to maintain
  const militaryDecay = 0.3 + calculateExcessDecay(territory.military, 80) * 0.5;
  changes.military = naturalMin(territory.military - militaryDecay, 0);

  // Influence slowly fades without cultural activity
  const influenceDecay = 0.2 + calculateExcessDecay(territory.influence, 80) * 0.3;
  changes.influence = naturalMin(territory.influence - influenceDecay, 0);

  // High wealth decays due to corruption, spending, etc.
  const wealthDecay = calculateExcessDecay(territory.wealth, 80);
  if (wealthDecay > 0) {
    changes.wealth = naturalMin(territory.wealth - wealthDecay, 0);
  }

  // Wood stockpile natural regeneration (forests regrow slowly)
  const currentWood = (territory as any).woodStockpile || 0;
  if (currentWood < WOOD_CONSTANTS.maxNaturalWood) {
    // Regeneration is better in spring/summer
    const regenModifier = currentSeason === "spring" || currentSeason === "summer" ? 1.5 : 1.0;
    const woodRegen = WOOD_CONSTANTS.forestRegeneration * regenModifier;
    changes.woodStockpile = Math.min(WOOD_CONSTANTS.maxNaturalWood, currentWood + woodRegen);
  }

  return changes;
}

// Apply trade agreement benefits to both territories
export function calculateTradeBonus(
  territory1: Doc<"territories">,
  territory2: Doc<"territories">
): { territory1Bonus: number; territory2Bonus: number } {
  // Simple trade bonus - both gain a little wealth/food
  return { territory1Bonus: 2, territory2Bonus: 2 };
}

// Calculate alliance military bonus
// Each ally adds +10 effective military when calculating war outcomes
export function calculateAllianceBonus(
  territory: Doc<"territories">,
  allyCount: number
): number {
  // Each ally provides +10 military bonus (capped at +30 from 3 allies)
  return Math.min(30, allyCount * 10);
}

// Apply alliance benefits during passive resource updates
export function applyAllianceBenefits(
  territory: Doc<"territories">,
  hasAlliance: boolean
): Partial<Doc<"territories">> {
  if (!hasAlliance) return {};

  // Allies provide:
  // - Small military boost (shared defense knowledge)
  // - Small happiness boost (feeling of security)
  // - Small trade boost (economic cooperation)
  // No caps - resources can grow naturally
  return {
    military: naturalMin(territory.military + 0.5, 0),
    happiness: naturalMin(territory.happiness + 0.3, 0),
    wealth: naturalMin(territory.wealth + 0.2, 0),
  };
}

// Calculate raid/war effects
// Alliance bonuses are added to military power
export function calculateWarEffects(
  attacker: Doc<"territories">,
  defender: Doc<"territories">,
  attackerAllyCount: number = 0,
  defenderAllyCount: number = 0
): {
  attackerCosts: Partial<Doc<"territories">>;
  defenderCosts: Partial<Doc<"territories">>;
  attackerWins: boolean;
  attackerPower: number;
  defenderPower: number;
} {
  // Combat is simple but deadly for small tribes
  // Alliance bonus: each ally adds +10 effective military
  const attackerAllyBonus = calculateAllianceBonus(attacker, attackerAllyCount);
  const defenderAllyBonus = calculateAllianceBonus(defender, defenderAllyCount);

  const attackerPower = attacker.military + attacker.technology * 0.2 + attackerAllyBonus;
  const defenderPower = defender.military + defender.technology * 0.2 + defenderAllyBonus;

  const attackerRoll = attackerPower * (0.7 + Math.random() * 0.6);
  const defenderRoll = defenderPower * (0.7 + Math.random() * 0.6);

  const attackerWins = attackerRoll > defenderRoll;

  // Raids are costly - people die
  const attackerLosses = Math.random() < 0.3 ? 1 : 0;
  const defenderLosses = attackerWins ? (Math.random() < 0.5 ? 1 : 0) : 0;

  return {
    attackerCosts: {
      population: -attackerLosses,
      food: attackerWins ? 5 : -3, // Win = steal food, lose = wasted effort
      happiness: -5,
      military: -2,
    },
    defenderCosts: {
      population: -defenderLosses,
      food: attackerWins ? -10 : 0, // Lose food if raided
      happiness: -8,
      wealth: attackerWins ? -5 : 0,
    },
    attackerWins,
    attackerPower,
    defenderPower,
  };
}

// Name generators for population events
const firstNamesMale = ["Koren", "Tahl", "Varen", "Jorah", "Marek", "Drex", "Finn", "Brynn", "Raven", "Zeth", "Orin", "Kael", "Thane", "Soren", "Leif"];
const firstNamesFemale = ["Lyra", "Kira", "Mira", "Alina", "Sera", "Thessa", "Nyla", "Eira", "Zara", "Vela", "Astra", "Rhea", "Tala", "Sage", "Ivy"];
const elderTitles = ["Elder", "Wise One", "Healer", "Hunter", "Craftmaster", "Storyteller", "Guardian"];

function randomName(isMale: boolean = Math.random() > 0.5): string {
  const names = isMale ? firstNamesMale : firstNamesFemale;
  return names[Math.floor(Math.random() * names.length)];
}

function randomElderTitle(): string {
  return elderTitles[Math.floor(Math.random() * elderTitles.length)];
}

// Generate random events for small tribes with narrative names
export function generateRandomEvent(territory: Doc<"territories">): {
  type: "disaster" | "breakthrough" | "population_boom" | "crisis";
  effects: Partial<Doc<"territories">>;
  title: string;
  description: string;
} | null {
  const roll = Math.random();

  // 3% chance of any event per tick per territory
  if (roll > 0.03) {
    return null;
  }

  const tribeName = (territory as any).tribeName || "the tribe";
  const eventRoll = Math.random();

  if (eventRoll < 0.25) {
    // Natural hardship
    const foodLoss = Math.round(5 + Math.random() * 10);
    const hardshipTypes = [
      "A harsh winter storm has depleted our food stores.",
      "Drought has made foraging difficult.",
      "Wild animals have raided our supplies.",
      "A flood damaged our food storage.",
      "Locusts have destroyed nearby vegetation.",
    ];
    return {
      type: "disaster",
      effects: {
        food: naturalMin(territory.food - foodLoss, 0),
        happiness: naturalMin(territory.happiness - 5, 0),
      },
      title: "Hard Times",
      description: hardshipTypes[Math.floor(Math.random() * hardshipTypes.length)] + ` The people of ${tribeName} must endure.`,
    };
  } else if (eventRoll < 0.5) {
    // Discovery - with a name
    const discovererName = randomName();
    const knowledgeGain = Math.round(3 + Math.random() * 5);
    const discoveries = [
      `${discovererName} discovered a new way to preserve food!`,
      `${discovererName} found a better method for crafting tools!`,
      `Young ${discovererName} stumbled upon useful medicinal plants!`,
      `${discovererName} the curious learned to read the stars for navigation!`,
      `${discovererName} developed a new technique for building shelters!`,
    ];
    return {
      type: "breakthrough",
      effects: {
        knowledge: naturalMin(territory.knowledge + knowledgeGain, 0),
        technology: naturalMin(territory.technology + 2, 0),
        happiness: naturalMin(territory.happiness + 3, 0),
      },
      title: `${discovererName}'s Discovery`,
      description: discoveries[Math.floor(Math.random() * discoveries.length)] + ` Knowledge spreads through ${tribeName}.`,
    };
  } else if (eventRoll < 0.75 && territory.happiness > 50 && territory.food > 40) {
    // New birth - with parent names
    const motherName = randomName(false);
    const babyName = randomName();
    const birthStories = [
      `${motherName} has given birth to a healthy baby, ${babyName}!`,
      `A new life! ${motherName} welcomes ${babyName} to ${tribeName}.`,
      `The cry of newborn ${babyName} brings joy to ${motherName} and all of ${tribeName}.`,
      `Under the stars, ${motherName} brought ${babyName} into the world.`,
    ];
    return {
      type: "population_boom",
      effects: {
        population: territory.population + 1,
        happiness: naturalMin(territory.happiness + 5, 0),
      },
      title: `Birth of ${babyName}`,
      description: birthStories[Math.floor(Math.random() * birthStories.length)] + ` The tribe celebrates!`,
    };
  } else {
    // Illness or death - with name
    const affectedName = randomName();
    const elderTitle = randomElderTitle();
    const willDie = Math.random() < 0.2;

    if (willDie && territory.population > 1) {
      const deathStories = [
        `${elderTitle} ${affectedName} has passed away after a long life of service to ${tribeName}.`,
        `${affectedName} succumbed to illness. The tribe mourns their loss.`,
        `We lost ${affectedName} to the winter cold. Their memory lives on.`,
        `${affectedName} died peacefully, surrounded by loved ones.`,
      ];
      return {
        type: "crisis",
        effects: {
          happiness: naturalMin(territory.happiness - 8, 0),
          population: Math.max(1, territory.population - 1),
        },
        title: `Death of ${affectedName}`,
        description: deathStories[Math.floor(Math.random() * deathStories.length)],
      };
    } else {
      const sicknessStories = [
        `${affectedName} has fallen ill, but the healers are hopeful.`,
        `Fever spreads through the camp. ${affectedName} and others are affected.`,
        `${affectedName} is recovering from a bad injury.`,
      ];
      return {
        type: "crisis",
        effects: {
          happiness: naturalMin(territory.happiness - 5, 0),
        },
        title: `${affectedName} Falls Ill`,
        description: sicknessStories[Math.floor(Math.random() * sicknessStories.length)],
      };
    }
  }
}

// Calculate effects of actions (updated for civilization-building)
// Resources can grow naturally without caps
export function calculateActionEffects(
  action: string,
  territory: Doc<"territories">,
  targetTerritory?: Doc<"territories">
): Partial<Doc<"territories">> {
  // Get current survival resources with defaults
  const currentWood = (territory as any).woodStockpile || 0;
  const currentShelter = (territory as any).shelterCapacity || 0;
  const currentPreserved = (territory as any).preservedFood || 0;

  switch (action) {
    // === SURVIVAL ACTIONS ===
    case "gather_wood":
      return {
        woodStockpile: currentWood + WOOD_CONSTANTS.baseGatheringPerAction,
        happiness: naturalMin(territory.happiness - 1, 0), // Hard labor
        knowledge: naturalMin(territory.knowledge + 0.5, 0), // Learn about forests
      } as Partial<Doc<"territories">>;

    case "build_houses":
      if (currentWood < WOOD_CONSTANTS.buildHouseCost) {
        // Not enough wood - no effect (action handler should check this)
        return {};
      }
      return {
        woodStockpile: currentWood - WOOD_CONSTANTS.buildHouseCost,
        shelterCapacity: currentShelter + WOOD_CONSTANTS.shelterPerBuild,
        happiness: naturalMin(territory.happiness + 3, 0), // People happy to have homes
        wealth: naturalMin(territory.wealth + 2, 0), // Shelter is wealth
      } as Partial<Doc<"territories">>;

    case "stockpile_fuel":
      // Mark wood for heating - just a priority action, wood is already stockpiled
      return {
        happiness: naturalMin(territory.happiness + 1, 0), // Feeling prepared
        knowledge: naturalMin(territory.knowledge + 0.5, 0), // Survival knowledge
      };

    case "preserve_food":
      if (currentWood < WOOD_CONSTANTS.preserveFoodCost || territory.food < WOOD_CONSTANTS.preservedFoodAmount) {
        return {};
      }
      return {
        woodStockpile: currentWood - WOOD_CONSTANTS.preserveFoodCost,
        food: naturalMin(territory.food - WOOD_CONSTANTS.preservedFoodAmount, 0), // Use fresh food
        preservedFood: currentPreserved + WOOD_CONSTANTS.preservedFoodAmount, // Add to preserved stores
        knowledge: naturalMin(territory.knowledge + 1, 0), // Learn preservation
      } as Partial<Doc<"territories">>;

    case "gather_food":
      return {
        food: naturalMin(territory.food + 8, 0),
        knowledge: naturalMin(territory.knowledge + 1, 0),
      };

    case "build_shelter":
      return {
        happiness: naturalMin(territory.happiness + 5, 0),
        wealth: naturalMin(territory.wealth + 2, 0),
      };

    case "explore_land":
      return {
        knowledge: naturalMin(territory.knowledge + 4, 0),
        influence: naturalMin(territory.influence + 2, 0),
      };

    case "develop_tools":
      return {
        technology: naturalMin(territory.technology + 5, 0),
        knowledge: naturalMin(territory.knowledge + 2, 0),
      };

    case "grow_community":
      // Small chance of population increase, plus happiness
      const popGrowth = Math.random() < 0.3 ? 1 : 0;
      return {
        population: territory.population + popGrowth,
        happiness: naturalMin(territory.happiness + 2, 0),
      };

    case "create_culture":
      return {
        influence: naturalMin(territory.influence + 6, 0),
        happiness: naturalMin(territory.happiness + 3, 0),
        knowledge: naturalMin(territory.knowledge + 2, 0),
      };

    case "train_warriors":
      return {
        military: naturalMin(territory.military + 4, 0),
        food: naturalMin(territory.food - 1, 0),
      };

    case "rest":
      return {
        happiness: naturalMin(territory.happiness + 3, 0),
        food: naturalMin(territory.food + 1, 0), // Conservation
      };

    // === CULTURAL IDENTITY ===
    case "name_tribe":
      return {
        influence: naturalMin(territory.influence + 4, 0),
        happiness: naturalMin(territory.happiness + 3, 0),
      };

    // === GOVERNANCE ACTIONS ===
    case "establish_council":
      return {
        knowledge: naturalMin(territory.knowledge + 3, 0),
        happiness: naturalMin(territory.happiness + 2, 0),
      };

    case "establish_chief":
      return {
        military: naturalMin(territory.military + 3, 0),
        influence: naturalMin(territory.influence + 2, 0),
      };

    case "establish_democracy":
      return {
        happiness: naturalMin(territory.happiness + 5, 0),
        knowledge: naturalMin(territory.knowledge + 3, 0),
      };

    case "establish_dictatorship":
      return {
        military: naturalMin(territory.military + 5, 0),
        happiness: naturalMin(territory.happiness - 5, 0),
      };

    case "establish_theocracy":
      return {
        influence: naturalMin(territory.influence + 4, 0),
        happiness: naturalMin(territory.happiness + 3, 0),
      };

    case "change_government":
      return {
        happiness: naturalMin(territory.happiness - 2, 0), // Transition unrest
      };

    // Actions requiring targets are handled in helpers.ts
    case "send_scouts":
    case "share_knowledge":
    case "trade_goods":
    case "show_strength":
    case "raid":
      return {}; // Effects applied in relationship handling

    default:
      return {};
  }
}
