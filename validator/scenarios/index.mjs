/**
 * @file Barrel module — re-exports every scenario group. New scenario files
 * should be added here so {@link validator/run.mjs} picks them up.
 */

export { authScenarios } from "./auth.mjs";
export { cartScenarios } from "./cart.mjs";
export { catalogScenarios } from "./catalog.mjs";
export { checkoutScenarios } from "./checkout.mjs";
export { themeScenarios } from "./theme.mjs";
export { visualScenarios } from "./visual.mjs";
