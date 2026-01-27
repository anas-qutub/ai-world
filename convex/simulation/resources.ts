import { Doc } from "../_generated/dataModel";

// Clamp a value between min and max
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// Calculate passive resource changes for a territory each tick
// Designed for small populations (20-100 people)
export function calculateResourceChanges(
  territory: Doc<"territories">
): Partial<Doc<"territories">> {
  const changes: Partial<Doc<"territories">> = {};

  // Food consumption - each person needs food
  // Small populations consume less
  const foodConsumption = territory.population * 0.3;
  changes.food = clamp(territory.food - foodConsumption, 0, 100);

  // Population changes based on food and happiness
  // People may be born or die
  if (territory.food > 50 && territory.happiness > 40) {
    // Good conditions - slow growth
    if (Math.random() < 0.1) {
      changes.population = territory.population + 1;
    }
  } else if (territory.food < 10) {
    // Starvation - people die
    if (Math.random() < 0.3) {
      changes.population = Math.max(1, territory.population - 1);
    }
  }

  // Happiness slowly trends toward baseline based on conditions
  let happinessChange = 0;
  if (territory.food > 50) happinessChange += 1;
  if (territory.food < 20) happinessChange -= 3;
  if (territory.wealth > 30) happinessChange += 0.5;
  changes.happiness = clamp(territory.happiness + happinessChange, 0, 100);

  // Technology and knowledge slowly decay without maintenance
  changes.technology = clamp(territory.technology - 0.2, 0, 100);
  changes.knowledge = clamp(territory.knowledge - 0.1, 0, 100);

  // Military readiness decays
  changes.military = clamp(territory.military - 0.3, 0, 100);

  // Influence slowly fades without cultural activity
  changes.influence = clamp(territory.influence - 0.2, 0, 100);

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
  return {
    military: clamp(territory.military + 0.5, 0, 100),
    happiness: clamp(territory.happiness + 0.3, 0, 100),
    wealth: clamp(territory.wealth + 0.2, 0, 100),
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
        food: clamp(territory.food - foodLoss, 0, 100),
        happiness: clamp(territory.happiness - 5, 0, 100),
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
        knowledge: clamp(territory.knowledge + knowledgeGain, 0, 100),
        technology: clamp(territory.technology + 2, 0, 100),
        happiness: clamp(territory.happiness + 3, 0, 100),
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
        happiness: clamp(territory.happiness + 5, 0, 100),
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
          happiness: clamp(territory.happiness - 8, 0, 100),
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
          happiness: clamp(territory.happiness - 5, 0, 100),
        },
        title: `${affectedName} Falls Ill`,
        description: sicknessStories[Math.floor(Math.random() * sicknessStories.length)],
      };
    }
  }
}

// Calculate effects of actions (updated for civilization-building)
export function calculateActionEffects(
  action: string,
  territory: Doc<"territories">,
  targetTerritory?: Doc<"territories">
): Partial<Doc<"territories">> {
  switch (action) {
    case "gather_food":
      return {
        food: clamp(territory.food + 8, 0, 100),
        knowledge: clamp(territory.knowledge + 1, 0, 100),
      };

    case "build_shelter":
      return {
        happiness: clamp(territory.happiness + 5, 0, 100),
        wealth: clamp(territory.wealth + 2, 0, 100),
      };

    case "explore_land":
      return {
        knowledge: clamp(territory.knowledge + 4, 0, 100),
        influence: clamp(territory.influence + 2, 0, 100),
      };

    case "develop_tools":
      return {
        technology: clamp(territory.technology + 5, 0, 100),
        knowledge: clamp(territory.knowledge + 2, 0, 100),
      };

    case "grow_community":
      // Small chance of population increase, plus happiness
      const popGrowth = Math.random() < 0.3 ? 1 : 0;
      return {
        population: territory.population + popGrowth,
        happiness: clamp(territory.happiness + 2, 0, 100),
      };

    case "create_culture":
      return {
        influence: clamp(territory.influence + 6, 0, 100),
        happiness: clamp(territory.happiness + 3, 0, 100),
        knowledge: clamp(territory.knowledge + 2, 0, 100),
      };

    case "train_warriors":
      return {
        military: clamp(territory.military + 4, 0, 100),
        food: clamp(territory.food - 1, 0, 100),
      };

    case "rest":
      return {
        happiness: clamp(territory.happiness + 3, 0, 100),
        food: clamp(territory.food + 1, 0, 100), // Conservation
      };

    // === CULTURAL IDENTITY ===
    case "name_tribe":
      return {
        influence: clamp(territory.influence + 4, 0, 100),
        happiness: clamp(territory.happiness + 3, 0, 100),
      };

    // === GOVERNANCE ACTIONS ===
    case "establish_council":
      return {
        knowledge: clamp(territory.knowledge + 3, 0, 100),
        happiness: clamp(territory.happiness + 2, 0, 100),
      };

    case "establish_chief":
      return {
        military: clamp(territory.military + 3, 0, 100),
        influence: clamp(territory.influence + 2, 0, 100),
      };

    case "establish_democracy":
      return {
        happiness: clamp(territory.happiness + 5, 0, 100),
        knowledge: clamp(territory.knowledge + 3, 0, 100),
      };

    case "establish_dictatorship":
      return {
        military: clamp(territory.military + 5, 0, 100),
        happiness: clamp(territory.happiness - 5, 0, 100),
      };

    case "establish_theocracy":
      return {
        influence: clamp(territory.influence + 4, 0, 100),
        happiness: clamp(territory.happiness + 3, 0, 100),
      };

    case "change_government":
      return {
        happiness: clamp(territory.happiness - 2, 0, 100), // Transition unrest
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
