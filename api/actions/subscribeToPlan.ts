import { assert, ActionOptions } from "gadget-server";

export const run: ActionRun = async ({ params, logger, api, connections, currentAppUrl }) => {
  const shopId = assert(params.shopId, "shopId is required");
  const plan = assert(params.plan, "plan is required");

  if (plan === "starter") {
    throw new Error("Starter plan is free, no subscription needed");
  }

  if (plan !== "pro" && plan !== "growth") {
    throw new Error(`Invalid plan: ${plan}. Must be "pro" or "growth"`);
  }

  const planDetails: Record<string, { name: string; price: number; trialDays: number }> = {
    pro: { name: "ASR Pro", price: 19.0, trialDays: 14 },
    growth: { name: "ASR Growth", price: 49.0, trialDays: 14 },
  };

  const { name, price, trialDays } = planDetails[plan];

  const shopifyClient = await connections.shopify.forShopId(shopId);

  const shop = await api.shopifyShop.findOne(shopId, {
    select: { myshopifyDomain: true },
  });

  const mutation = `
    mutation appSubscriptionCreate($name: String!, $lineItems: [AppSubscriptionLineItemInput!]!, $returnUrl: URL!, $trialDays: Int, $test: Boolean) {
      appSubscriptionCreate(name: $name, lineItems: $lineItems, returnUrl: $returnUrl, trialDays: $trialDays, test: $test) {
        appSubscription {
          id
          status
        }
        confirmationUrl
        userErrors {
          field
          message
        }
      }
    }
  `;

  const result = await shopifyClient.graphql(mutation, {
    name,
    returnUrl: `${currentAppUrl}?shop=${shop.myshopifyDomain}&plan=${plan}`,
    trialDays,
    test: process.env.NODE_ENV !== "production",
    lineItems: [
      {
        plan: {
          appRecurringPricingDetails: {
            price: { amount: price, currencyCode: "USD" },
            interval: "EVERY_30_DAYS",
          },
        },
      },
    ],
  });

  const userErrors = result.appSubscriptionCreate?.userErrors;
  if (userErrors && userErrors.length > 0) {
    throw new Error(userErrors.map((e: { message: string }) => e.message).join(", "));
  }

  return {
    confirmationUrl: result.appSubscriptionCreate.confirmationUrl,
    subscriptionId: result.appSubscriptionCreate.appSubscription.id,
  };
};

export const params = {
  shopId: { type: "string" },
  plan: { type: "string" },
};

export const options: ActionOptions = {
  returnType: true,
};