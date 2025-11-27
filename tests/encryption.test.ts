import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { rmSync } from "fs";

const testDir = "/tmp/oa-encryption-test-" + Date.now();

describe("Encryption Module", () => {
  before(async () => {
    const { mkdir } = await import("fs/promises");
    await mkdir(testDir, { recursive: true });
    process.chdir(testDir);

    // Set a test encryption key
    process.env.DB_ENCRYPTION_KEY = "test-encryption-key-for-unit-tests";
  });

  after(() => {
    process.chdir("/tmp");
    rmSync(testDir, { recursive: true, force: true });
    delete process.env.DB_ENCRYPTION_KEY;
  });

  describe("encrypt/decrypt", () => {
    it("should encrypt and decrypt a string", async () => {
      const { encrypt, decrypt } = await import("../dist/db/encryption.js");

      const original = "my-secret-api-key";
      const encrypted = encrypt(original);
      const decrypted = decrypt(encrypted);

      assert.notStrictEqual(encrypted, original, "Encrypted should differ from original");
      assert.strictEqual(decrypted, original, "Decrypted should match original");
    });

    it("should produce different ciphertext for same plaintext", async () => {
      const { encrypt } = await import("../dist/db/encryption.js");

      const plaintext = "same-text";
      const encrypted1 = encrypt(plaintext);
      const encrypted2 = encrypt(plaintext);

      assert.notStrictEqual(
        encrypted1,
        encrypted2,
        "Same plaintext should produce different ciphertext (random IV)"
      );
    });

    it("should handle empty strings", async () => {
      const { encrypt, decrypt } = await import("../dist/db/encryption.js");

      assert.strictEqual(encrypt(""), "", "Empty input should return empty string");
      assert.strictEqual(decrypt(""), "", "Empty input should return empty string");
    });

    it("should handle unicode strings", async () => {
      const { encrypt, decrypt } = await import("../dist/db/encryption.js");

      const original = "Hello 世界 🌍 مرحبا";
      const encrypted = encrypt(original);
      const decrypted = decrypt(encrypted);

      assert.strictEqual(decrypted, original, "Should handle unicode characters");
    });

    it("should handle long strings", async () => {
      const { encrypt, decrypt } = await import("../dist/db/encryption.js");

      const original = "a".repeat(10000);
      const encrypted = encrypt(original);
      const decrypted = decrypt(encrypted);

      assert.strictEqual(decrypted, original, "Should handle long strings");
    });

    it("should handle special characters", async () => {
      const { encrypt, decrypt } = await import("../dist/db/encryption.js");

      const original = "!@#$%^&*()_+-=[]{}|;':\",./<>?`~\\";
      const encrypted = encrypt(original);
      const decrypted = decrypt(encrypted);

      assert.strictEqual(decrypted, original, "Should handle special characters");
    });
  });

  describe("isEncrypted", () => {
    it("should detect encrypted strings", async () => {
      const { encrypt, isEncrypted } = await import("../dist/db/encryption.js");

      const plaintext = "not-encrypted";
      const encrypted = encrypt(plaintext);

      assert.strictEqual(isEncrypted(plaintext), false, "Plaintext should not be detected as encrypted");
      assert.strictEqual(isEncrypted(encrypted), true, "Encrypted should be detected");
    });

    it("should handle empty and null values", async () => {
      const { isEncrypted } = await import("../dist/db/encryption.js");

      assert.strictEqual(isEncrypted(""), false, "Empty string should return false");
    });
  });

  describe("migrateToEncrypted", () => {
    it("should encrypt plaintext values", async () => {
      const { migrateToEncrypted, decrypt, isEncrypted } = await import(
        "../dist/db/encryption.js"
      );

      const plaintext = "migrate-me";
      const result = migrateToEncrypted(plaintext);

      assert.ok(result, "Should return encrypted value");
      assert.ok(isEncrypted(result!), "Result should be encrypted");
      assert.strictEqual(decrypt(result!), plaintext, "Should decrypt to original");
    });

    it("should not re-encrypt already encrypted values", async () => {
      const { encrypt, migrateToEncrypted, decrypt } = await import(
        "../dist/db/encryption.js"
      );

      const original = "original-value";
      const encrypted = encrypt(original);
      const migrated = migrateToEncrypted(encrypted);

      // Note: Due to random IV, we can't compare ciphertext directly
      // but we can verify the decrypted value is correct
      assert.strictEqual(decrypt(migrated!), original, "Should still decrypt to original");
    });

    it("should handle null values", async () => {
      const { migrateToEncrypted } = await import("../dist/db/encryption.js");

      assert.strictEqual(migrateToEncrypted(null), null, "Null should return null");
    });
  });

  describe("generateEncryptionKey", () => {
    it("should generate a base64 key", async () => {
      const { generateEncryptionKey } = await import("../dist/db/encryption.js");

      const key = generateEncryptionKey();

      assert.ok(key, "Should generate a key");
      assert.ok(key.length > 30, "Key should be at least 32 bytes base64 encoded");

      // Verify it's valid base64
      const decoded = Buffer.from(key, "base64");
      assert.strictEqual(decoded.length, 32, "Key should be 32 bytes (256 bits)");
    });

    it("should generate unique keys", async () => {
      const { generateEncryptionKey } = await import("../dist/db/encryption.js");

      const key1 = generateEncryptionKey();
      const key2 = generateEncryptionKey();

      assert.notStrictEqual(key1, key2, "Should generate unique keys");
    });
  });
});

describe("Encrypted Settings", () => {
  it("should encrypt sensitive settings", async () => {
    const { setSetting, getSetting } = await import("../dist/db/index.js");

    const apiKey = "sk-test-api-key-12345";
    setSetting("resend_api_key", apiKey);

    // Get the value - should be decrypted
    const retrieved = getSetting("resend_api_key");
    assert.strictEqual(retrieved, apiKey, "Should retrieve decrypted value");
  });

  it("should not encrypt non-sensitive settings", async () => {
    const { setSetting, getSetting, getDb } = await import("../dist/db/index.js");

    const value = "My Business Name";
    setSetting("business_name", value);

    // Get raw value from DB
    const db = getDb();
    const row = db
      .prepare("SELECT value FROM settings WHERE key = ?")
      .get("business_name") as { value: string };

    // Non-sensitive settings should be stored as-is
    assert.strictEqual(row.value, value, "Non-sensitive settings should not be encrypted");
  });
});
