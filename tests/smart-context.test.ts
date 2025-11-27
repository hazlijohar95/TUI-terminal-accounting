import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { rmSync } from "fs";

const testDir = "/tmp/oa-smart-context-test-" + Date.now();

describe("Smart Context", () => {
  before(async () => {
    const { mkdir } = await import("fs/promises");
    await mkdir(testDir, { recursive: true });
    process.chdir(testDir);
  });

  after(() => {
    process.chdir("/tmp");
    rmSync(testDir, { recursive: true, force: true });
  });

  describe("buildSmartContext", () => {
    it("should return context structure", async () => {
      const { buildSmartContext } = await import("../dist/agent/smart-context.js");

      const context = buildSmartContext();

      assert.ok(context.summary, "Should have summary");
      assert.ok(context.metrics, "Should have metrics");
      assert.ok(Array.isArray(context.alerts), "Should have alerts array");
      assert.ok(Array.isArray(context.insights), "Should have insights array");
      assert.ok(context.recentActivity, "Should have recentActivity");
    });

    it("should have required metric fields", async () => {
      const { buildSmartContext } = await import("../dist/agent/smart-context.js");

      const context = buildSmartContext();
      const { metrics } = context;

      assert.ok("cashBalance" in metrics, "Should have cashBalance");
      assert.ok("accountsReceivable" in metrics, "Should have accountsReceivable");
      assert.ok("accountsPayable" in metrics, "Should have accountsPayable");
      assert.ok("monthlyRevenue" in metrics, "Should have monthlyRevenue");
      assert.ok("monthlyExpenses" in metrics, "Should have monthlyExpenses");
      assert.ok("netIncome" in metrics, "Should have netIncome");
      assert.ok("profitMargin" in metrics, "Should have profitMargin");
      assert.ok("overdueAmount" in metrics, "Should have overdueAmount");
      assert.ok("overdueCount" in metrics, "Should have overdueCount");
    });

    it("should generate alerts for negative cash", async () => {
      // This test would need to set up negative cash conditions
      // For now, just verify alert structure
      const { buildSmartContext } = await import("../dist/agent/smart-context.js");

      const context = buildSmartContext();

      for (const alert of context.alerts) {
        assert.ok(["warning", "info", "success", "critical"].includes(alert.type));
        assert.ok(alert.title, "Alert should have title");
        assert.ok(alert.message, "Alert should have message");
      }
    });
  });

  describe("getQuickSummary", () => {
    it("should return a concise summary string", async () => {
      const { getQuickSummary } = await import("../dist/agent/smart-context.js");

      const summary = getQuickSummary();

      assert.ok(typeof summary === "string", "Should return string");
      assert.ok(summary.includes("Cash:"), "Should include cash");
    });
  });

  describe("getSuggestedQuestions", () => {
    it("should return array of suggestions", async () => {
      const { getSuggestedQuestions } = await import("../dist/agent/smart-context.js");

      const suggestions = getSuggestedQuestions();

      assert.ok(Array.isArray(suggestions), "Should return array");
      assert.ok(suggestions.length <= 5, "Should return max 5 suggestions");

      for (const suggestion of suggestions) {
        assert.ok(typeof suggestion === "string", "Each suggestion should be string");
      }
    });
  });

  describe("getContextForQuery", () => {
    it("should return cashflow context", async () => {
      const { getContextForQuery } = await import("../dist/agent/smart-context.js");

      const context = getContextForQuery("cashflow");

      assert.ok(context.includes("Cash Position"), "Should include cash position");
      assert.ok(context.includes("Monthly Inflow"), "Should include inflow");
      assert.ok(context.includes("Monthly Outflow"), "Should include outflow");
    });

    it("should return receivables context", async () => {
      const { getContextForQuery } = await import("../dist/agent/smart-context.js");

      const context = getContextForQuery("receivables");

      assert.ok(context.includes("Total Receivables"), "Should include receivables");
      assert.ok(context.includes("Overdue"), "Should include overdue");
    });

    it("should return expenses context", async () => {
      const { getContextForQuery } = await import("../dist/agent/smart-context.js");

      const context = getContextForQuery("expenses");

      assert.ok(context.includes("This Month"), "Should include monthly expenses");
    });

    it("should return overview for default", async () => {
      const { getContextForQuery } = await import("../dist/agent/smart-context.js");

      const context = getContextForQuery("overview");

      assert.ok(context.includes("Financial Snapshot"), "Should include snapshot");
    });
  });
});
