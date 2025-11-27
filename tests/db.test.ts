import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { existsSync, rmSync } from 'fs';

// Change to temp directory for tests
const testDir = '/tmp/oa-test-' + Date.now();

describe('Database', () => {
  before(async () => {
    const { mkdir } = await import('fs/promises');
    await mkdir(testDir, { recursive: true });
    process.chdir(testDir);
  });

  after(() => {
    process.chdir('/tmp');
    rmSync(testDir, { recursive: true, force: true });
  });

  it('should initialize database on first access', async () => {
    const { getDb } = await import('../dist/db/index.js');
    const db = getDb();
    assert.ok(db, 'Database should be created');
    assert.ok(existsSync('oa.db'), 'Database file should exist');
  });

  it('should create required tables', async () => {
    const { getDb } = await import('../dist/db/index.js');
    const db = getDb();

    const tables = db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' ORDER BY name
    `).all() as { name: string }[];

    const tableNames = tables.map(t => t.name);
    assert.ok(tableNames.includes('customers'), 'customers table should exist');
    assert.ok(tableNames.includes('vendors'), 'vendors table should exist');
    assert.ok(tableNames.includes('invoices'), 'invoices table should exist');
    assert.ok(tableNames.includes('expenses'), 'expenses table should exist');
    assert.ok(tableNames.includes('settings'), 'settings table should exist');
  });

  it('should set and get settings', async () => {
    const { getSetting, setSetting } = await import('../dist/db/index.js');

    setSetting('test_key', 'test_value');
    const value = getSetting('test_key');
    assert.strictEqual(value, 'test_value');
  });
});

describe('Customers', () => {
  it('should create and retrieve customers', async () => {
    const { createCustomer, listCustomers } = await import('../dist/domain/customers.js');

    const customer = createCustomer({
      name: 'Test Customer',
      email: 'test@example.com',
      address: '123 Test St',
    });

    assert.ok(customer.id > 0, 'Should return customer with ID');

    const customers = listCustomers();
    const found = customers.find(c => c.id === customer.id);
    assert.ok(found, 'Customer should be retrievable');
    assert.strictEqual(found?.name, 'Test Customer');
  });
});

describe('Expenses', () => {
  it('should create and retrieve expenses', async () => {
    const { createExpense, listExpenses } = await import('../dist/domain/expenses.js');
    const { getDb } = await import('../dist/db/index.js');

    // Get a valid account ID for expenses
    const db = getDb();
    const account = db.prepare("SELECT id FROM accounts WHERE type = 'expense' LIMIT 1").get() as { id: number };

    const expense = createExpense({
      date: '2024-01-15',
      account_id: account.id,
      amount: 99.99,
      description: 'Test expense',
    });

    assert.ok(expense.id > 0, 'Should return expense with ID');

    const expenses = listExpenses({});
    const found = expenses.find(e => e.id === expense.id);
    assert.ok(found, 'Expense should be retrievable');
    assert.strictEqual(found?.amount, 99.99);
  });
});
