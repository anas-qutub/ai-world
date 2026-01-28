import { MutationCtx, QueryCtx } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";

// =============================================
// ECONOMY SIMULATION SYSTEM
// =============================================
// Handles:
// - Treasury management (income/expenses)
// - Tax collection
// - Loan processing (interest, payments, defaults)
// - Inflation calculation
// - Currency management
// - Economic phase progression
// - Banking operations
// - Wage and labor market

// =============================================
// CONSTANTS
// =============================================

// Base prices (in copper coins)
const BASE_PRICES = {
  food: 10,
  goods: 25,
  luxuries: 100,
  labor: 5,
  soldier: 15,
};

// Economic phase requirements
const PHASE_REQUIREMENTS = {
  barter: { technology: 0, population: 0 },
  commodity: { technology: 10, population: 50 },
  coined: { technology: 25, population: 150 },
  banking: { technology: 45, population: 500 },
  paper: { technology: 65, population: 1500 },
  modern: { technology: 85, population: 5000 },
};

// Tax collection efficiency modifiers
const TAX_MODIFIERS = {
  happiness_bonus: 0.3,    // High happiness = better collection
  corruption_penalty: 0.4, // Corruption reduces collection
  bureaucracy_bonus: 0.2,  // Good administration helps
};

// =============================================
// INITIALIZE TREASURY
// =============================================

export async function initializeTreasury(
  ctx: MutationCtx,
  territoryId: Id<"territories">
): Promise<void> {
  const existing = await ctx.db
    .query("treasury")
    .withIndex("by_territory", (q: any) => q.eq("territoryId", territoryId))
    .first();

  if (existing) return;

  await ctx.db.insert("treasury", {
    territoryId,
    goldReserves: 0,
    silverReserves: 5,
    copperReserves: 20,
    goldCoins: 0,
    silverCoins: 10,
    copperCoins: 100,
    totalDebt: 0,
    debtInterestRate: 0,
    creditRating: 50,
    inflationRate: 0,
    debasementLevel: 0,
    economicPhase: "barter",
    lastMonthIncome: 0,
    lastMonthExpenses: 0,
    lastMonthBalance: 0,
  });

  // Initialize tax policy
  await ctx.db.insert("taxPolicy", {
    territoryId,
    landTaxRate: 10,
    tradeTaxRate: 5,
    pollTaxRate: 2,
    incomeTaxRate: 0, // Unlocked later
    luxuryTaxRate: 15,
    collectionEfficiency: 50,
    taxEvaders: 10,
    happinessImpact: -5,
    taxExemptions: [],
    lastCollectionTick: 0,
    lastCollectionAmount: 0,
  });

  // Initialize labor market
  await ctx.db.insert("laborMarket", {
    territoryId,
    unskilledWage: 3,
    skilledWage: 8,
    professionalWage: 15,
    soldierPay: 10,
    unemploymentRate: 10,
    laborShortage: false,
    averageWorkHours: 12,
    workConditions: "poor",
    guildWageControl: 0,
    lastUpdatedTick: 0,
  });
}

// =============================================
// PROCESS ECONOMY (Main tick function)
// =============================================

export async function processEconomy(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  tick: number
): Promise<{
  events: Array<{ type: string; description: string }>;
  income: number;
  expenses: number;
  balance: number;
}> {
  const events: Array<{ type: string; description: string }> = [];

  const territory = await ctx.db.get(territoryId);
  if (!territory) return { events, income: 0, expenses: 0, balance: 0 };

  let treasury = await ctx.db
    .query("treasury")
    .withIndex("by_territory", (q: any) => q.eq("territoryId", territoryId))
    .first();

  if (!treasury) {
    await initializeTreasury(ctx, territoryId);
    treasury = await ctx.db
      .query("treasury")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", territoryId))
      .first();
    if (!treasury) return { events, income: 0, expenses: 0, balance: 0 };
  }

  // =============================================
  // 1. COLLECT TAXES
  // =============================================
  const taxResult = await collectTaxes(ctx, territoryId, tick);
  events.push(...taxResult.events);

  // =============================================
  // 2. CALCULATE EXPENSES
  // =============================================
  const expenseResult = await calculateExpenses(ctx, territoryId, tick);
  events.push(...expenseResult.events);

  // =============================================
  // 3. PROCESS LOANS
  // =============================================
  const loanResult = await processLoans(ctx, territoryId, tick);
  events.push(...loanResult.events);

  // =============================================
  // 4. UPDATE INFLATION
  // =============================================
  const inflationResult = await updateInflation(ctx, territoryId, tick);
  events.push(...inflationResult.events);

  // =============================================
  // 5. CHECK ECONOMIC PHASE PROGRESSION
  // =============================================
  const phaseResult = await checkEconomicPhase(ctx, territoryId, tick);
  events.push(...phaseResult.events);

  // =============================================
  // 6. UPDATE LABOR MARKET
  // =============================================
  await updateLaborMarket(ctx, territoryId, tick);

  // =============================================
  // 7. RECORD ECONOMIC HISTORY
  // =============================================
  const income = taxResult.totalCollected;
  const expenses = expenseResult.totalExpenses + loanResult.interestPaid;
  const balance = income - expenses;

  // Update treasury with monthly figures
  await ctx.db.patch(treasury._id, {
    lastMonthIncome: income,
    lastMonthExpenses: expenses,
    lastMonthBalance: balance,
  });

  // Record history (every 3 ticks to save space)
  if (tick % 3 === 0) {
    await ctx.db.insert("economicHistory", {
      territoryId,
      tick,
      totalWealth: territory.wealth,
      inflation: treasury.inflationRate,
      unemployment: (await ctx.db.query("laborMarket")
        .withIndex("by_territory", (q: any) => q.eq("territoryId", territoryId))
        .first())?.unemploymentRate || 10,
      tradeBalance: 0, // Would calculate from trade routes
      taxRevenue: income,
      militarySpending: expenseResult.militarySpending,
      debtLevel: treasury.totalDebt,
      foodPrice: BASE_PRICES.food * (1 + treasury.inflationRate / 100),
      goodsPrice: BASE_PRICES.goods * (1 + treasury.inflationRate / 100),
      laborPrice: BASE_PRICES.labor * (1 + treasury.inflationRate / 100),
    });
  }

  // Check for economic crises
  if (balance < -50) {
    events.push({
      type: "economic_crisis",
      description: "Treasury is bleeding money! Expenses far exceed income.",
    });
  }

  if (treasury.totalDebt > treasury.goldCoins * 10 + treasury.silverCoins) {
    events.push({
      type: "debt_crisis",
      description: "Debt levels are dangerously high! Default risk increasing.",
    });
  }

  return { events, income, expenses, balance };
}

// =============================================
// TAX COLLECTION
// =============================================

async function collectTaxes(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  tick: number
): Promise<{
  events: Array<{ type: string; description: string }>;
  totalCollected: number;
}> {
  const events: Array<{ type: string; description: string }> = [];

  const territory = await ctx.db.get(territoryId);
  if (!territory) return { events, totalCollected: 0 };

  const taxPolicy = await ctx.db
    .query("taxPolicy")
    .withIndex("by_territory", (q: any) => q.eq("territoryId", territoryId))
    .first();

  if (!taxPolicy) return { events, totalCollected: 0 };

  const treasury = await ctx.db
    .query("treasury")
    .withIndex("by_territory", (q: any) => q.eq("territoryId", territoryId))
    .first();

  if (!treasury) return { events, totalCollected: 0 };

  // Calculate base tax revenue
  let pollTaxBase = territory.population * taxPolicy.pollTaxRate / 100;
  let landTaxBase = territory.wealth * taxPolicy.landTaxRate / 100;
  let tradeTaxBase = (territory.wealth * 0.3) * taxPolicy.tradeTaxRate / 100;
  let luxuryTaxBase = (territory.wealth * 0.1) * taxPolicy.luxuryTaxRate / 100;

  // Apply collection efficiency
  const efficiency = taxPolicy.collectionEfficiency / 100;

  // Happiness affects willingness to pay
  const happinessModifier = territory.happiness > 50
    ? 1 + (territory.happiness - 50) * 0.005
    : 1 - (50 - territory.happiness) * 0.01;

  const totalTaxBase = pollTaxBase + landTaxBase + tradeTaxBase + luxuryTaxBase;
  const totalCollected = Math.floor(totalTaxBase * efficiency * happinessModifier);

  // Add to treasury (convert to coins)
  const newCopperCoins = treasury.copperCoins + totalCollected;

  // Convert excess copper to silver (100 copper = 1 silver in basic economy)
  let newSilverCoins = treasury.silverCoins;
  let adjustedCopperCoins = newCopperCoins;

  if (adjustedCopperCoins >= 100) {
    const silverToAdd = Math.floor(adjustedCopperCoins / 100);
    newSilverCoins += silverToAdd;
    adjustedCopperCoins = adjustedCopperCoins % 100;
  }

  await ctx.db.patch(treasury._id, {
    copperCoins: adjustedCopperCoins,
    silverCoins: newSilverCoins,
  });

  // Update tax policy
  await ctx.db.patch(taxPolicy._id, {
    lastCollectionTick: tick,
    lastCollectionAmount: totalCollected,
  });

  // Tax happiness impact
  const avgTaxRate = (taxPolicy.pollTaxRate + taxPolicy.landTaxRate + taxPolicy.tradeTaxRate) / 3;
  const happinessImpact = avgTaxRate > 30 ? -Math.floor((avgTaxRate - 30) / 5) : 0;

  if (happinessImpact !== taxPolicy.happinessImpact) {
    await ctx.db.patch(taxPolicy._id, { happinessImpact });
  }

  // Events
  if (totalCollected > taxPolicy.lastCollectionAmount * 1.2) {
    events.push({
      type: "tax_increase",
      description: `Tax revenue increased to ${totalCollected} coins this month!`,
    });
  }

  if (avgTaxRate > 50) {
    events.push({
      type: "tax_burden",
      description: "Heavy taxation is causing unrest among the people.",
    });
  }

  return { events, totalCollected };
}

// =============================================
// CALCULATE EXPENSES
// =============================================

async function calculateExpenses(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  tick: number
): Promise<{
  events: Array<{ type: string; description: string }>;
  totalExpenses: number;
  militarySpending: number;
}> {
  const events: Array<{ type: string; description: string }> = [];

  const territory = await ctx.db.get(territoryId);
  if (!territory) return { events, totalExpenses: 0, militarySpending: 0 };

  const treasury = await ctx.db
    .query("treasury")
    .withIndex("by_territory", (q: any) => q.eq("territoryId", territoryId))
    .first();

  if (!treasury) return { events, totalExpenses: 0, militarySpending: 0 };

  const laborMarket = await ctx.db
    .query("laborMarket")
    .withIndex("by_territory", (q: any) => q.eq("territoryId", territoryId))
    .first();

  // Military expenses (soldier pay)
  const militarySpending = Math.floor(territory.military * (laborMarket?.soldierPay || 10));

  // Building maintenance
  const buildings = await ctx.db
    .query("buildings")
    .withIndex("by_territory", (q: any) => q.eq("territoryId", territoryId))
    .collect();
  const maintenanceCost = buildings.reduce((sum, b) => sum + (b.maintenanceCost || 1), 0);

  // Court expenses (characters)
  const characters = await ctx.db
    .query("characters")
    .withIndex("by_territory", (q: any) => q.eq("territoryId", territoryId))
    .filter((q: any) => q.eq(q.field("isAlive"), true))
    .collect();
  const courtExpenses = characters.filter(c => c.role !== "commoner").length * 5;

  // Infrastructure maintenance
  const infrastructure = await ctx.db
    .query("infrastructure")
    .withIndex("by_territory", (q: any) => q.eq("territoryId", territoryId))
    .collect();
  const infraMaintenance = infrastructure.reduce((sum, i) => sum + (i.maintenanceCost || 2), 0);

  const totalExpenses = militarySpending + maintenanceCost + courtExpenses + infraMaintenance;

  // Deduct from treasury
  let copperToDeduct = totalExpenses;
  let newCopperCoins = treasury.copperCoins;
  let newSilverCoins = treasury.silverCoins;
  let newGoldCoins = treasury.goldCoins;

  // Try to pay with copper first
  if (newCopperCoins >= copperToDeduct) {
    newCopperCoins -= copperToDeduct;
    copperToDeduct = 0;
  } else {
    copperToDeduct -= newCopperCoins;
    newCopperCoins = 0;

    // Convert silver to copper if needed
    const silverNeeded = Math.ceil(copperToDeduct / 100);
    if (newSilverCoins >= silverNeeded) {
      newSilverCoins -= silverNeeded;
      newCopperCoins = silverNeeded * 100 - copperToDeduct;
      copperToDeduct = 0;
    } else {
      copperToDeduct -= newSilverCoins * 100;
      newSilverCoins = 0;

      // Convert gold to silver if needed
      const goldNeeded = Math.ceil(copperToDeduct / 1000);
      if (newGoldCoins >= goldNeeded) {
        newGoldCoins -= goldNeeded;
        const silverFromGold = goldNeeded * 10;
        const copperFromSilver = (silverFromGold * 100) - copperToDeduct;
        newSilverCoins = Math.floor(copperFromSilver / 100);
        newCopperCoins = copperFromSilver % 100;
      } else {
        // Can't pay! This is a crisis
        events.push({
          type: "treasury_empty",
          description: "Treasury is empty! Cannot pay expenses!",
        });
        newGoldCoins = 0;
        // Increase debt
        const deficit = copperToDeduct;
        await ctx.db.patch(treasury._id, {
          totalDebt: treasury.totalDebt + deficit,
        });
      }
    }
  }

  await ctx.db.patch(treasury._id, {
    copperCoins: newCopperCoins,
    silverCoins: newSilverCoins,
    goldCoins: newGoldCoins,
  });

  // Check for military payment issues
  if (militarySpending > treasury.copperCoins + treasury.silverCoins * 100) {
    events.push({
      type: "military_payment_crisis",
      description: "Cannot afford to pay the soldiers! Risk of desertion or mutiny.",
    });
  }

  return { events, totalExpenses, militarySpending };
}

// =============================================
// PROCESS LOANS
// =============================================

async function processLoans(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  tick: number
): Promise<{
  events: Array<{ type: string; description: string }>;
  interestPaid: number;
}> {
  const events: Array<{ type: string; description: string }> = [];
  let interestPaid = 0;

  const loans = await ctx.db
    .query("loans")
    .withIndex("by_borrower", (q: any) => q.eq("borrowerTerritoryId", territoryId))
    .filter((q: any) => q.eq(q.field("status"), "active"))
    .collect();

  const treasury = await ctx.db
    .query("treasury")
    .withIndex("by_territory", (q: any) => q.eq("territoryId", territoryId))
    .first();

  if (!treasury) return { events, interestPaid: 0 };

  for (const loan of loans) {
    // Calculate monthly interest (annual / 12)
    const monthlyInterest = Math.floor(loan.remainingAmount * (loan.interestRate / 100) / 12);
    const payment = loan.monthlyPayment;
    const totalDue = payment + monthlyInterest;

    // Try to pay
    const canPay = treasury.copperCoins + treasury.silverCoins * 100 >= totalDue;

    if (canPay) {
      // Make payment
      let remaining = totalDue;
      let newCopper = treasury.copperCoins;
      let newSilver = treasury.silverCoins;

      if (newCopper >= remaining) {
        newCopper -= remaining;
      } else {
        remaining -= newCopper;
        newCopper = 0;
        const silverNeeded = Math.ceil(remaining / 100);
        newSilver -= silverNeeded;
        newCopper = silverNeeded * 100 - remaining;
      }

      await ctx.db.patch(treasury._id, {
        copperCoins: newCopper,
        silverCoins: newSilver,
      });

      // Update loan
      const newRemaining = Math.max(0, loan.remainingAmount - payment);

      if (newRemaining === 0) {
        await ctx.db.patch(loan._id, {
          remainingAmount: 0,
          status: "paid",
        });
        events.push({
          type: "loan_paid",
          description: `Fully repaid loan from ${loan.lenderName}!`,
        });
      } else {
        await ctx.db.patch(loan._id, {
          remainingAmount: newRemaining,
        });
      }

      interestPaid += monthlyInterest;
    } else {
      // Missed payment!
      const newMissedPayments = loan.missedPayments + 1;
      await ctx.db.patch(loan._id, {
        missedPayments: newMissedPayments,
      });

      if (newMissedPayments >= 3) {
        // Default!
        await ctx.db.patch(loan._id, {
          status: "defaulted",
        });

        // Damage credit rating
        await ctx.db.patch(treasury._id, {
          creditRating: Math.max(0, treasury.creditRating - 20),
        });

        events.push({
          type: "loan_default",
          description: `Defaulted on loan from ${loan.lenderName}! Credit rating damaged severely.`,
        });
      } else {
        events.push({
          type: "missed_payment",
          description: `Missed payment on loan from ${loan.lenderName}. ${3 - newMissedPayments} more and we default!`,
        });
      }
    }

    // Check if loan is overdue
    if (tick > loan.dueByTick && loan.status === "active") {
      events.push({
        type: "loan_overdue",
        description: `Loan from ${loan.lenderName} is overdue! Interest accumulating.`,
      });
      // Increase interest rate as penalty
      await ctx.db.patch(loan._id, {
        interestRate: loan.interestRate + 2,
      });
    }
  }

  // Update total debt
  const activeLoans = loans.filter(l => l.status === "active");
  const totalDebt = activeLoans.reduce((sum, l) => sum + l.remainingAmount, 0);
  const avgInterest = activeLoans.length > 0
    ? activeLoans.reduce((sum, l) => sum + l.interestRate, 0) / activeLoans.length
    : 0;

  await ctx.db.patch(treasury._id, {
    totalDebt,
    debtInterestRate: avgInterest,
  });

  return { events, interestPaid };
}

// =============================================
// UPDATE INFLATION
// =============================================

async function updateInflation(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  tick: number
): Promise<{
  events: Array<{ type: string; description: string }>;
}> {
  const events: Array<{ type: string; description: string }> = [];

  const treasury = await ctx.db
    .query("treasury")
    .withIndex("by_territory", (q: any) => q.eq("territoryId", territoryId))
    .first();

  if (!treasury) return { events };

  const territory = await ctx.db.get(territoryId);
  if (!territory) return { events };

  // Factors affecting inflation:
  // 1. Money supply growth (minting coins)
  // 2. Currency debasement
  // 3. War/crisis
  // 4. Trade balance

  let inflationChange = 0;

  // Debasement causes inflation
  if (treasury.debasementLevel > 20) {
    inflationChange += treasury.debasementLevel * 0.1;
  }

  // Low food causes price increases
  if (territory.food < 30) {
    inflationChange += (30 - territory.food) * 0.2;
  }

  // High debt causes inflation
  const debtRatio = treasury.totalDebt / Math.max(1, treasury.silverCoins * 100 + treasury.copperCoins);
  if (debtRatio > 0.5) {
    inflationChange += debtRatio * 5;
  }

  // Natural deflation over time if economy is stable
  if (territory.happiness > 60 && territory.food > 50) {
    inflationChange -= 1;
  }

  // Update inflation rate (bounded)
  const newInflation = Math.max(-10, Math.min(100, treasury.inflationRate + inflationChange));

  await ctx.db.patch(treasury._id, {
    inflationRate: newInflation,
  });

  // Events
  if (newInflation > 30 && treasury.inflationRate <= 30) {
    events.push({
      type: "high_inflation",
      description: "Prices are rising rapidly! People can barely afford basic goods.",
    });
  }

  if (newInflation > 60) {
    events.push({
      type: "hyperinflation",
      description: "HYPERINFLATION! Currency is becoming worthless. Economic collapse imminent!",
    });
  }

  if (newInflation < -5) {
    events.push({
      type: "deflation",
      description: "Deflation is setting in. People are hoarding money instead of spending.",
    });
  }

  return { events };
}

// =============================================
// CHECK ECONOMIC PHASE
// =============================================

async function checkEconomicPhase(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  tick: number
): Promise<{
  events: Array<{ type: string; description: string }>;
}> {
  const events: Array<{ type: string; description: string }> = [];

  const treasury = await ctx.db
    .query("treasury")
    .withIndex("by_territory", (q: any) => q.eq("territoryId", territoryId))
    .first();

  if (!treasury) return { events };

  const territory = await ctx.db.get(territoryId);
  if (!territory) return { events };

  const currentPhase = treasury.economicPhase;
  const phases: Array<"barter" | "commodity" | "coined" | "banking" | "paper" | "modern"> =
    ["barter", "commodity", "coined", "banking", "paper", "modern"];
  const currentIndex = phases.indexOf(currentPhase);

  if (currentIndex < phases.length - 1) {
    const nextPhase = phases[currentIndex + 1];
    const requirements = PHASE_REQUIREMENTS[nextPhase];

    if (territory.technology >= requirements.technology &&
        territory.population >= requirements.population) {
      // Can upgrade!
      await ctx.db.patch(treasury._id, {
        economicPhase: nextPhase,
      });

      const phaseNames: Record<string, string> = {
        commodity: "Commodity Money",
        coined: "Coined Currency",
        banking: "Banking System",
        paper: "Paper Money",
        modern: "Modern Finance",
      };

      events.push({
        type: "economic_advancement",
        description: `Economic system advanced to ${phaseNames[nextPhase]}! New financial options available.`,
      });

      // Initialize currency if advancing to coined
      if (nextPhase === "coined") {
        const existingCurrency = await ctx.db
          .query("currencies")
          .withIndex("by_territory", (q: any) => q.eq("territoryId", territoryId))
          .first();

        if (!existingCurrency) {
          await ctx.db.insert("currencies", {
            territoryId,
            name: `${territory.name} Currency`,
            goldCoinName: "Gold Crown",
            silverCoinName: "Silver Mark",
            copperCoinName: "Copper Penny",
            goldPurity: 90,
            silverPurity: 80,
            copperPurity: 70,
            goldToSilverRatio: 10,
            silverToCopperRatio: 100,
            foreignAcceptance: 30,
            counterfeiting: 5,
            foundedTick: tick,
          });
        }
      }

      // Initialize bank if advancing to banking
      if (nextPhase === "banking") {
        await ctx.db.insert("banks", {
          territoryId,
          name: `${territory.name} Merchant Bank`,
          type: "merchant_bank",
          foundedTick: tick,
          deposits: 0,
          reserves: 100,
          loansOutstanding: 0,
          depositInterestRate: 2,
          loanInterestRate: 8,
          reserveRatio: 20,
          stability: 70,
          publicTrust: 50,
          status: "active",
        });
      }
    }
  }

  return { events };
}

// =============================================
// UPDATE LABOR MARKET
// =============================================

async function updateLaborMarket(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  tick: number
): Promise<void> {
  const laborMarket = await ctx.db
    .query("laborMarket")
    .withIndex("by_territory", (q: any) => q.eq("territoryId", territoryId))
    .first();

  if (!laborMarket) return;

  const territory = await ctx.db.get(territoryId);
  if (!territory) return;

  const treasury = await ctx.db
    .query("treasury")
    .withIndex("by_territory", (q: any) => q.eq("territoryId", territoryId))
    .first();

  // Calculate unemployment based on economic activity
  let unemployment = 10; // Base

  // More buildings = more jobs
  const buildings = await ctx.db
    .query("buildings")
    .withIndex("by_territory", (q: any) => q.eq("territoryId", territoryId))
    .collect();
  unemployment -= Math.min(5, buildings.length);

  // Trade creates jobs
  const tradeRoutes = await ctx.db
    .query("tradeRoutes")
    .filter((q: any) => q.or(
      q.eq(q.field("territory1Id"), territoryId),
      q.eq(q.field("territory2Id"), territoryId)
    ))
    .collect();
  unemployment -= Math.min(3, tradeRoutes.length);

  // Military employment
  unemployment -= Math.min(5, territory.military / 20);

  // High population without industry = unemployment
  if (territory.population > 200 && buildings.length < 5) {
    unemployment += 10;
  }

  unemployment = Math.max(0, Math.min(50, unemployment));

  // Adjust wages based on supply/demand
  const laborShortage = unemployment < 5;
  let wageMultiplier = 1;

  if (laborShortage) {
    wageMultiplier = 1.2; // Wages rise
  } else if (unemployment > 20) {
    wageMultiplier = 0.8; // Wages fall
  }

  // Inflation affects wages
  if (treasury && treasury.inflationRate > 10) {
    wageMultiplier *= 1 + (treasury.inflationRate / 100);
  }

  // Work conditions based on wealth and happiness
  let conditions: "harsh" | "poor" | "fair" | "good" | "excellent" = "poor";
  if (territory.happiness > 80 && territory.wealth > 60) {
    conditions = "excellent";
  } else if (territory.happiness > 60 && territory.wealth > 40) {
    conditions = "good";
  } else if (territory.happiness > 40) {
    conditions = "fair";
  } else if (territory.happiness < 20) {
    conditions = "harsh";
  }

  await ctx.db.patch(laborMarket._id, {
    unemploymentRate: unemployment,
    laborShortage,
    unskilledWage: Math.floor(laborMarket.unskilledWage * wageMultiplier),
    skilledWage: Math.floor(laborMarket.skilledWage * wageMultiplier),
    professionalWage: Math.floor(laborMarket.professionalWage * wageMultiplier),
    workConditions: conditions,
    lastUpdatedTick: tick,
  });
}

// =============================================
// ECONOMY ACTION HANDLERS
// =============================================

// Mint coins from metal reserves
export async function mintCoins(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  metalType: "gold" | "silver" | "copper",
  amount: number,
  tick: number
): Promise<{ success: boolean; message: string; coinsCreated: number }> {
  const treasury = await ctx.db
    .query("treasury")
    .withIndex("by_territory", (q: any) => q.eq("territoryId", territoryId))
    .first();

  if (!treasury) {
    return { success: false, message: "No treasury found", coinsCreated: 0 };
  }

  if (treasury.economicPhase === "barter") {
    return { success: false, message: "Cannot mint coins in barter economy", coinsCreated: 0 };
  }

  const reserves = metalType === "gold" ? treasury.goldReserves :
                   metalType === "silver" ? treasury.silverReserves :
                   treasury.copperReserves;

  if (reserves < amount) {
    return { success: false, message: `Not enough ${metalType} reserves`, coinsCreated: 0 };
  }

  // Deduct reserves, add coins
  const updates: any = {};

  if (metalType === "gold") {
    updates.goldReserves = treasury.goldReserves - amount;
    updates.goldCoins = treasury.goldCoins + amount;
  } else if (metalType === "silver") {
    updates.silverReserves = treasury.silverReserves - amount;
    updates.silverCoins = treasury.silverCoins + amount;
  } else {
    updates.copperReserves = treasury.copperReserves - amount;
    updates.copperCoins = treasury.copperCoins + amount;
  }

  // Minting too much causes inflation
  const totalMoney = treasury.goldCoins * 1000 + treasury.silverCoins * 100 + treasury.copperCoins;
  const mintedValue = metalType === "gold" ? amount * 1000 : metalType === "silver" ? amount * 100 : amount;

  if (mintedValue > totalMoney * 0.1) {
    updates.inflationRate = Math.min(100, treasury.inflationRate + mintedValue / 100);
  }

  await ctx.db.patch(treasury._id, updates);

  return {
    success: true,
    message: `Minted ${amount} ${metalType} coins`,
    coinsCreated: amount,
  };
}

// Debase currency (mix with cheaper metals)
export async function debaseCurrency(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  debasementAmount: number, // 1-20% debasement
  tick: number
): Promise<{ success: boolean; message: string; shortTermGain: number }> {
  const treasury = await ctx.db
    .query("treasury")
    .withIndex("by_territory", (q: any) => q.eq("territoryId", territoryId))
    .first();

  if (!treasury) {
    return { success: false, message: "No treasury found", shortTermGain: 0 };
  }

  if (treasury.debasementLevel >= 80) {
    return { success: false, message: "Currency already heavily debased", shortTermGain: 0 };
  }

  const currency = await ctx.db
    .query("currencies")
    .withIndex("by_territory", (q: any) => q.eq("territoryId", territoryId))
    .first();

  // Calculate short-term gain (more coins from same metal)
  const shortTermGain = Math.floor((treasury.silverCoins * debasementAmount) / 100);

  // Update treasury
  await ctx.db.patch(treasury._id, {
    silverCoins: treasury.silverCoins + shortTermGain,
    debasementLevel: Math.min(100, treasury.debasementLevel + debasementAmount),
    inflationRate: treasury.inflationRate + debasementAmount * 0.5,
  });

  // Reduce currency purity and foreign acceptance
  if (currency) {
    await ctx.db.patch(currency._id, {
      silverPurity: Math.max(10, currency.silverPurity - debasementAmount),
      foreignAcceptance: Math.max(0, currency.foreignAcceptance - debasementAmount * 2),
    });
  }

  return {
    success: true,
    message: `Debased currency by ${debasementAmount}%. Short-term gain but long-term inflation risk!`,
    shortTermGain,
  };
}

// Take out a loan
export async function takeLoan(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  amount: number,
  lenderType: "merchant_guild" | "temple" | "foreign_territory" | "noble_family" | "bank",
  tick: number
): Promise<{ success: boolean; message: string; interestRate: number }> {
  const treasury = await ctx.db
    .query("treasury")
    .withIndex("by_territory", (q: any) => q.eq("territoryId", territoryId))
    .first();

  if (!treasury) {
    return { success: false, message: "No treasury found", interestRate: 0 };
  }

  // Interest rate based on credit rating
  let baseRate = lenderType === "temple" ? 5 :
                 lenderType === "merchant_guild" ? 10 :
                 lenderType === "bank" ? 8 : 12;

  // Poor credit = higher rates
  if (treasury.creditRating < 30) {
    baseRate += 10;
  } else if (treasury.creditRating < 50) {
    baseRate += 5;
  } else if (treasury.creditRating > 80) {
    baseRate -= 2;
  }

  // High debt = higher rates
  if (treasury.totalDebt > amount) {
    baseRate += 5;
  }

  // Can't borrow if credit is too bad
  if (treasury.creditRating < 20 && lenderType !== "temple") {
    return { success: false, message: "Credit rating too low - no one will lend", interestRate: 0 };
  }

  const lenderNames: Record<string, string> = {
    merchant_guild: "Merchant Guild of Commerce",
    temple: "Temple Treasury",
    foreign_territory: "Foreign Lenders",
    noble_family: "House of Wealthy Nobles",
    bank: "Central Bank",
  };

  // Create loan
  await ctx.db.insert("loans", {
    borrowerTerritoryId: territoryId,
    lenderType,
    lenderName: lenderNames[lenderType],
    principalAmount: amount,
    remainingAmount: amount,
    interestRate: baseRate,
    monthlyPayment: Math.ceil(amount / 12),
    startTick: tick,
    dueByTick: tick + 24, // 2 years to repay
    status: "active",
    missedPayments: 0,
  });

  // Add money to treasury
  const copperAmount = amount;
  await ctx.db.patch(treasury._id, {
    copperCoins: treasury.copperCoins + copperAmount,
    totalDebt: treasury.totalDebt + amount,
  });

  return {
    success: true,
    message: `Borrowed ${amount} coins from ${lenderNames[lenderType]} at ${baseRate}% interest`,
    interestRate: baseRate,
  };
}

// Set tax rates
export async function setTaxRates(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  taxType: "land" | "trade" | "poll" | "luxury",
  newRate: number
): Promise<{ success: boolean; message: string }> {
  const taxPolicy = await ctx.db
    .query("taxPolicy")
    .withIndex("by_territory", (q: any) => q.eq("territoryId", territoryId))
    .first();

  if (!taxPolicy) {
    return { success: false, message: "No tax policy found" };
  }

  // Bound rates
  const rate = Math.max(0, Math.min(80, newRate));

  const updates: any = {};
  if (taxType === "land") updates.landTaxRate = rate;
  else if (taxType === "trade") updates.tradeTaxRate = rate;
  else if (taxType === "poll") updates.pollTaxRate = rate;
  else if (taxType === "luxury") updates.luxuryTaxRate = rate;

  // Calculate happiness impact
  const avgRate = (
    (updates.landTaxRate ?? taxPolicy.landTaxRate) +
    (updates.tradeTaxRate ?? taxPolicy.tradeTaxRate) +
    (updates.pollTaxRate ?? taxPolicy.pollTaxRate)
  ) / 3;

  updates.happinessImpact = avgRate > 30 ? -Math.floor((avgRate - 30) / 3) : 0;

  await ctx.db.patch(taxPolicy._id, updates);

  const impact = rate > 40 ? "People are unhappy with high taxes." :
                 rate < 10 ? "Low taxes please the people but reduce revenue." :
                 "Tax rate set to reasonable level.";

  return {
    success: true,
    message: `Set ${taxType} tax to ${rate}%. ${impact}`,
  };
}

// Establish price controls
export async function setPriceControl(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  goodType: string,
  controlType: "maximum" | "minimum" | "fixed",
  price: number,
  tick: number
): Promise<{ success: boolean; message: string }> {
  // Check for existing control
  const existing = await ctx.db
    .query("priceControls")
    .withIndex("by_territory", (q: any) => q.eq("territoryId", territoryId))
    .filter((q: any) => q.and(
      q.eq(q.field("goodType"), goodType),
      q.eq(q.field("status"), "active")
    ))
    .first();

  if (existing) {
    await ctx.db.patch(existing._id, {
      controlType,
      controlledPrice: price,
    });
  } else {
    await ctx.db.insert("priceControls", {
      territoryId,
      goodType,
      controlType,
      controlledPrice: price,
      marketPrice: price * 1.2, // Assume market is higher
      effectivenesss: 60,
      blackMarketSize: 10,
      startTick: tick,
      status: "active",
    });
  }

  return {
    success: true,
    message: `Set ${controlType} price of ${price} for ${goodType}. Black market may develop if control is too strict.`,
  };
}

// =============================================
// GET ECONOMY CONTEXT FOR AI
// =============================================

export async function getEconomyContext(
  ctx: QueryCtx,
  territoryId: Id<"territories">
): Promise<{
  treasury: {
    goldCoins: number;
    silverCoins: number;
    copperCoins: number;
    totalValue: number;
    debt: number;
    creditRating: number;
  };
  economicPhase: string;
  inflation: number;
  debasement: number;
  taxes: {
    landRate: number;
    tradeRate: number;
    pollRate: number;
    efficiency: number;
    lastRevenue: number;
  };
  loans: Array<{
    lender: string;
    amount: number;
    interest: number;
    status: string;
  }>;
  laborMarket: {
    unemployment: number;
    avgWage: number;
    conditions: string;
  };
  monthlyBalance: number;
  economicHealth: string;
} | null> {
  const treasury = await ctx.db
    .query("treasury")
    .withIndex("by_territory", (q: any) => q.eq("territoryId", territoryId))
    .first();

  if (!treasury) return null;

  const taxPolicy = await ctx.db
    .query("taxPolicy")
    .withIndex("by_territory", (q: any) => q.eq("territoryId", territoryId))
    .first();

  const loans = await ctx.db
    .query("loans")
    .withIndex("by_borrower", (q: any) => q.eq("borrowerTerritoryId", territoryId))
    .filter((q: any) => q.eq(q.field("status"), "active"))
    .collect();

  const laborMarket = await ctx.db
    .query("laborMarket")
    .withIndex("by_territory", (q: any) => q.eq("territoryId", territoryId))
    .first();

  // Calculate total value (in copper equivalent)
  const totalValue = treasury.goldCoins * 1000 + treasury.silverCoins * 100 + treasury.copperCoins;

  // Determine economic health
  let health = "stable";
  if (treasury.inflationRate > 30 || treasury.totalDebt > totalValue * 2) {
    health = "crisis";
  } else if (treasury.inflationRate > 15 || treasury.lastMonthBalance < -20) {
    health = "struggling";
  } else if (treasury.lastMonthBalance > 30 && treasury.creditRating > 70) {
    health = "prosperous";
  }

  return {
    treasury: {
      goldCoins: treasury.goldCoins,
      silverCoins: treasury.silverCoins,
      copperCoins: treasury.copperCoins,
      totalValue,
      debt: treasury.totalDebt,
      creditRating: treasury.creditRating,
    },
    economicPhase: treasury.economicPhase,
    inflation: treasury.inflationRate,
    debasement: treasury.debasementLevel,
    taxes: {
      landRate: taxPolicy?.landTaxRate || 10,
      tradeRate: taxPolicy?.tradeTaxRate || 5,
      pollRate: taxPolicy?.pollTaxRate || 2,
      efficiency: taxPolicy?.collectionEfficiency || 50,
      lastRevenue: taxPolicy?.lastCollectionAmount || 0,
    },
    loans: loans.map(l => ({
      lender: l.lenderName,
      amount: l.remainingAmount,
      interest: l.interestRate,
      status: l.missedPayments > 0 ? "behind" : "current",
    })),
    laborMarket: {
      unemployment: laborMarket?.unemploymentRate || 10,
      avgWage: laborMarket?.skilledWage || 8,
      conditions: laborMarket?.workConditions || "fair",
    },
    monthlyBalance: treasury.lastMonthBalance,
    economicHealth: health,
  };
}
