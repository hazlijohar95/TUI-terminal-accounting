import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { rmSync } from "fs";

const testDir = "/tmp/oa-vendor-test-" + Date.now();

describe("Vendors Domain", () => {
  before(async () => {
    const { mkdir } = await import("fs/promises");
    await mkdir(testDir, { recursive: true });
    process.chdir(testDir);
  });

  after(() => {
    process.chdir("/tmp");
    rmSync(testDir, { recursive: true, force: true });
  });

  describe("createVendor", () => {
    it("should create a basic vendor", async () => {
      const { createVendor, getVendor } = await import("../dist/domain/vendors.js");

      const vendor = createVendor({
        name: "Test Vendor",
        email: "vendor@example.com",
      });

      assert.ok(vendor.id > 0, "Should return vendor with ID");
      assert.strictEqual(vendor.name, "Test Vendor");
      assert.strictEqual(vendor.email, "vendor@example.com");
      assert.ok(vendor.created_at, "Should have created_at");
    });

    it("should create vendor with all fields", async () => {
      const { createVendor } = await import("../dist/domain/vendors.js");

      const vendor = createVendor({
        name: "Full Vendor",
        email: "full@example.com",
        phone: "+60123456789",
        address: "123 Vendor Street",
        tax_id: "MY123456",
        default_category: "Office Supplies",
        notes: "Important vendor",
      });

      assert.strictEqual(vendor.name, "Full Vendor");
      assert.strictEqual(vendor.phone, "+60123456789");
      assert.strictEqual(vendor.address, "123 Vendor Street");
      assert.strictEqual(vendor.tax_id, "MY123456");
      assert.strictEqual(vendor.default_category, "Office Supplies");
      assert.strictEqual(vendor.notes, "Important vendor");
    });
  });

  describe("getVendor", () => {
    it("should get vendor by ID", async () => {
      const { createVendor, getVendor } = await import("../dist/domain/vendors.js");

      const created = createVendor({ name: "Get By ID Vendor" });
      const retrieved = getVendor(created.id);

      assert.ok(retrieved, "Should find vendor");
      assert.strictEqual(retrieved?.id, created.id);
      assert.strictEqual(retrieved?.name, "Get By ID Vendor");
    });

    it("should get vendor by exact name", async () => {
      const { createVendor, getVendor } = await import("../dist/domain/vendors.js");

      createVendor({ name: "Exact Name Vendor" });
      const retrieved = getVendor("Exact Name Vendor");

      assert.ok(retrieved, "Should find vendor by name");
      assert.strictEqual(retrieved?.name, "Exact Name Vendor");
    });

    it("should get vendor by case-insensitive name", async () => {
      const { createVendor, getVendor } = await import("../dist/domain/vendors.js");

      createVendor({ name: "Case Test Vendor" });
      const retrieved = getVendor("case test vendor");

      assert.ok(retrieved, "Should find vendor by lowercase name");
      assert.strictEqual(retrieved?.name, "Case Test Vendor");
    });

    it("should return undefined for non-existent vendor", async () => {
      const { getVendor } = await import("../dist/domain/vendors.js");

      const result = getVendor(99999);
      assert.strictEqual(result, undefined);
    });
  });

  describe("listVendors", () => {
    it("should list all vendors with balance info", async () => {
      const { listVendors } = await import("../dist/domain/vendors.js");

      const vendors = listVendors();

      assert.ok(Array.isArray(vendors), "Should return array");
      assert.ok(vendors.length > 0, "Should have vendors");

      // Check balance fields exist
      const vendor = vendors[0];
      assert.ok(typeof vendor.total_expenses === "number", "Should have total_expenses");
      assert.ok(typeof vendor.total_paid === "number", "Should have total_paid");
      assert.ok(typeof vendor.balance === "number", "Should have balance");
    });

    it("should return vendors sorted by name", async () => {
      const { createVendor, listVendors } = await import("../dist/domain/vendors.js");

      createVendor({ name: "ZZZ Vendor" });
      createVendor({ name: "AAA Vendor" });

      const vendors = listVendors();
      const names = vendors.map(v => v.name);

      // AAA should come before ZZZ
      const aaaIndex = names.indexOf("AAA Vendor");
      const zzzIndex = names.indexOf("ZZZ Vendor");
      assert.ok(aaaIndex < zzzIndex, "Should be sorted alphabetically");
    });
  });

  describe("updateVendor", () => {
    it("should update vendor fields", async () => {
      const { createVendor, updateVendor, getVendor } = await import("../dist/domain/vendors.js");

      const vendor = createVendor({ name: "Update Test Vendor" });

      const updated = updateVendor(vendor.id, {
        name: "Updated Vendor Name",
        email: "updated@example.com",
        phone: "+60987654321",
      });

      assert.ok(updated, "Should return updated vendor");
      assert.strictEqual(updated?.name, "Updated Vendor Name");
      assert.strictEqual(updated?.email, "updated@example.com");
      assert.strictEqual(updated?.phone, "+60987654321");

      // Verify persistence
      const retrieved = getVendor(vendor.id);
      assert.strictEqual(retrieved?.name, "Updated Vendor Name");
    });

    it("should return undefined for non-existent vendor", async () => {
      const { updateVendor } = await import("../dist/domain/vendors.js");

      const result = updateVendor(99999, { name: "New Name" });
      assert.strictEqual(result, undefined);
    });

    it("should return original if no changes provided", async () => {
      const { createVendor, updateVendor } = await import("../dist/domain/vendors.js");

      const vendor = createVendor({ name: "No Change Vendor" });
      const result = updateVendor(vendor.id, {});

      assert.ok(result, "Should return vendor");
      assert.strictEqual(result?.name, "No Change Vendor");
    });
  });

  describe("deleteVendor", () => {
    it("should delete vendor without expenses", async () => {
      const { createVendor, deleteVendor, getVendor } = await import("../dist/domain/vendors.js");

      const vendor = createVendor({ name: "Delete Me Vendor" });
      const result = deleteVendor(vendor.id);

      assert.strictEqual(result, true, "Should return true on success");

      const retrieved = getVendor(vendor.id);
      assert.strictEqual(retrieved, undefined, "Vendor should be deleted");
    });

    it("should return false for non-existent vendor", async () => {
      const { deleteVendor } = await import("../dist/domain/vendors.js");

      const result = deleteVendor(99999);
      assert.strictEqual(result, false);
    });
  });

  describe("searchVendors", () => {
    it("should search by name", async () => {
      const { createVendor, searchVendors } = await import("../dist/domain/vendors.js");

      createVendor({ name: "Searchable Vendor ABC" });

      const results = searchVendors("Searchable");

      assert.ok(results.length > 0, "Should find vendor");
      assert.ok(results.some(v => v.name === "Searchable Vendor ABC"));
    });

    it("should search by email", async () => {
      const { createVendor, searchVendors } = await import("../dist/domain/vendors.js");

      createVendor({ name: "Email Search Vendor", email: "unique-search@vendor.com" });

      const results = searchVendors("unique-search");

      assert.ok(results.length > 0, "Should find vendor by email");
    });

    it("should limit results to 10", async () => {
      const { createVendor, searchVendors } = await import("../dist/domain/vendors.js");

      // Create many vendors
      for (let i = 0; i < 15; i++) {
        createVendor({ name: `Limit Test Vendor ${i}` });
      }

      const results = searchVendors("Limit Test");
      assert.ok(results.length <= 10, "Should limit to 10 results");
    });
  });
});
