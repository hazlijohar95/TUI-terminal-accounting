/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type { FunctionReference } from "convex/server";

type AnyApi = {
  [module: string]: {
    [fn: string]: FunctionReference<any, any, any, any>;
  };
};

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: AnyApi;

/**
 * A utility for referencing Convex functions in your app's internal API.
 */
export declare const internal: AnyApi;

export declare const components: {};
