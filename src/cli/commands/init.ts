import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createInterface } from "readline";
import { cliLogger } from "../../core/logger.js";
import { seedSampleData, getDb, setSetting } from "../../db/index.js";

// Simple prompt helper
async function prompt(question: string, defaultValue: string = ""): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    const defaultHint = defaultValue ? ` (${defaultValue})` : "";
    rl.question(`${question}${defaultHint}: `, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultValue);
    });
  });
}

// Interactive onboarding
async function runOnboarding(): Promise<void> {
  console.log("\n\x1b[1m\x1b[34mWelcome to OpenAccounting!\x1b[0m\n");
  console.log("Let's set up your business profile.\n");

  // Business name
  const businessName = await prompt("Business name", "My Business");
  setSetting("business_name", businessName);

  // Entity type
  console.log("\nEntity types: LLC, Inc, Corp, Sole Proprietor, Partnership, or leave blank");
  const entityType = await prompt("Entity type", "");
  setSetting("entity_type", entityType);

  // Owner name
  const ownerName = await prompt("Owner/Contact name", "");
  setSetting("owner_name", ownerName);

  // Fiscal year end
  console.log("\nFiscal year end month (1-12, e.g., 12 for December)");
  const fiscalYearEnd = await prompt("Fiscal year end month", "12");
  setSetting("fiscal_year_end", fiscalYearEnd);

  // Currency
  const currency = await prompt("Currency", "USD");
  setSetting("currency", currency);

  console.log("\n\x1b[32m✓ Business profile saved!\x1b[0m\n");
}

// Generate sample ledger with realistic transactions
function generateSampleLedger(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;

  const formatDate = (y: number, m: number, d: number) =>
    `${y}/${String(m).padStart(2, "0")}/${String(d).padStart(2, "0")}`;

  // Current month transactions
  const currentTransactions = [
    { day: 1, desc: "Monthly Salary", amount: 5000, account: "Income:Salary", asset: "Assets:Checking" },
    { day: 2, desc: "Rent Payment", amount: -1500, account: "Expenses:Housing:Rent", asset: "Assets:Checking" },
    { day: 3, desc: "Grocery Store", amount: -85.50, account: "Expenses:Food:Groceries", asset: "Assets:Checking" },
    { day: 5, desc: "Electric Bill", amount: -120, account: "Expenses:Utilities:Electric", asset: "Assets:Checking" },
    { day: 6, desc: "Coffee Shop", amount: -6.50, account: "Expenses:Food:Coffee", asset: "Assets:Checking" },
    { day: 7, desc: "Internet Service", amount: -80, account: "Expenses:Utilities:Internet", asset: "Assets:Checking" },
    { day: 8, desc: "Uber Ride", amount: -24, account: "Expenses:Transport:Rideshare", asset: "Assets:Checking" },
    { day: 10, desc: "Restaurant Dinner", amount: -65, account: "Expenses:Food:Restaurants", asset: "Assets:Checking" },
    { day: 12, desc: "Amazon Purchase", amount: -45.99, account: "Expenses:Shopping:Online", asset: "Assets:Checking" },
    { day: 14, desc: "Gas Station", amount: -55, account: "Expenses:Transport:Gas", asset: "Assets:Checking" },
    { day: 15, desc: "Freelance Payment", amount: 800, account: "Income:Freelance", asset: "Assets:Checking" },
    { day: 16, desc: "Gym Membership", amount: -50, account: "Expenses:Health:Fitness", asset: "Assets:Checking" },
    { day: 18, desc: "Netflix Subscription", amount: -15.99, account: "Expenses:Entertainment:Streaming", asset: "Assets:Checking" },
    { day: 19, desc: "Coffee Shop", amount: -5.75, account: "Expenses:Food:Coffee", asset: "Assets:Checking" },
    { day: 20, desc: "Grocery Store", amount: -120, account: "Expenses:Food:Groceries", asset: "Assets:Checking" },
  ];

  // Previous month transactions
  const prevTransactions = [
    { day: 1, desc: "Monthly Salary", amount: 5000, account: "Income:Salary", asset: "Assets:Checking" },
    { day: 2, desc: "Rent Payment", amount: -1500, account: "Expenses:Housing:Rent", asset: "Assets:Checking" },
    { day: 4, desc: "Grocery Store", amount: -95, account: "Expenses:Food:Groceries", asset: "Assets:Checking" },
    { day: 6, desc: "Electric Bill", amount: -110, account: "Expenses:Utilities:Electric", asset: "Assets:Checking" },
    { day: 8, desc: "Restaurant", amount: -45, account: "Expenses:Food:Restaurants", asset: "Assets:Checking" },
    { day: 10, desc: "Coffee Shop", amount: -12, account: "Expenses:Food:Coffee", asset: "Assets:Checking" },
    { day: 12, desc: "Gas Station", amount: -48, account: "Expenses:Transport:Gas", asset: "Assets:Checking" },
    { day: 15, desc: "Internet Service", amount: -80, account: "Expenses:Utilities:Internet", asset: "Assets:Checking" },
    { day: 18, desc: "Grocery Store", amount: -88, account: "Expenses:Food:Groceries", asset: "Assets:Checking" },
    { day: 20, desc: "Gym Membership", amount: -50, account: "Expenses:Health:Fitness", asset: "Assets:Checking" },
  ];

  let ledger = "; OpenAccounting Sample Ledger\n; Generated for demo purposes\n\n";

  // Add previous month
  for (const tx of prevTransactions) {
    const date = formatDate(prevYear, prevMonth, tx.day);
    const amountStr = Math.abs(tx.amount).toFixed(2);
    // Put amounts on Income/Expense accounts so they're tracked correctly
    ledger += `${date} ${tx.desc}\n    ${tx.account}  $${amountStr}\n    ${tx.asset}\n\n`;
  }

  // Add current month
  for (const tx of currentTransactions) {
    const date = formatDate(year, month, tx.day);
    const amountStr = Math.abs(tx.amount).toFixed(2);
    ledger += `${date} ${tx.desc}\n    ${tx.account}  $${amountStr}\n    ${tx.asset}\n\n`;
  }

  return ledger;
}

export async function init(options: { silent?: boolean; demo?: boolean } = {}): Promise<boolean> {
  const { silent = false, demo = false } = options;

  if (existsSync("oa-workspace.json")) {
    if (!silent) {
      cliLogger.warn("Workspace already initialized");
    }
    return false;
  }

  const config = {
    name: "my-finances",
    jurisdiction: "US",
    currency: "USD",
    sources: [
      {
        id: "bank-main",
        path: "data/bank.csv",
        type: "bank_csv",
      },
    ],
    ledger: {
      path: "ledger/main.ledger",
      format: "ledger_cli",
    },
  };

  cliLogger.debug("Creating workspace directories");
  await mkdir("data", { recursive: true });
  await mkdir("ledger", { recursive: true });
  await writeFile("oa-workspace.json", JSON.stringify(config, null, 2));

  // Create sample ledger with transactions
  const sampleLedger = generateSampleLedger();
  await writeFile("ledger/main.ledger", sampleLedger);

  // Initialize database to create tables
  getDb();

  // Run interactive onboarding (unless silent)
  if (!silent) {
    await runOnboarding();
  }

  // Seed demo data if requested
  if (demo) {
    seedSampleData();
    cliLogger.info("Demo data added (sample customers, vendors, invoices, expenses)");
  }

  cliLogger.info({ configFile: "oa-workspace.json" }, "Workspace initialized");
  return true;
}

// Auto-initialize if workspace doesn't exist
export async function ensureWorkspace(): Promise<boolean> {
  if (existsSync("oa-workspace.json")) {
    return false;
  }
  return init({ silent: true });
}
