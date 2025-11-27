import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { rmSync } from "fs";

const testDir = "/tmp/oa-reports-test-" + Date.now();

describe("Reports Domain", () => {
  before(async () => {
    const { mkdir } = await import("fs/promises");
    await mkdir(testDir, { recursive: true });
    process.chdir(testDir);
  });

  after(() => {
    process.chdir("/tmp");
    rmSync(testDir, { recursive: true, force: true });
  });

  describe("getBalanceSheet", () => {
    it("should return balance sheet structure", async () => {
      const { getBalanceSheet } = await import("../dist/domain/reports.js");

      const report = getBalanceSheet();

      assert.ok(report.date, "Should have date");
      assert.ok(typeof report.assets === "object", "Should have assets");
      assert.ok(typeof report.liabilities === "object", "Should have liabilities");
      assert.ok(typeof report.equity === "object", "Should have equity");

      // Check assets structure
      assert.ok(typeof report.assets.cash === "number", "assets.cash should be number");
      assert.ok(typeof report.assets.receivables === "number", "assets.receivables should be number");
      assert.ok(typeof report.assets.total === "number", "assets.total should be number");

      // Check liabilities structure
      assert.ok(typeof report.liabilities.payables === "number", "liabilities.payables should be number");
      assert.ok(typeof report.liabilities.total === "number", "liabilities.total should be number");

      // Check equity structure
      assert.ok(typeof report.equity.retained_earnings === "number", "equity.retained_earnings should be number");
      assert.ok(typeof report.equity.total === "number", "equity.total should be number");
    });

    it("should accept custom date", async () => {
      const { getBalanceSheet } = await import("../dist/domain/reports.js");

      const report = getBalanceSheet("2024-06-30");

      assert.strictEqual(report.date, "2024-06-30");
    });

    it("should have balanced totals", async () => {
      const { getBalanceSheet } = await import("../dist/domain/reports.js");

      const report = getBalanceSheet();

      // Assets = Liabilities + Equity (accounting equation)
      assert.strictEqual(
        report.assets.total,
        report.liabilities.total + report.equity.total,
        "Balance sheet should balance"
      );
    });
  });

  describe("getProfitLoss", () => {
    it("should return profit/loss structure", async () => {
      const { getProfitLoss } = await import("../dist/domain/reports.js");

      const report = getProfitLoss("2024-01-01", "2024-12-31");

      assert.strictEqual(report.from_date, "2024-01-01");
      assert.strictEqual(report.to_date, "2024-12-31");

      assert.ok(typeof report.revenue === "object", "Should have revenue");
      assert.ok(typeof report.expenses === "object", "Should have expenses");
      assert.ok(typeof report.net_income === "number", "Should have net_income");

      // Check revenue structure
      assert.ok(Array.isArray(report.revenue.items), "revenue.items should be array");
      assert.ok(typeof report.revenue.total === "number", "revenue.total should be number");

      // Check expenses structure
      assert.ok(Array.isArray(report.expenses.items), "expenses.items should be array");
      assert.ok(typeof report.expenses.total === "number", "expenses.total should be number");
    });

    it("should calculate net income correctly", async () => {
      const { getProfitLoss } = await import("../dist/domain/reports.js");

      const report = getProfitLoss("2024-01-01", "2024-12-31");

      assert.strictEqual(
        report.net_income,
        report.revenue.total - report.expenses.total,
        "Net income should equal revenue minus expenses"
      );
    });

    it("should filter by date range", async () => {
      const { getProfitLoss } = await import("../dist/domain/reports.js");
      const { createInvoice } = await import("../dist/domain/invoices.js");
      const { createCustomer } = await import("../dist/domain/customers.js");

      // Get baseline revenue before adding new invoice
      const baselineReport = getProfitLoss("2025-06-01", "2025-06-30");
      const baselineRevenue = baselineReport.revenue.total;

      const customer = createCustomer({
        name: "PL Test Customer " + Date.now(),
        email: `pltest${Date.now()}@example.com`,
      });

      // Create invoice in specific date range (revenue is recognized when invoice is created)
      createInvoice({
        customer_id: customer.id,
        date: "2025-06-15",
        due_date: "2025-07-15",
        items: [{ description: "Test Service", quantity: 1, unit_price: 1000, amount: 1000 }],
      });

      const reportAfterInvoice = getProfitLoss("2025-06-01", "2025-06-30");

      // Revenue should have increased by 1000 after creating the invoice
      assert.strictEqual(
        reportAfterInvoice.revenue.total,
        baselineRevenue + 1000,
        "Revenue should increase by invoice amount"
      );
    });
  });

  describe("getReceivablesAging", () => {
    it("should return aging structure", async () => {
      const { getReceivablesAging } = await import("../dist/domain/reports.js");

      const report = getReceivablesAging();

      assert.ok(Array.isArray(report.current), "Should have current bucket");
      assert.ok(Array.isArray(report.days_1_30), "Should have 1-30 days bucket");
      assert.ok(Array.isArray(report.days_31_60), "Should have 31-60 days bucket");
      assert.ok(Array.isArray(report.days_61_90), "Should have 61-90 days bucket");
      assert.ok(Array.isArray(report.days_90_plus), "Should have 90+ days bucket");

      assert.ok(typeof report.totals === "object", "Should have totals");
      assert.ok(typeof report.totals.current === "number");
      assert.ok(typeof report.totals.days_1_30 === "number");
      assert.ok(typeof report.totals.days_31_60 === "number");
      assert.ok(typeof report.totals.days_61_90 === "number");
      assert.ok(typeof report.totals.days_90_plus === "number");
      assert.ok(typeof report.totals.total === "number");
    });

    it("should calculate totals correctly", async () => {
      const { getReceivablesAging } = await import("../dist/domain/reports.js");

      const report = getReceivablesAging();

      const sumOfBuckets =
        report.totals.current +
        report.totals.days_1_30 +
        report.totals.days_31_60 +
        report.totals.days_61_90 +
        report.totals.days_90_plus;

      assert.strictEqual(
        sumOfBuckets,
        report.totals.total,
        "Sum of buckets should equal total"
      );
    });

    it("should include days_overdue for overdue invoices", async () => {
      const { getReceivablesAging } = await import("../dist/domain/reports.js");
      const { createInvoice } = await import("../dist/domain/invoices.js");
      const { createCustomer } = await import("../dist/domain/customers.js");

      const customer = createCustomer({
        name: "Overdue Customer",
        email: "overdue@example.com",
      });

      // Create invoice with past due date
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 15);

      createInvoice({
        customer_id: customer.id,
        date: "2024-01-01",
        due_date: pastDate.toISOString().split("T")[0],
        items: [{ description: "Overdue item", quantity: 1, unit_price: 500 }],
      });

      const report = getReceivablesAging();

      // Should have some overdue invoices
      const overdueItems = [
        ...report.days_1_30,
        ...report.days_31_60,
        ...report.days_61_90,
        ...report.days_90_plus,
      ];

      overdueItems.forEach((item) => {
        assert.ok(typeof item.days_overdue === "number", "Should have days_overdue");
        assert.ok(item.days_overdue > 0, "days_overdue should be positive");
      });
    });
  });

  describe("getCashFlow", () => {
    it("should return cash flow structure", async () => {
      const { getCashFlow } = await import("../dist/domain/reports.js");

      const report = getCashFlow("2024-01-01", "2024-12-31");

      assert.strictEqual(report.from_date, "2024-01-01");
      assert.strictEqual(report.to_date, "2024-12-31");

      assert.ok(typeof report.opening_balance === "number", "Should have opening_balance");
      assert.ok(typeof report.closing_balance === "number", "Should have closing_balance");
      assert.ok(typeof report.net_change === "number", "Should have net_change");

      assert.ok(typeof report.inflows === "object", "Should have inflows");
      assert.ok(Array.isArray(report.inflows.items), "inflows.items should be array");
      assert.ok(typeof report.inflows.total === "number", "inflows.total should be number");

      assert.ok(typeof report.outflows === "object", "Should have outflows");
      assert.ok(Array.isArray(report.outflows.items), "outflows.items should be array");
      assert.ok(typeof report.outflows.total === "number", "outflows.total should be number");
    });

    it("should calculate closing balance correctly", async () => {
      const { getCashFlow } = await import("../dist/domain/reports.js");

      const report = getCashFlow("2024-01-01", "2024-12-31");

      assert.strictEqual(
        report.closing_balance,
        report.opening_balance + report.net_change,
        "Closing should equal opening + net change"
      );
    });

    it("should calculate net change correctly", async () => {
      const { getCashFlow } = await import("../dist/domain/reports.js");

      const report = getCashFlow("2024-01-01", "2024-12-31");

      assert.strictEqual(
        report.net_change,
        report.inflows.total - report.outflows.total,
        "Net change should equal inflows minus outflows"
      );
    });
  });

  describe("getExpensesByCategory", () => {
    it("should return expenses by category", async () => {
      const { getExpensesByCategory } = await import("../dist/domain/reports.js");

      const expenses = getExpensesByCategory("2024-01-01", "2024-12-31");

      assert.ok(Array.isArray(expenses), "Should return array");

      expenses.forEach((item) => {
        assert.ok(typeof item.category === "string", "Should have category");
        assert.ok(typeof item.amount === "number", "Should have amount");
        assert.ok(typeof item.percentage === "number", "Should have percentage");
        assert.ok(
          item.percentage >= 0 && item.percentage <= 100,
          "Percentage should be 0-100"
        );
      });
    });

    it("should have percentages sum to 100", async () => {
      const { getExpensesByCategory } = await import("../dist/domain/reports.js");
      const { recordExpense } = await import("../dist/domain/payments.js");
      const { getDb } = await import("../dist/db/index.js");

      // Create some expenses with valid categories
      const db = getDb();
      const accounts = db.prepare(
        "SELECT code, name FROM accounts WHERE type = 'expense' LIMIT 2"
      ).all() as Array<{ code: string; name: string }>;

      if (accounts.length >= 2) {
        recordExpense({
          date: "2024-05-01",
          amount: 100,
          category: accounts[0].name,
          description: "Test expense 1",
        });

        recordExpense({
          date: "2024-05-02",
          amount: 200,
          category: accounts[1].name,
          description: "Test expense 2",
        });

        const expenses = getExpensesByCategory("2024-05-01", "2024-05-31");

        if (expenses.length > 0) {
          const totalPercentage = expenses.reduce((sum, e) => sum + e.percentage, 0);
          // Allow some rounding error
          assert.ok(
            totalPercentage >= 99 && totalPercentage <= 101,
            `Percentages should sum to ~100 (got ${totalPercentage})`
          );
        }
      }
    });
  });
});
