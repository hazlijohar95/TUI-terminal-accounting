// First-run setup wizard
import * as p from "@clack/prompts";
import pc from "picocolors";
import { existsSync, writeFileSync, readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { setSetting, getSetting } from "../../db/index.js";
import { createCustomer } from "../../domain/customers.js";
import { createInvoice } from "../../domain/invoices.js";
import { recordExpense } from "../../domain/payments.js";

// Check if this is first run
export function isFirstRun(): boolean {
  const isConfigured = getSetting("_initialized");
  return isConfigured !== "true";
}

// Run the setup wizard
export async function runSetupWizard(): Promise<void> {
  console.clear();

  p.intro(pc.bgCyan(pc.black(" Welcome to OpenAccounting ")));

  console.log();
  console.log(pc.dim("  Let's get you set up in just a minute."));
  console.log();

  // Business name
  const businessName = await p.text({
    message: "What's your business name?",
    placeholder: "Acme Inc",
    validate: (value) => {
      if (!value) return "Please enter a business name";
      return undefined;
    },
  });

  if (p.isCancel(businessName)) {
    p.cancel("Setup cancelled");
    process.exit(0);
  }

  // Currency
  const currency = await p.select({
    message: "What currency do you use?",
    options: [
      { value: "USD", label: "USD - US Dollar" },
      { value: "EUR", label: "EUR - Euro" },
      { value: "GBP", label: "GBP - British Pound" },
      { value: "MYR", label: "MYR - Malaysian Ringgit" },
      { value: "SGD", label: "SGD - Singapore Dollar" },
      { value: "AUD", label: "AUD - Australian Dollar" },
      { value: "CAD", label: "CAD - Canadian Dollar" },
    ],
  });

  if (p.isCancel(currency)) {
    p.cancel("Setup cancelled");
    process.exit(0);
  }

  // Invoice prefix
  const invoicePrefix = await p.text({
    message: "Invoice number prefix?",
    placeholder: "INV",
    initialValue: "INV",
  });

  if (p.isCancel(invoicePrefix)) {
    p.cancel("Setup cancelled");
    process.exit(0);
  }

  // OpenAI API key
  const hasApiKey = await p.confirm({
    message: "Do you have an OpenAI API key for AI features?",
    initialValue: true,
  });

  if (p.isCancel(hasApiKey)) {
    p.cancel("Setup cancelled");
    process.exit(0);
  }

  let apiKey = "";
  if (hasApiKey) {
    const keyInput = await p.text({
      message: "Enter your OpenAI API key:",
      placeholder: "sk-...",
      validate: (value) => {
        if (!value) return "Please enter your API key";
        if (!value.startsWith("sk-")) return "API key should start with sk-";
        return undefined;
      },
    });

    if (p.isCancel(keyInput)) {
      p.cancel("Setup cancelled");
      process.exit(0);
    }

    apiKey = keyInput as string;
  }

  // Sample data
  const addSampleData = await p.confirm({
    message: "Add sample data to get started?",
    initialValue: true,
  });

  if (p.isCancel(addSampleData)) {
    p.cancel("Setup cancelled");
    process.exit(0);
  }

  // Save settings
  const s = p.spinner();
  s.start("Saving your settings...");

  setSetting("business_name", businessName as string);
  setSetting("currency", currency as string);
  setSetting("invoice_prefix", invoicePrefix as string);

  // Save API key to .env file
  if (apiKey) {
    const envPath = join(process.cwd(), ".env");
    let envContent = "";

    if (existsSync(envPath)) {
      envContent = readFileSync(envPath, "utf-8");
      // Update existing key or add new
      if (envContent.includes("OPENAI_API_KEY=")) {
        envContent = envContent.replace(/OPENAI_API_KEY=.*/g, `OPENAI_API_KEY=${apiKey}`);
      } else {
        envContent += `\nOPENAI_API_KEY=${apiKey}`;
      }
    } else {
      envContent = `OPENAI_API_KEY=${apiKey}\n`;
    }

    writeFileSync(envPath, envContent);
  }

  // Add sample data
  if (addSampleData) {
    await createSampleData();
  }

  // Mark setup as complete
  setSetting("_initialized", "true");

  s.stop("Settings saved!");

  // Show summary
  console.log();
  p.note(
    `Business: ${businessName}\n` +
    `Currency: ${currency}\n` +
    `Invoice prefix: ${invoicePrefix}\n` +
    `AI features: ${apiKey ? "Enabled" : "Disabled"}\n` +
    `Sample data: ${addSampleData ? "Added" : "Skipped"}`,
    "Configuration"
  );

  // Show next steps
  console.log();
  console.log(pc.bold("  Quick Start:"));
  console.log();
  console.log(pc.dim("  1.") + " Create an invoice    " + pc.cyan("oa create inv"));
  console.log(pc.dim("  2.") + " Add a customer       " + pc.cyan("oa add cust"));
  console.log(pc.dim("  3.") + " Chat with AI         " + pc.cyan("oa chat"));
  console.log(pc.dim("  4.") + " View dashboard       " + pc.cyan("oa dashboard"));
  console.log();

  if (!apiKey) {
    console.log(pc.yellow("  Tip: Add your OpenAI key later with:"));
    console.log(pc.cyan("  oa config set api_key <your-key>"));
    console.log();
  }

  p.outro(pc.green("You're all set! Run 'oa' to start."));
}

// Create sample data for demo
async function createSampleData(): Promise<void> {
  // Create sample customers
  const customer1 = createCustomer({
    name: "Acme Corporation",
    email: "billing@acme.com",
    payment_terms: "net_30",
  });

  const customer2 = createCustomer({
    name: "TechStart Inc",
    email: "accounts@techstart.io",
    payment_terms: "net_15",
  });

  // Create sample invoices
  const today = new Date();
  const dueDate1 = new Date(today);
  dueDate1.setDate(dueDate1.getDate() + 30);

  const dueDate2 = new Date(today);
  dueDate2.setDate(dueDate2.getDate() + 15);

  createInvoice({
    customer_id: customer1.id,
    items: [
      { description: "Consulting Services - November", quantity: 40, unit_price: 150 },
      { description: "Project Management", quantity: 10, unit_price: 100 },
    ],
    due_date: dueDate1.toISOString().split("T")[0],
    notes: "Thank you for your business!",
  });

  createInvoice({
    customer_id: customer2.id,
    items: [
      { description: "Website Development", quantity: 1, unit_price: 2500 },
      { description: "Hosting Setup", quantity: 1, unit_price: 200 },
    ],
    due_date: dueDate2.toISOString().split("T")[0],
  });

  // Create sample expenses
  const lastWeek = new Date(today);
  lastWeek.setDate(lastWeek.getDate() - 7);

  recordExpense({
    description: "Adobe Creative Cloud",
    amount: 54.99,
    category: "Software & Subscriptions",
    date: lastWeek.toISOString().split("T")[0],
  });

  recordExpense({
    description: "Office Supplies - Staples",
    amount: 127.50,
    category: "Office Supplies",
    date: today.toISOString().split("T")[0],
  });

  recordExpense({
    description: "Client Lunch Meeting",
    amount: 85.00,
    category: "Meals & Entertainment",
    date: today.toISOString().split("T")[0],
  });
}

// Quick init command (non-interactive)
export async function quickInit(options: {
  businessName?: string;
  currency?: string;
  sampleData?: boolean;
}): Promise<void> {
  if (options.businessName) {
    setSetting("business_name", options.businessName);
  }
  if (options.currency) {
    setSetting("currency", options.currency);
  }
  if (options.sampleData) {
    await createSampleData();
    console.log(pc.green("Sample data created"));
  }
  // Mark setup as complete
  setSetting("_initialized", "true");
}
