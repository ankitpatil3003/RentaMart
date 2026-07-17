/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ai from "../ai.js";
import type * as aiActions from "../aiActions.js";
import type * as applications from "../applications.js";
import type * as emailActions from "../emailActions.js";
import type * as http from "../http.js";
import type * as landlordRequests from "../landlordRequests.js";
import type * as leases from "../leases.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_customFunctions from "../lib/customFunctions.js";
import type * as lib_money from "../lib/money.js";
import type * as lib_notificationHelpers from "../lib/notificationHelpers.js";
import type * as listings from "../listings.js";
import type * as maintenance from "../maintenance.js";
import type * as messages from "../messages.js";
import type * as notifications from "../notifications.js";
import type * as orgInvites from "../orgInvites.js";
import type * as orgs from "../orgs.js";
import type * as orgsActions from "../orgsActions.js";
import type * as payments from "../payments.js";
import type * as paymentsActions from "../paymentsActions.js";
import type * as refunds from "../refunds.js";
import type * as refundsActions from "../refundsActions.js";
import type * as rent from "../rent.js";
import type * as screening from "../screening.js";
import type * as seed from "../seed.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  ai: typeof ai;
  aiActions: typeof aiActions;
  applications: typeof applications;
  emailActions: typeof emailActions;
  http: typeof http;
  landlordRequests: typeof landlordRequests;
  leases: typeof leases;
  "lib/auth": typeof lib_auth;
  "lib/customFunctions": typeof lib_customFunctions;
  "lib/money": typeof lib_money;
  "lib/notificationHelpers": typeof lib_notificationHelpers;
  listings: typeof listings;
  maintenance: typeof maintenance;
  messages: typeof messages;
  notifications: typeof notifications;
  orgInvites: typeof orgInvites;
  orgs: typeof orgs;
  orgsActions: typeof orgsActions;
  payments: typeof payments;
  paymentsActions: typeof paymentsActions;
  refunds: typeof refunds;
  refundsActions: typeof refundsActions;
  rent: typeof rent;
  screening: typeof screening;
  seed: typeof seed;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
