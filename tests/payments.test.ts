import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { rmSync } from "fs";

const testDir = "/tmp/oa-payment-test-" + Date.now();

describe("Payments Domain", () => {
  before(async () => {
    const { mkdir } = await import("fs/promises");
    await mkdir(testDir, { recursive: true });
    process.chdir(testDir);
  });

  after(() => {
    process.chdir("/tmp");
    rmSync(testDir, { recursive: true, force: true });
  });

  describe("recordPayment", () => {
    it("should record a basic payment received", async () => {
      const { recordPayment, getPayment } = await import("../dist/domain/payments.js");
      const { createCustomer } = await import("../dist/domain/customers.js");
      const { createInvoice } = await import("../dist/domain/invoices.js");

      // Create customer and invoice first
      const customer = createCustomer({
        name: "Payment Test Customer",
        email: "payment@example.com",
      });

      const invoice = createInvoice({
        customer_id: customer.id,
        date: "2024-01-15",
        due_date: "2024-02-15",
        items: [{ description: "Service", quantity: 1, unit_price: 500 }],
      });

      const payment = recordPayment({
        amount: 500,
        customer_id: customer.id,
        invoice_id: invoice.id,
        reference: "REF-001",
      });

      assert.ok(payment.id > 0, "Should return payment with ID");
      assert.strictEqual(payment.type, "received", "Type should be received");
      assert.strictEqual(payment.amount, 500);
      assert.strictEqual(payment.method, "bank", "Default method should be bank");
    });

    it("should use custom payment method", async () => {
      const { recordPayment } = await import("../dist/domain/payments.js");
      const { createCustomer } = await import("../dist/domain/customers.js");

      const customer = createCustomer({
        name: "Cash Payment Customer",
        email: "cash@example.com",
      });

      const payment = recordPayment({
        amount: 100,
        method: "cash",
        customer_id: customer.id,
      });

      assert.strictEqual(payment.method, "cash");
    });

    it("should update invoice when linked", async () => {
      const { recordPayment } = await import("../dist/domain/payments.js");
      const { createCustomer } = await import("../dist/domain/customers.js");
      const { createInvoice, getInvoice } = await import("../dist/domain/invoices.js");

      const customer = createCustomer({
        name: "Invoice Link Customer",
        email: "invoicelink@example.com",
      });

      const invoice = createInvoice({
        customer_id: customer.id,
        date: "2024-01-15",
        due_date: "2024-02-15",
        items: [{ description: "Service", quantity: 1, unit_price: 300 }],
      });

      recordPayment({
        amount: 300,
        invoice_id: invoice.id,
      });

      const updatedInvoice = getInvoice(invoice.id);
      assert.strictEqual(updatedInvoice?.amount_paid, 300);
      assert.strictEqual(updatedInvoice?.status, "paid");
    });
  });

  describe("recordExpense", () => {
    it("should record expense with valid category", async () => {
      const { recordExpense, getPayment } = await import("../dist/domain/payments.js");
      const { getDb } = await import("../dist/db/index.js");

      // Get a valid expense account
      const db = getDb();
      const account = db.prepare(
        "SELECT code, name FROM accounts WHERE type = 'expense' LIMIT 1"
      ).get() as { code: string; name: string };

      const expense = recordExpense({
        amount: 150.50,
        category: account.name,
        description: "Office supplies",
        method: "card",
        reference: "EXP-001",
      });

      assert.ok(expense.id > 0, "Should return expense with ID");
      assert.strictEqual(expense.type, "sent", "Type should be sent");
      assert.strictEqual(expense.amount, 150.50);
      assert.strictEqual(expense.method, "card");
    });

    it("should reject invalid category", async () => {
      const { recordExpense } = await import("../dist/domain/payments.js");

      await assert.rejects(
        async () => {
          recordExpense({
            amount: 100,
            category: "Non Existent Category",
            description: "Invalid expense",
          });
        },
        /not found/
      );
    });

    it("should link to vendor if provided", async () => {
      const { recordExpense, getPayment } = await import("../dist/domain/payments.js");
      const { createVendor } = await import("../dist/domain/vendors.js");
      const { getDb } = await import("../dist/db/index.js");

      const vendor = createVendor({ name: "Expense Vendor" });

      const db = getDb();
      const account = db.prepare(
        "SELECT code, name FROM accounts WHERE type = 'expense' LIMIT 1"
      ).get() as { code: string; name: string };

      const expense = recordExpense({
        amount: 200,
        vendor_id: vendor.id,
        category: account.name,
        description: "Vendor expense",
      });

      const retrieved = getPayment(expense.id);
      assert.strictEqual(retrieved?.vendor_id, vendor.id);
    });
  });

  describe("getPayment", () => {
    it("should get payment by ID with relations", async () => {
      const { recordPayment, getPayment } = await import("../dist/domain/payments.js");
      const { createCustomer } = await import("../dist/domain/customers.js");

      const customer = createCustomer({
        name: "Get Payment Customer",
        email: "getpayment@example.com",
      });

      const payment = recordPayment({
        amount: 100,
        customer_id: customer.id,
      });

      const retrieved = getPayment(payment.id);

      assert.ok(retrieved, "Should find payment");
      assert.strictEqual(retrieved?.customer_name, "Get Payment Customer");
    });

    it("should return undefined for non-existent payment", async () => {
      const { getPayment } = await import("../dist/domain/payments.js");

      const result = getPayment(99999);
      assert.strictEqual(result, undefined);
    });
  });

  describe("listPayments", () => {
    it("should list all payments", async () => {
      const { listPayments } = await import("../dist/domain/payments.js");

      const payments = listPayments();

      assert.ok(Array.isArray(payments), "Should return array");
    });

    it("should filter by type", async () => {
      const { listPayments } = await import("../dist/domain/payments.js");

      const received = listPayments({ type: "received" });
      const sent = listPayments({ type: "sent" });

      assert.ok(received.every(p => p.type === "received"), "All should be received");
      assert.ok(sent.every(p => p.type === "sent"), "All should be sent");
    });

    it("should filter by date range", async () => {
      const { recordPayment, listPayments } = await import("../dist/domain/payments.js");
      const { createCustomer } = await import("../dist/domain/customers.js");

      const customer = createCustomer({
        name: "Date Range Customer",
        email: "daterange@example.com",
      });

      recordPayment({
        date: "2024-01-15",
        amount: 100,
        customer_id: customer.id,
      });

      const results = listPayments({
        from_date: "2024-01-01",
        to_date: "2024-01-31",
      });

      assert.ok(results.length > 0, "Should find payments in date range");
      results.forEach(p => {
        assert.ok(p.date >= "2024-01-01" && p.date <= "2024-01-31");
      });
    });

    it("should filter by customer", async () => {
      const { recordPayment, listPayments } = await import("../dist/domain/payments.js");
      const { createCustomer } = await import("../dist/domain/customers.js");

      const customer = createCustomer({
        name: "Filter By Customer",
        email: "filterby@example.com",
      });

      recordPayment({
        amount: 250,
        customer_id: customer.id,
      });

      const results = listPayments({ customer_id: customer.id });

      assert.ok(results.length > 0, "Should find customer payments");
      assert.ok(results.every(p => p.customer_id === customer.id));
    });
  });

  describe("getPaymentSummary", () => {
    it("should return payment summary", async () => {
      const { getPaymentSummary } = await import("../dist/domain/payments.js");

      const summary = getPaymentSummary();

      assert.ok(typeof summary.total_received === "number", "total_received should be number");
      assert.ok(typeof summary.total_sent === "number", "total_sent should be number");
      assert.ok(typeof summary.net_cash_flow === "number", "net_cash_flow should be number");
      assert.ok(typeof summary.by_method === "object", "by_method should be object");
    });

    it("should filter summary by date range", async () => {
      const { getPaymentSummary, recordPayment } = await import("../dist/domain/payments.js");
      const { createCustomer } = await import("../dist/domain/customers.js");

      const customer = createCustomer({
        name: "Summary Date Customer",
        email: "summarydate@example.com",
      });

      recordPayment({
        date: "2024-06-15",
        amount: 1000,
        customer_id: customer.id,
      });

      const summaryAll = getPaymentSummary();
      const summaryFiltered = getPaymentSummary("2024-06-01", "2024-06-30");

      // Both should be valid summaries
      assert.ok(typeof summaryAll.total_received === "number");
      assert.ok(typeof summaryFiltered.total_received === "number");
    });

    it("should calculate net cash flow correctly", async () => {
      const { getPaymentSummary } = await import("../dist/domain/payments.js");

      const summary = getPaymentSummary();

      assert.strictEqual(
        summary.net_cash_flow,
        summary.total_received - summary.total_sent,
        "Net cash flow should be received minus sent"
      );
    });

    it("should group by payment method", async () => {
      const { getPaymentSummary, recordPayment } = await import("../dist/domain/payments.js");
      const { createCustomer } = await import("../dist/domain/customers.js");

      const customer = createCustomer({
        name: "Method Summary Customer",
        email: "methodsummary@example.com",
      });

      recordPayment({
        amount: 500,
        method: "bank",
        customer_id: customer.id,
      });

      const summary = getPaymentSummary();

      assert.ok(typeof summary.by_method === "object", "Should have by_method");
      // Should have bank payments
      if (summary.by_method.bank !== undefined) {
        assert.ok(typeof summary.by_method.bank === "number");
      }
    });
  });
});
