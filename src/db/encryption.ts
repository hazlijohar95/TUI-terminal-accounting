/**
 * Database Field Encryption Module
 *
 * Provides AES-256-GCM encryption for sensitive database fields
 * like API keys, passwords, and secrets.
 */

import * as crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;
const KEY_LENGTH = 32;

/**
 * Derives a 256-bit key from the master key using PBKDF2
 */
function deriveKey(masterKey: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(masterKey, salt, 100000, KEY_LENGTH, "sha256");
}

/**
 * Gets the encryption key from environment variable
 * Falls back to a warning if not set (for development)
 */
function getEncryptionKey(): string {
  const key = process.env.DB_ENCRYPTION_KEY;
  if (!key) {
    console.warn(
      "[SECURITY WARNING] DB_ENCRYPTION_KEY not set. Using fallback key. " +
        "Set DB_ENCRYPTION_KEY in production with: openssl rand -base64 32"
    );
    // Fallback for development - DO NOT use in production
    return "dev-fallback-key-do-not-use-in-production";
  }
  return key;
}

/**
 * Encrypts a plaintext string using AES-256-GCM
 *
 * Output format: base64(salt + iv + authTag + ciphertext)
 * - salt: 32 bytes (for key derivation)
 * - iv: 16 bytes (initialization vector)
 * - authTag: 16 bytes (authentication tag)
 * - ciphertext: variable length
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) return "";

  const masterKey = getEncryptionKey();
  const salt = crypto.randomBytes(SALT_LENGTH);
  const key = deriveKey(masterKey, salt);
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // Combine: salt + iv + authTag + ciphertext
  const combined = Buffer.concat([salt, iv, authTag, encrypted]);
  return combined.toString("base64");
}

/**
 * Decrypts an encrypted string using AES-256-GCM
 *
 * @param encryptedBase64 - Base64 encoded encrypted data
 * @returns Decrypted plaintext string
 * @throws Error if decryption fails (wrong key or tampered data)
 */
export function decrypt(encryptedBase64: string): string {
  if (!encryptedBase64) return "";

  try {
    const masterKey = getEncryptionKey();
    const combined = Buffer.from(encryptedBase64, "base64");

    // Extract components
    const salt = combined.subarray(0, SALT_LENGTH);
    const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const authTag = combined.subarray(
      SALT_LENGTH + IV_LENGTH,
      SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH
    );
    const ciphertext = combined.subarray(
      SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH
    );

    const key = deriveKey(masterKey, salt);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    return decrypted.toString("utf8");
  } catch (error) {
    // If decryption fails, the data might not be encrypted (legacy data)
    // Return the original value and log a warning
    console.warn(
      "[ENCRYPTION] Failed to decrypt value - may be unencrypted legacy data"
    );
    return encryptedBase64;
  }
}

/**
 * Checks if a string appears to be encrypted
 * (basic heuristic based on format)
 */
export function isEncrypted(value: string): boolean {
  if (!value) return false;

  try {
    const decoded = Buffer.from(value, "base64");
    // Check if it has the expected minimum length
    // (salt + iv + authTag = 64 bytes minimum)
    return decoded.length >= SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH;
  } catch {
    return false;
  }
}

/**
 * Migrates a plaintext value to encrypted format if not already encrypted
 */
export function migrateToEncrypted(value: string | null): string | null {
  if (!value) return null;
  if (isEncrypted(value)) return value;
  return encrypt(value);
}

/**
 * Generates a secure random encryption key for use in DB_ENCRYPTION_KEY
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString("base64");
}
