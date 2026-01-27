/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ai_decisions from "../ai/decisions.js";
import type * as ai_helpers from "../ai/helpers.js";
import type * as ai_prompts from "../ai/prompts.js";
import type * as ai_providers_anthropic from "../ai/providers/anthropic.js";
import type * as data_techTree from "../data/techTree.js";
import type * as init from "../init.js";
import type * as queries from "../queries.js";
import type * as simulation_buildings from "../simulation/buildings.js";
import type * as simulation_combat from "../simulation/combat.js";
import type * as simulation_controls from "../simulation/controls.js";
import type * as simulation_demographics from "../simulation/demographics.js";
import type * as simulation_disease from "../simulation/disease.js";
import type * as simulation_economy from "../simulation/economy.js";
import type * as simulation_military from "../simulation/military.js";
import type * as simulation_resources from "../simulation/resources.js";
import type * as simulation_siege from "../simulation/siege.js";
import type * as simulation_society from "../simulation/society.js";
import type * as simulation_technology from "../simulation/technology.js";
import type * as simulation_tick from "../simulation/tick.js";
import type * as simulation_trade from "../simulation/trade.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "ai/decisions": typeof ai_decisions;
  "ai/helpers": typeof ai_helpers;
  "ai/prompts": typeof ai_prompts;
  "ai/providers/anthropic": typeof ai_providers_anthropic;
  "data/techTree": typeof data_techTree;
  init: typeof init;
  queries: typeof queries;
  "simulation/buildings": typeof simulation_buildings;
  "simulation/combat": typeof simulation_combat;
  "simulation/controls": typeof simulation_controls;
  "simulation/demographics": typeof simulation_demographics;
  "simulation/disease": typeof simulation_disease;
  "simulation/economy": typeof simulation_economy;
  "simulation/military": typeof simulation_military;
  "simulation/resources": typeof simulation_resources;
  "simulation/siege": typeof simulation_siege;
  "simulation/society": typeof simulation_society;
  "simulation/technology": typeof simulation_technology;
  "simulation/tick": typeof simulation_tick;
  "simulation/trade": typeof simulation_trade;
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
