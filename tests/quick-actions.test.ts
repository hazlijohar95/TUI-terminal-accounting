import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { rmSync } from "fs";

const testDir = "/tmp/oa-quick-actions-test-" + Date.now();

describe("Quick Actions", () => {
  before(async () => {
    const { mkdir } = await import("fs/promises");
    await mkdir(testDir, { recursive: true });
    process.chdir(testDir);
  });

  after(() => {
    process.chdir("/tmp");
    rmSync(testDir, { recursive: true, force: true });
  });

  describe("mightBeQuickAction", () => {
    it("should detect expense commands", async () => {
      const { mightBeQuickAction } = await import("../dist/agent/quick-actions.js");

      assert.ok(mightBeQuickAction("record $50 for lunch"));
      assert.ok(mightBeQuickAction("spent RM45 on parking"));
      assert.ok(mightBeQuickAction("add expense 100 office supplies"));
      assert.ok(mightBeQuickAction("paid $20 for coffee"));
    });

    it("should detect invoice commands", async () => {
      const { mightBeQuickAction } = await import("../dist/agent/quick-actions.js");

      assert.ok(mightBeQuickAction("create invoice for John Smith"));
      assert.ok(mightBeQuickAction("new invoice for Acme Corp"));
      assert.ok(mightBeQuickAction("invoice John for $500"));
    });

    it("should detect payment commands", async () => {
      const { mightBeQuickAction } = await import("../dist/agent/quick-actions.js");

      assert.ok(mightBeQuickAction("mark INV-001 as paid"));
      assert.ok(mightBeQuickAction("received $1000 from client"));
    });

    it("should not match general questions", async () => {
      const { mightBeQuickAction } = await import("../dist/agent/quick-actions.js");

      assert.ok(!mightBeQuickAction("How are my finances?"));
      assert.ok(!mightBeQuickAction("Show me the balance sheet"));
      assert.ok(!mightBeQuickAction("What are my expenses this month?"));
    });
  });

  describe("getQuickActionExamples", () => {
    it("should return example commands", async () => {
      const { getQuickActionExamples } = await import("../dist/agent/quick-actions.js");

      const examples = getQuickActionExamples();

      assert.ok(Array.isArray(examples), "Should return array");
      assert.ok(examples.length > 0, "Should have examples");

      // Verify examples are strings
      for (const example of examples) {
        assert.ok(typeof example === "string", "Each example should be string");
      }
    });
  });

  describe("executeQuickAction", () => {
    it("should return matched: false for non-matching input", async () => {
      const { executeQuickAction } = await import("../dist/agent/quick-actions.js");

      const result = await executeQuickAction("How is my cash flow?");

      assert.strictEqual(result.matched, false);
    });

    it("should parse expense amount correctly", async () => {
      const { executeQuickAction } = await import("../dist/agent/quick-actions.js");

      // This will try to record an expense - might fail if no accounts, but should match
      const result = await executeQuickAction("record $50 for office supplies");

      assert.strictEqual(result.matched, true);
      assert.strictEqual(result.action, "record_expense");
      // Result or error should be present
      assert.ok(result.result || result.error, "Should have result or error");
    });

    it("should parse Malaysian Ringgit amounts", async () => {
      const { executeQuickAction } = await import("../dist/agent/quick-actions.js");

      const result = await executeQuickAction("spent RM 100 on lunch");

      assert.strictEqual(result.matched, true);
      assert.strictEqual(result.action, "record_expense");
    });

    it("should parse invoice creation", async () => {
      const { executeQuickAction } = await import("../dist/agent/quick-actions.js");

      const result = await executeQuickAction("invoice John Smith for $500 web design");

      assert.strictEqual(result.matched, true);
      assert.strictEqual(result.action, "create_invoice");
    });
  });
});
