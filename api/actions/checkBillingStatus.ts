import { ActionOptions } from "gadget-server";
import { assert } from "gadget-server";

export const run: ActionRun = async ({ params, logger, api, connections }) => {
  const shopId = assert(params.shopId, "shopId is required");

  const shopify = await connections.shopify.forShopId(shopId);

  const result = await shopify.graphql(`
    query {
      currentAppInstallation {
        activeSubscriptions {
          id
          name
          status
          lineItems {
            plan {
              pricingDetails {
                ... on AppRecurringPricing {
                  price { amount currencyCode }
                  interval
                }
              }
            }
          }
        }
      }
    }
  `);

  const activeSubscriptions = result.currentAppInstallation?.activeSubscriptions ?? [];

  let determinedPlan: "starter" | "pro" | "growth" = "starter";

  if (activeSubscriptions.length > 0) {
    const subscription = activeSubscriptions[0];
    const name: string = subscription.name ?? "";

    if (name.toLowerCase().includes("growth")) {
      determinedPlan = "growth";
    } else if (name.toLowerCase().includes("pro")) {
      determinedPlan = "pro";
    }
  }

  await api.internal.shopifyShop.update(shopId, { plan: determinedPlan });

  logger.info({ shopId, plan: determinedPlan }, "Updated shop billing plan");

  return { plan: determinedPlan };
};

export const params = {
  shopId: { type: "string" },
};

export const options: ActionOptions = {
  returnType: true,
};