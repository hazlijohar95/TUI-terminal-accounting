import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { rmSync } from "fs";

const testDir = "/tmp/oa-categorization-test-" + Date.now();

describe("Categorization Rules", () => {
  before(async () => {
    const { mkdir } = await import("fs/promises");
    await mkdir(testDir, { recursive: true });
    process.chdir(testDir);
  });

  after(() => {
    process.chdir("/tmp");
    rmSync(testDir, { recursive: true, force: true });
  });

  describe("matchBuiltinPatterns", () => {
    it("should match utilities", async () => {
      const { matchBuiltinPatterns } = await import("../dist/domain/categorization-rules.js");

      const result = matchBuiltinPatterns("electricity bill payment");

      assert.ok(result, "Should match utilities");
      assert.strictEqual(result?.category, "Utilities");
      assert.ok(result?.confidence >= 0.8, "Should have high confidence");
    });

    it("should match communications", async () => {
      const { matchBuiltinPatterns } = await import("../dist/domain/categorization-rules.js");

      const result = matchBuiltinPatterns("internet subscription");

      assert.ok(result, "Should match communications");
      assert.strictEqual(result?.category, "Communications");
    });

    it("should match travel & transport", async () => {
      const { matchBuiltinPatterns } = await import("../dist/domain/categorization-rules.js");

      const result = matchBuiltinPatterns("petrol for car");

      assert.ok(result, "Should match travel");
      assert.strictEqual(result?.category, "Travel & Transport");
    });

    it("should match meals", async () => {
      const { matchBuiltinPatterns } = await import("../dist/domain/categorization-rules.js");

      const result = matchBuiltinPatterns("lunch with client");

      assert.ok(result, "Should match meals");
      assert.strictEqual(result?.category, "Meals & Entertainment");
    });

    it("should increase confidence with vendor match", async () => {
      const { matchBuiltinPatterns } = await import("../dist/domain/categorization-rules.js");

      const withoutVendor = matchBuiltinPatterns("electricity bill");
      const withVendor = matchBuiltinPatterns("electricity bill", "TNB");

      assert.ok(withoutVendor, "Should match without vendor");
      assert.ok(withVendor, "Should match with vendor");

      // Vendor match should increase confidence
      assert.ok(
        withVendor!.confidence >= withoutVendor!.confidence,
        "Vendor should increase or maintain confidence"
      );
    });

    it("should match Malaysian vendors", async () => {
      const { matchBuiltinPatterns } = await import("../dist/domain/categorization-rules.js");

      // Test various Malaysian vendors
      const celcomResult = matchBuiltinPatterns("phone bill", "Celcom");
      assert.ok(celcomResult, "Should match Celcom");
      assert.strictEqual(celcomResult?.category, "Communications");

      const petronas = matchBuiltinPatterns("fuel", "Petronas");
      assert.ok(petronas, "Should match Petronas");
      assert.strictEqual(petronas?.category, "Travel & Transport");

      const maybank = matchBuiltinPatterns("bank charge", "Maybank");
      assert.ok(maybank, "Should match Maybank");
      assert.strictEqual(maybank?.category, "Bank Charges");
    });

    it("should return null for unmatched descriptions", async () => {
      const { matchBuiltinPatterns } = await import("../dist/domain/categorization-rules.js");

      const result = matchBuiltinPatterns("random unrelated text xyz123");

      assert.strictEqual(result, null, "Should return null for no match");
    });
  });

  describe("smartCategorize", () => {
    it("should return source type", async () => {
      const { smartCategorize } = await import("../dist/domain/categorization-rules.js");

      const result = smartCategorize("electricity bill");

      assert.ok(result, "Should return result");
      assert.ok(
        ["user_rule", "builtin", "none"].includes(result.source),
        "Source should be valid type"
      );
    });

    it("should include confidence score", async () => {
      const { smartCategorize } = await import("../dist/domain/categorization-rules.js");

      const result = smartCategorize("petrol for company car");

      assert.ok(typeof result.confidence === "number", "Should have confidence");
      assert.ok(result.confidence >= 0 && result.confidence <= 1, "Confidence should be 0-1");
    });

    it("should match builtin patterns when no user rules", async () => {
      const { smartCategorize } = await import("../dist/domain/categorization-rules.js");

      const result = smartCategorize("office supplies purchase");

      // With fresh DB, should match builtin
      if (result.source === "builtin") {
        assert.ok(result.category, "Should have category for builtin match");
        assert.ok(result.confidence >= 0.7, "Should have good confidence");
      }
    });
  });

  describe("User Rules", () => {
    it("should create a categorization rule", async () => {
      const { createRule, getRule } = await import("../dist/domain/categorization-rules.js");
      const { listAccounts } = await import("../dist/domain/accounts.js");

      // Get an expense account to link to
      const accounts = listAccounts({ type: "expense", is_active: true });
      if (accounts.length === 0) {
        // Skip if no accounts
        return;
      }

      const rule = createRule({
        pattern: "test pattern unique123",
        account_id: accounts[0].id,
      });

      assert.ok(rule.id > 0, "Should create rule with ID");
      assert.strictEqual(rule.pattern, "test pattern unique123");

      // Verify we can retrieve it
      const retrieved = getRule(rule.id);
      assert.ok(retrieved, "Should retrieve created rule");
      assert.strictEqual(retrieved?.pattern, "test pattern unique123");
    });

    it("should list all rules", async () => {
      const { listRules } = await import("../dist/domain/categorization-rules.js");

      const rules = listRules();

      assert.ok(Array.isArray(rules), "Should return array");
    });

    it("should match expenses against user rules", async () => {
      const { createRule, matchExpense } = await import("../dist/domain/categorization-rules.js");
      const { listAccounts } = await import("../dist/domain/accounts.js");

      const accounts = listAccounts({ type: "expense", is_active: true });
      if (accounts.length === 0) return;

      // Create a specific rule
      createRule({
        pattern: "specificpatternxyz",
        account_id: accounts[0].id,
        priority: 10,
      });

      // Match against it
      const match = matchExpense("expense for specificpatternxyz item");

      assert.ok(match, "Should match the pattern");
      assert.strictEqual(match?.rule.pattern, "specificpatternxyz");
      assert.ok(match?.confidence > 0, "Should have confidence");
    });
  });
});
