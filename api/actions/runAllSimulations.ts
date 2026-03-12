import { ActionOptions, assert } from "gadget-server";

export const run: ActionRun = async ({ params, logger, api }) => {
  const shopId = assert(params.shopId, "shopId is required");

  let hasNextPage = true;
  let cursor: string | undefined;
  let totalEnqueued = 0;

  while (hasNextPage) {
    const page = await api.shopifyProduct.findMany({
      first: 250,
      after: cursor,
      filter: { shopId: { equals: shopId } },
      select: { id: true },
    });

    for (const product of page) {
      const sim = await api.a2ASimulation.create({
        product: { _link: product.id },
        shop: { _link: shopId },
        agentType: "GPT4Agent",
      });
      await api.enqueue(api.a2ASimulation.runSimulation, sim.id);
      totalEnqueued++;
    }

    hasNextPage = page.hasNextPage;
    cursor = page.endCursor;
  }

  logger.info({ totalEnqueued }, `Enqueued ${totalEnqueued} simulations for shop ${shopId}`);

  return { enqueuedCount: totalEnqueued };
};

export const params = {
  shopId: { type: "string" },
};

export const options: ActionOptions = {
  returnType: true,
};