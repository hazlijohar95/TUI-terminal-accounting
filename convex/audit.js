import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
/**
 * Log an audit event
 */
export const log = mutation({
    args: {
        orgId: v.id("organizations"),
        userId: v.optional(v.string()),
        apiKeyId: v.optional(v.id("apiKeys")),
        action: v.union(v.literal("create"), v.literal("update"), v.literal("delete"), v.literal("login"), v.literal("logout"), v.literal("export"), v.literal("api_call")),
        entityType: v.string(),
        entityId: v.optional(v.string()),
        changes: v.optional(v.string()),
        metadata: v.optional(v.string()),
        ipAddress: v.optional(v.string()),
        userAgent: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const id = await ctx.db.insert("auditLog", {
            ...args,
            timestamp: Date.now(),
        });
        return id;
    },
});
/**
 * Query audit logs for an organization
 */
export const list = query({
    args: {
        orgId: v.id("organizations"),
        entityType: v.optional(v.string()),
        entityId: v.optional(v.string()),
        limit: v.optional(v.number()),
        cursor: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        let query = ctx.db
            .query("auditLog")
            .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
            .order("desc");
        const logs = await query.take(args.limit ?? 100);
        // Filter by entity if specified
        const filtered = args.entityType
            ? logs.filter((log) => log.entityType === args.entityType &&
                (!args.entityId || log.entityId === args.entityId))
            : logs;
        return filtered.map((log) => ({
            _id: log._id,
            action: log.action,
            entityType: log.entityType,
            entityId: log.entityId,
            changes: log.changes ? JSON.parse(log.changes) : undefined,
            metadata: log.metadata ? JSON.parse(log.metadata) : undefined,
            timestamp: log.timestamp,
            userId: log.userId,
        }));
    },
});
/**
 * Get audit log for a specific entity
 */
export const getForEntity = query({
    args: {
        entityType: v.string(),
        entityId: v.string(),
        limit: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const logs = await ctx.db
            .query("auditLog")
            .withIndex("by_entity", (q) => q.eq("entityType", args.entityType).eq("entityId", args.entityId))
            .order("desc")
            .take(args.limit ?? 50);
        return logs.map((log) => ({
            _id: log._id,
            action: log.action,
            changes: log.changes ? JSON.parse(log.changes) : undefined,
            timestamp: log.timestamp,
            userId: log.userId,
        }));
    },
});
