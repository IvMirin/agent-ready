import { ActionOptions, assert } from "gadget-server";

export const run: ActionRun = async ({ params, logger, api, connections }) => {
  const shopId = assert(params.shopId, "shopId is required");
  const mutation = assert(params.mutation, "mutation is required");

  const shopifyClient = await connections.shopify.forShopId(shopId);
  const result = await shopifyClient.graphql(mutation, params.variables ?? undefined);

  logger.info({ shopId, result }, "Successfully executed Shopify GraphQL mutation");

  return result;
};

export const params = {
  shopId: { type: "string" },
  mutation: { type: "string" },
  variables: { type: "object", additionalProperties: true },
};

export const options: ActionOptions = {
  returnType: true,
};