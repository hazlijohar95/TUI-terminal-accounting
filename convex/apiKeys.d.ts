/**
 * Create a new API key for an organization
 */
export declare const create: any;
/**
 * Validate an API key by its prefix
 * Returns the key record if found (for hash comparison)
 */
export declare const validateByPrefix: any;
/**
 * Update the last used timestamp for an API key
 */
export declare const updateLastUsed: any;
/**
 * List API keys for an organization
 * Note: Does not return the key hash
 */
export declare const list: any;
/**
 * Revoke (deactivate) an API key
 */
export declare const revoke: any;
/**
 * Delete an API key permanently
 */
export declare const remove: any;
