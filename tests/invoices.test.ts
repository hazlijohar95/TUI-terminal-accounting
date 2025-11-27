import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert";
import { rmSync } from "fs";

const testDir = "/tmp/oa-invoice-test-" + Date.now();

describe("Invoices Domain", () => {
  before(async () => {
    const { mkdir } = await import("fs/promises");
    await mkdir(testDir, { recursive: true });
    process.chdir(testDir);
  });

  after(() => {
    process.chdir("/tmp");
    rmSync(testDir, { recursive: true, force: true });
  });

  describe("createInvoice", () => {
    it("should create a basic invoice", async () => {
      const { createInvoice, getInvoice } = await import("../dist/domain/invoices.js");
      const { createCustomer } = await import("../dist/domain/customers.js");

      // Create a customer first
      const customer = createCustomer({
        name: "Test Customer",
        email: "test@example.com",
      });

      const invoice = createInvoice({
        customer_id: customer.id,
        date: "2024-01-15",
        due_date: "2024-02-15",
        items: [
          {
            description: "Test Service",
            quantity: 2,
            unit_price: 100.0,
          },
        ],
      });

      assert.ok(invoice.id > 0, "Should return invoice with ID");
      assert.ok(invoice.number.startsWith("INV-"), "Invoice number should start with INV-");
      assert.strictEqual(invoice.subtotal, 200.0, "Subtotal should be 200");
      assert.strictEqual(invoice.status, "draft", "Default status should be draft");
    });

    it("should calculate tax correctly", async () => {
      const { createInvoice } = await import("../dist/domain/invoices.js");
      const { createCustomer } = await import("../dist/domain/customers.js");

      const customer = createCustomer({
        name: "Tax Test Customer",
        email: "tax@example.com",
      });

      const invoice = createInvoice({
        customer_id: customer.id,
        date: "2024-01-15",
        due_date: "2024-02-15",
        tax_rate: 6,
        items: [
          {
            description: "Taxable Service",
            quantity: 1,
            unit_price: 100.0,
          },
        ],
      });

      assert.strictEqual(invoice.subtotal, 100.0, "Subtotal should be 100");
      assert.strictEqual(invoice.tax_rate, 6, "Tax rate should be 6%");
      assert.strictEqual(invoice.tax_amount, 6.0, "Tax amount should be 6");
      assert.strictEqual(invoice.total, 106.0, "Total should be 106");
    });

    it("should handle multiple items", async () => {
      const { createInvoice } = await import("../dist/domain/invoices.js");
      const { createCustomer } = await import("../dist/domain/customers.js");

      const customer = createCustomer({
        name: "Multi Item Customer",
        email: "multi@example.com",
      });

      const invoice = createInvoice({
        customer_id: customer.id,
        date: "2024-01-15",
        due_date: "2024-02-15",
        items: [
          { description: "Item 1", quantity: 1, unit_price: 50.0 },
          { description: "Item 2", quantity: 2, unit_price: 75.0 },
          { description: "Item 3", quantity: 3, unit_price: 25.0 },
        ],
      });

      // 50 + 150 + 75 = 275
      assert.strictEqual(invoice.subtotal, 275.0, "Subtotal should be 275");
    });
  });

  describe("updateInvoiceStatus", () => {
    it("should update invoice status", async () => {
      const { createInvoice, updateInvoiceStatus, getInvoice } = await import(
        "../dist/domain/invoices.js"
      );
      const { createCustomer } = await import("../dist/domain/customers.js");

      const customer = createCustomer({
        name: "Status Test Customer",
        email: "status@example.com",
      });

      const invoice = createInvoice({
        customer_id: customer.id,
        date: "2024-01-15",
        due_date: "2024-02-15",
        items: [{ description: "Test", quantity: 1, unit_price: 100 }],
      });

      assert.strictEqual(invoice.status, "draft", "Initial status should be draft");

      const updated = updateInvoiceStatus(invoice.id, "sent");
      assert.ok(updated, "Should return updated invoice");
      assert.strictEqual(updated?.status, "sent", "Status should be sent");

      // Verify persistence
      const retrieved = getInvoice(invoice.id);
      assert.strictEqual(retrieved?.status, "sent", "Status should persist");
    });
  });

  describe("recordPaymentToInvoice", () => {
    it("should record partial payment", async () => {
      const { createInvoice, recordPaymentToInvoice } = await import(
        "../dist/domain/invoices.js"
      );
      const { createCustomer } = await import("../dist/domain/customers.js");

      const customer = createCustomer({
        name: "Payment Test Customer",
        email: "payment@example.com",
      });

      const invoice = createInvoice({
        customer_id: customer.id,
        date: "2024-01-15",
        due_date: "2024-02-15",
        items: [{ description: "Test", quantity: 1, unit_price: 100 }],
      });

      // Record partial payment
      const updated = recordPaymentToInvoice(invoice.id, 50);
      assert.ok(updated, "Should return updated invoice");
      assert.strictEqual(updated?.amount_paid, 50, "Amount paid should be 50");
      assert.strictEqual(updated?.status, "partial", "Status should be partial");
    });

    it("should mark as paid when fully paid", async () => {
      const { createInvoice, recordPaymentToInvoice } = await import(
        "../dist/domain/invoices.js"
      );
      const { createCustomer } = await import("../dist/domain/customers.js");

      const customer = createCustomer({
        name: "Full Payment Customer",
        email: "fullpay@example.com",
      });

      const invoice = createInvoice({
        customer_id: customer.id,
        date: "2024-01-15",
        due_date: "2024-02-15",
        items: [{ description: "Test", quantity: 1, unit_price: 100 }],
      });

      const updated = recordPaymentToInvoice(invoice.id, 100);
      assert.strictEqual(updated?.amount_paid, 100, "Amount paid should be 100");
      assert.strictEqual(updated?.status, "paid", "Status should be paid");
    });
  });

  describe("listInvoices", () => {
    it("should filter by status", async () => {
      const { createInvoice, updateInvoiceStatus, listInvoices } = await import(
        "../dist/domain/invoices.js"
      );
      const { createCustomer } = await import("../dist/domain/customers.js");

      const customer = createCustomer({
        name: "Filter Test Customer",
        email: "filter@example.com",
      });

      // Create invoices with different statuses
      const draft = createInvoice({
        customer_id: customer.id,
        date: "2024-01-15",
        due_date: "2024-02-15",
        items: [{ description: "Draft Item", quantity: 1, unit_price: 100 }],
      });

      const sent = createInvoice({
        customer_id: customer.id,
        date: "2024-01-15",
        due_date: "2024-02-15",
        items: [{ description: "Sent Item", quantity: 1, unit_price: 200 }],
      });
      updateInvoiceStatus(sent.id, "sent");

      // Filter by status
      const draftInvoices = listInvoices({ status: "draft" });
      const sentInvoices = listInvoices({ status: "sent" });

      assert.ok(
        draftInvoices.some((i) => i.id === draft.id),
        "Draft invoice should be in draft list"
      );
      assert.ok(
        sentInvoices.some((i) => i.id === sent.id),
        "Sent invoice should be in sent list"
      );
    });
  });

  describe("getInvoiceSummary", () => {
    it("should calculate summary statistics", async () => {
      const { getInvoiceSummary } = await import("../dist/domain/invoices.js");

      const summary = getInvoiceSummary();

      assert.ok(typeof summary.total_outstanding === "number", "total_outstanding should be a number");
      assert.ok(typeof summary.total_overdue === "number", "total_overdue should be a number");
      assert.ok(typeof summary.count_outstanding === "number", "count_outstanding should be a number");
      assert.ok(typeof summary.count_overdue === "number", "count_overdue should be a number");
    });
  });
});

describe("E-Invoice Status", () => {
  it("should update e-invoice status", async () => {
    const { createInvoice, updateEInvoiceStatus, getInvoice } = await import(
      "../dist/domain/invoices.js"
    );
    const { createCustomer } = await import("../dist/domain/customers.js");

    const customer = createCustomer({
      name: "E-Invoice Customer",
      email: "einvoice@example.com",
    });

    const invoice = createInvoice({
      customer_id: customer.id,
      date: "2024-01-15",
      due_date: "2024-02-15",
      items: [{ description: "Test", quantity: 1, unit_price: 100 }],
    });

    // Update to pending
    updateEInvoiceStatus(invoice.id, {
      status: "pending",
      submissionUid: "SUB-001",
    });

    let retrieved = getInvoice(invoice.id);
    assert.strictEqual(retrieved?.einvoice_status, "pending");
    assert.strictEqual(retrieved?.einvoice_submission_uid, "SUB-001");

    // Update to valid
    updateEInvoiceStatus(invoice.id, {
      status: "valid",
      uuid: "UUID-12345",
      longId: "LONG-ID-12345",
    });

    retrieved = getInvoice(invoice.id);
    assert.strictEqual(retrieved?.einvoice_status, "valid");
    assert.strictEqual(retrieved?.einvoice_uuid, "UUID-12345");
    assert.ok(retrieved?.einvoice_validated_at, "Should have validated_at timestamp");
  });
});
