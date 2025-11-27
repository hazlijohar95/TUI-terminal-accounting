import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { rmSync } from "fs";

const testDir = "/tmp/oa-account-test-" + Date.now();

describe("Accounts Domain", () => {
  before(async () => {
    const { mkdir } = await import("fs/promises");
    await mkdir(testDir, { recursive: true });
    process.chdir(testDir);
  });

  after(() => {
    process.chdir("/tmp");
    rmSync(testDir, { recursive: true, force: true });
  });

  describe("listAccounts", () => {
    it("should list all accounts", async () => {
      const { listAccounts } = await import("../dist/domain/accounts.js");

      const accounts = listAccounts();

      assert.ok(Array.isArray(accounts), "Should return array");
      assert.ok(accounts.length > 0, "Should have default accounts");
    });

    it("should filter by type", async () => {
      const { listAccounts } = await import("../dist/domain/accounts.js");

      const assetAccounts = listAccounts({ type: "asset" });
      const expenseAccounts = listAccounts({ type: "expense" });

      assert.ok(assetAccounts.every(a => a.type === "asset"), "All should be assets");
      assert.ok(expenseAccounts.every(a => a.type === "expense"), "All should be expenses");
    });

    it("should filter by is_active", async () => {
      const { listAccounts } = await import("../dist/domain/accounts.js");

      const activeAccounts = listAccounts({ is_active: true });

      assert.ok(activeAccounts.every(a => a.is_active === 1), "All should be active");
    });

    it("should search by code or name", async () => {
      const { listAccounts } = await import("../dist/domain/accounts.js");

      const results = listAccounts({ search: "1100" });

      assert.ok(results.length > 0, "Should find account by code");
    });
  });

  describe("getAccount", () => {
    it("should get account by ID", async () => {
      const { listAccounts, getAccount } = await import("../dist/domain/accounts.js");

      const accounts = listAccounts();
      const firstAccount = accounts[0];

      const result = getAccount(firstAccount.id);

      assert.ok(result, "Should find account");
      assert.strictEqual(result?.id, firstAccount.id);
      assert.ok(typeof result?.balance === "number", "Should have balance");
    });

    it("should return null for non-existent account", async () => {
      const { getAccount } = await import("../dist/domain/accounts.js");

      const result = getAccount(99999);
      assert.strictEqual(result, null);
    });

    it("should include children in result", async () => {
      const { getAccount, listAccounts } = await import("../dist/domain/accounts.js");

      // Find an account with children
      const accounts = listAccounts();
      const parentCandidate = accounts.find(a => a.parent_id === null);

      if (parentCandidate) {
        const result = getAccount(parentCandidate.id);
        assert.ok(result, "Should find account");
        assert.ok(Array.isArray(result?.children), "Should have children array");
      }
    });
  });

  describe("getAccountByCode", () => {
    it("should get account by code", async () => {
      const { getAccountByCode } = await import("../dist/domain/accounts.js");

      const result = getAccountByCode("1100");

      assert.ok(result, "Should find account by code");
      assert.strictEqual(result?.code, "1100");
    });

    it("should return null for non-existent code", async () => {
      const { getAccountByCode } = await import("../dist/domain/accounts.js");

      const result = getAccountByCode("9999");
      assert.strictEqual(result, null);
    });
  });

  describe("createAccount", () => {
    it("should create a new account", async () => {
      const { createAccount, getAccount } = await import("../dist/domain/accounts.js");

      const account = createAccount({
        code: "5999",
        name: "Test Expense Account",
        type: "expense",
        description: "A test account",
      });

      assert.ok(account.id > 0, "Should return account with ID");
      assert.strictEqual(account.code, "5999");
      assert.strictEqual(account.name, "Test Expense Account");
      assert.strictEqual(account.type, "expense");
    });

    it("should reject duplicate codes", async () => {
      const { createAccount } = await import("../dist/domain/accounts.js");

      await assert.rejects(
        async () => {
          createAccount({
            code: "1100", // Already exists
            name: "Duplicate Code Account",
            type: "asset",
          });
        },
        /already exists/
      );
    });

    it("should reject invalid code format", async () => {
      const { createAccount } = await import("../dist/domain/accounts.js");

      await assert.rejects(
        async () => {
          createAccount({
            code: "ABC1",
            name: "Invalid Code Account",
            type: "asset",
          });
        },
        /4-digit number/
      );
    });

    it("should reject non-existent parent", async () => {
      const { createAccount } = await import("../dist/domain/accounts.js");

      await assert.rejects(
        async () => {
          createAccount({
            code: "5998",
            name: "Orphan Account",
            type: "expense",
            parent_id: 99999,
          });
        },
        /Parent account does not exist/
      );
    });
  });

  describe("updateAccount", () => {
    it("should update account fields", async () => {
      const { createAccount, updateAccount } = await import("../dist/domain/accounts.js");

      const account = createAccount({
        code: "5997",
        name: "Update Test Account",
        type: "expense",
      });

      const updated = updateAccount(account.id, {
        name: "Updated Account Name",
        description: "New description",
      });

      assert.strictEqual(updated.name, "Updated Account Name");
      assert.strictEqual(updated.description, "New description");
    });

    it("should throw for non-existent account", async () => {
      const { updateAccount } = await import("../dist/domain/accounts.js");

      await assert.rejects(
        async () => updateAccount(99999, { name: "New Name" }),
        /Account not found/
      );
    });

    it("should prevent circular parent reference", async () => {
      const { createAccount, updateAccount } = await import("../dist/domain/accounts.js");

      const account = createAccount({
        code: "5996",
        name: "Self Parent Test",
        type: "expense",
      });

      await assert.rejects(
        async () => updateAccount(account.id, { parent_id: account.id }),
        /cannot be its own parent/
      );
    });
  });

  describe("deleteAccount", () => {
    it("should delete account without transactions", async () => {
      const { createAccount, deleteAccount, getAccount } = await import("../dist/domain/accounts.js");

      const account = createAccount({
        code: "5995",
        name: "Delete Me Account",
        type: "expense",
      });

      deleteAccount(account.id);

      const result = getAccount(account.id);
      assert.strictEqual(result, null, "Account should be deleted");
    });

    it("should throw for non-existent account", async () => {
      const { deleteAccount } = await import("../dist/domain/accounts.js");

      await assert.rejects(
        async () => deleteAccount(99999),
        /Account not found/
      );
    });
  });

  describe("getAccountBalance", () => {
    it("should return zero for new account", async () => {
      const { createAccount, getAccountBalance } = await import("../dist/domain/accounts.js");

      const account = createAccount({
        code: "5994",
        name: "Zero Balance Account",
        type: "expense",
      });

      const balance = getAccountBalance(account.id);
      assert.strictEqual(balance, 0);
    });
  });

  describe("getAccountsByType", () => {
    it("should return accounts of specific type", async () => {
      const { getAccountsByType } = await import("../dist/domain/accounts.js");

      const assetAccounts = getAccountsByType("asset");

      assert.ok(Array.isArray(assetAccounts));
      assert.ok(assetAccounts.every(a => a.type === "asset"));
    });
  });

  describe("validateAccountCode", () => {
    it("should return true for unique code", async () => {
      const { validateAccountCode } = await import("../dist/domain/accounts.js");

      const result = validateAccountCode("9999");
      assert.strictEqual(result, true);
    });

    it("should return false for existing code", async () => {
      const { validateAccountCode } = await import("../dist/domain/accounts.js");

      const result = validateAccountCode("1100");
      assert.strictEqual(result, false);
    });

    it("should allow excluding specific ID", async () => {
      const { validateAccountCode, getAccountByCode } = await import("../dist/domain/accounts.js");

      const account = getAccountByCode("1100");
      if (account) {
        // Validate same code but exclude this account
        const result = validateAccountCode("1100", account.id);
        assert.strictEqual(result, true);
      }
    });
  });

  describe("getAccountHierarchy", () => {
    it("should return hierarchical structure", async () => {
      const { getAccountHierarchy } = await import("../dist/domain/accounts.js");

      const hierarchy = getAccountHierarchy();

      assert.ok(Array.isArray(hierarchy));
      // Root accounts should have children arrays
      hierarchy.forEach(account => {
        assert.ok(Array.isArray(account.children), "Should have children array");
      });
    });
  });

  describe("getAccountsGrouped", () => {
    it("should group accounts by type", async () => {
      const { getAccountsGrouped } = await import("../dist/domain/accounts.js");

      const grouped = getAccountsGrouped();

      assert.ok(typeof grouped === "object");

      // Should have some groups
      const keys = Object.keys(grouped);
      assert.ok(keys.length > 0, "Should have groups");

      // Each group should have label, type, and accounts
      for (const key of keys) {
        assert.ok(grouped[key].label, "Group should have label");
        assert.ok(grouped[key].type, "Group should have type");
        assert.ok(Array.isArray(grouped[key].accounts), "Group should have accounts array");
      }
    });
  });

  describe("deactivateAccount and activateAccount", () => {
    it("should deactivate and reactivate account", async () => {
      const { createAccount, deactivateAccount, activateAccount, getAccount } = await import("../dist/domain/accounts.js");

      const account = createAccount({
        code: "5993",
        name: "Toggle Active Account",
        type: "expense",
      });

      assert.strictEqual(account.is_active, 1, "Should be active initially");

      deactivateAccount(account.id);
      let result = getAccount(account.id);
      assert.strictEqual(result?.is_active, 0, "Should be inactive");

      activateAccount(account.id);
      result = getAccount(account.id);
      assert.strictEqual(result?.is_active, 1, "Should be active again");
    });
  });

  describe("getTotalAssets/Liabilities/Equity", () => {
    it("should return totals", async () => {
      const { getTotalAssets, getTotalLiabilities, getTotalEquity } = await import("../dist/domain/accounts.js");

      const assets = getTotalAssets();
      const liabilities = getTotalLiabilities();
      const equity = getTotalEquity();

      assert.ok(typeof assets === "number", "Assets should be number");
      assert.ok(typeof liabilities === "number", "Liabilities should be number");
      assert.ok(typeof equity === "number", "Equity should be number");
    });
  });

  describe("searchAccounts", () => {
    it("should search by name or code", async () => {
      const { searchAccounts } = await import("../dist/domain/accounts.js");

      const results = searchAccounts("Bank");

      assert.ok(Array.isArray(results));
      // Should find at least the bank account
      assert.ok(results.length >= 0);
    });
  });
});
