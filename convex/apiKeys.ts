"use node";

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import bcrypt from "bcryptjs";
import crypto from "crypto";

/**
 * Generate a secure random API key
 */
function generateApiKey(): string {
  const bytes = crypto.randomBytes(24);
  return `oa_${bytes.toString("base64url")}`;
}

/**
 * Create a new API key for an organization
 */
export const create = mutation({
  args: {
    orgId: v.id("organizations"),
    name: v.string(),
    scopes: v.array(v.string()),
    expiresInDays: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Generate the raw API key
    const rawKey = generateApiKey();

    // Hash the key for storage
    const keyHash = await bcrypt.hash(rawKey, 10);

    // Extract prefix for lookup (oa_ + first 8 chars)
    const keyPrefix = rawKey.substring(0, 11);

    // Calculate expiration
    const expiresAt = args.expiresInDays
      ? Date.now() + args.expiresInDays * 24 * 60 * 60 * 1000
      : undefined;

    // Store in database
    const id = await ctx.db.insert("apiKeys", {
      orgId: args.orgId,
      keyHash,
      keyPrefix,
      name: args.name,
      scopes: args.scopes,
      expiresAt,
      isActive: true,
      createdAt: Date.now(),
    });

    // Return the raw key - this is the only time it will be visible
    return {
      id,
      key: rawKey,
      prefix: keyPrefix,
      name: args.name,
      scopes: args.scopes,
      expiresAt,
    };
  },
});

/**
 * Validate an API key by its prefix
 * Returns the key record if found (for hash comparison)
 */
export const validateByPrefix = query({
  args: {
    prefix: v.string(),
  },
  handler: async (ctx, args) => {
    const apiKey = await ctx.db
      .query("apiKeys")
      .withIndex("by_prefix", (q) => q.eq("keyPrefix", args.prefix))
      .first();

    if (!apiKey || !apiKey.isActive) {
      return null;
    }

    return {
      _id: apiKey._id,
      orgId: apiKey.orgId,
      keyHash: apiKey.keyHash,
      scopes: apiKey.scopes,
      expiresAt: apiKey.expiresAt,
    };
  },
});

/**
 * Update the last used timestamp for an API key
 */
export const updateLastUsed = mutation({
  args: {
    id: v.id("apiKeys"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      lastUsedAt: Date.now(),
    });
  },
});

/**
 * List API keys for an organization
 * Note: Does not return the key hash
 */
export const list = query({
  args: {
    orgId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    const keys = await ctx.db
      .query("apiKeys")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();

    return keys.map((key) => ({
      _id: key._id,
      name: key.name,
      keyPrefix: key.keyPrefix,
      scopes: key.scopes,
      lastUsedAt: key.lastUsedAt,
      expiresAt: key.expiresAt,
      isActive: key.isActive,
      createdAt: key.createdAt,
    }));
  },
});

/**
 * Revoke (deactivate) an API key
 */
export const revoke = mutation({
  args: {
    id: v.id("apiKeys"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      isActive: false,
    });
    return { success: true };
  },
});

/**
 * Delete an API key permanently
 */
export const remove = mutation({
  args: {
    id: v.id("apiKeys"),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return { success: true };
  },
});
