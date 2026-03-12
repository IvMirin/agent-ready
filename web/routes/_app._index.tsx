import { useFindFirst, useFindMany } from "@gadgetinc/react";
import {
  Badge,
  Banner,
  BlockStack,
  Box,
  Card,
  EmptyState,
  InlineGrid,
  InlineStack,
  Layout,
  Page,
  ProgressBar,
  Spinner,
  Text,
} from "@shopify/polaris";
import { api } from "../api";
import { UpgradeBanner } from "../components/UpgradeBanner";

// Human-readable failure reasons — no jargon for the merchant
function humanFailReason(reason: string | null | undefined): string | null {
  const map: Record<string, string> = {
    MISSING_WEIGHT: "Missing weight",
    MISSING_DIMENSIONS: "Missing dimensions",
    MISSING_MATERIAL: "Missing material",
    MISSING_VARIANT_ID: "Missing Shopify variant",
    AMBIGUOUS_DESCRIPTION: "Ambiguous description",
    NO_STRUCTURED_DATA: "No structured data",
  };
  return reason ? (map[reason] ?? null) : null;
}

export default function Index() {
  const [{ data: simulations, fetching: simFetching, error: simError }] =
    useFindMany(api.a2ASimulation, {
      first: 250,
      select: {
        id: true,
        resultStatus: true,
        failureReason: true,
        agentType: true,
        createdAt: true,
        product: { id: true, title: true },
      },
    });

  const [{ data: products, fetching: prodFetching, error: prodError }] =
    useFindMany(api.shopifyProduct, {
      first: 250,
      select: { id: true, title: true, isAgentReady: true },
    });

  const [{ data: shopData }] = useFindFirst(api.shopifyShop, {
    select: { id: true, plan: true },
  });

  const [{ data: citations, fetching: citFetching, error: citError }] =
    useFindMany(api.citationEvent, {
      first: 10,
      sort: { createdAt: "Descending" },
      select: {
        id: true,
        sourceEngine: true,
        triggerQuery: true,
        citedProduct: { id: true, title: true },
        createdAt: true,
      },
    });

  const error = simError || prodError || citError;

  // ── Stats ──────────────────────────────────────────────────
  const totalProducts = products?.length ?? 0;
  const readyProducts = products?.filter((p) => p.isAgentReady).length ?? 0;
  const notReadyProducts = totalProducts - readyProducts;
  const readyPct =
    totalProducts > 0 ? Math.round((readyProducts / totalProducts) * 100) : 0;

  const totalSimulations = simulations?.length ?? 0;
  const passCount = simulations?.filter((s) => s.resultStatus === "PASS").length ?? 0;
  const passRate =
    totalSimulations > 0
      ? `${Math.round((passCount / totalSimulations) * 100)}%`
      : "—";
  const passRateNum =
    totalSimulations > 0 ? Math.round((passCount / totalSimulations) * 100) : 0;

  const totalCitations = citations?.length ?? 0;

  const recentSimulations = simulations
    ? [...simulations]
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        .slice(0, 5)
    : [];

  const recentCitations = citations ? [...citations].slice(0, 5) : [];

  const resultStatusTone = (status: string | null | undefined) => {
    if (status === "PASS") return "success" as const;
    if (status === "SOFT_FAIL") return "warning" as const;
    if (status === "HARD_FAIL") return "critical" as const;
    return undefined;
  };

  // ── Merchant-friendly status label ────────────────────────
  const resultStatusLabel = (status: string | null | undefined): string => {
    if (status === "PASS") return "✓ Will buy";
    if (status === "SOFT_FAIL") return "⚠ Will skip";
    if (status === "HARD_FAIL") return "✗ Blocked";
    return status ?? "—";
  };

  if (error) {
    return (
      <Page title="AI Sales Rep" subtitle="Your store's visibility in AI search engines">
        <Banner tone="critical">
          <Text as="p" variant="bodyMd">
            {error.message ?? "Failed to load data."}
          </Text>
        </Banner>
      </Page>
    );
  }

  const isLoading = simFetching || prodFetching || citFetching;

  if (isLoading && !simulations && !products && !citations) {
    return (
      <Page title="AI Sales Rep" subtitle="Your store's visibility in AI search engines">
        <Layout>
          <Layout.Section>
            <Box padding="800">
              <BlockStack gap="400" inlineAlign="center">
                <Spinner size="large" />
              </BlockStack>
            </Box>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  return (
    <Page
      title="AI Sales Rep"
      subtitle={
        totalProducts > 0
          ? `${readyPct}% of your catalog is visible to Perplexity and SearchGPT`
          : "Your store's visibility in AI search engines"
      }
    >
      <Layout>
        <Layout.Section>
          <UpgradeBanner productCount={totalProducts} plan={shopData?.plan} />
        </Layout.Section>

        {/* Urgent banner — shown only when products are invisible */}
        {notReadyProducts > 0 && !isLoading && (
          <Layout.Section>
            <Banner
              tone="warning"
              title={`${notReadyProducts} of ${totalProducts} products are skipped by Perplexity and SearchGPT`}
            >
              <Text as="p" variant="bodyMd">
                Go to{" "}
                <strong>Products</strong>{" "}
                and click "Fix & Optimize" on red products.
              </Text>
            </Banner>
          </Layout.Section>
        )}

        {/* Top row — 4 stat cards with revenue language */}
        <Layout.Section>
          <InlineGrid columns={4} gap="400">

            {/* Card 1: AI visibility — replaces "Total Products" */}
            <Card>
              <BlockStack gap="200" inlineAlign="center">
                <Text
                  as="p"
                  variant="headingXl"
                  alignment="center"
                  tone={readyPct >= 70 ? "success" : readyPct >= 40 ? undefined : "critical"}
                >
                  {readyProducts} / {totalProducts}
                </Text>
                <Text as="p" variant="bodySm" tone="subdued" alignment="center">
                  Products visible in AI search
                </Text>
                <ProgressBar
                  progress={readyPct}
                  tone={readyPct >= 70 ? "success" : "critical"}
                  size="small"
                />
                <Text as="p" variant="bodySm" tone="subdued" alignment="center">
                  {notReadyProducts > 0
                    ? `${notReadyProducts} hidden from Perplexity`
                    : "Entire catalog optimized 🎉"}
                </Text>
              </BlockStack>
            </Card>

            {/* Card 2: Simulations — unchanged count, better label */}
            <Card>
              <BlockStack gap="200" inlineAlign="center">
                <Text as="p" variant="headingXl" alignment="center">
                  {totalSimulations}
                </Text>
                <Text as="p" variant="bodySm" tone="subdued" alignment="center">
                  Checks run
                </Text>
                <Text as="p" variant="bodySm" tone="subdued" alignment="center">
                  {totalSimulations > 0
                    ? "AI purchase simulations"
                    : "Go to Products → \"Check\""}
                </Text>
              </BlockStack>
            </Card>

            {/* Card 3: Pass Rate — replaces plain "%" with context */}
            <Card>
              <BlockStack gap="200" inlineAlign="center">
                <Text
                  as="p"
                  variant="headingXl"
                  alignment="center"
                  tone={passRateNum >= 70 ? "success" : passRateNum >= 40 ? undefined : "critical"}
                >
                  {passRate}
                </Text>
                <Text as="p" variant="bodySm" tone="subdued" alignment="center">
                  AI agent will buy
                </Text>
                {totalSimulations > 0 && (
                  <ProgressBar
                    progress={passRateNum}
                    tone={passRateNum >= 70 ? "success" : "critical"}
                    size="small"
                  />
                )}
                <Text as="p" variant="bodySm" tone="subdued" alignment="center">
                  {totalSimulations > 0
                    ? `${passCount} of ${totalSimulations} checks passed`
                    : "Run a check on Products"}
                </Text>
              </BlockStack>
            </Card>

            {/* Card 4: Citations — replaces "Citations Tracked" */}
            <Card>
              <BlockStack gap="200" inlineAlign="center">
                <Text as="p" variant="headingXl" alignment="center">
                  {totalCitations}
                </Text>
                <Text as="p" variant="bodySm" tone="subdued" alignment="center">
                  AI search mentions
                </Text>
                <Text as="p" variant="bodySm" tone="subdued" alignment="center">
                  {totalCitations > 0
                    ? "Shoppers found you via Perplexity"
                    : "No mentions yet"}
                </Text>
              </BlockStack>
            </Card>

          </InlineGrid>
        </Layout.Section>

        {/* Recent Simulations — merchant-friendly labels */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <BlockStack gap="100">
                <Text as="h2" variant="headingMd">
                  Recent checks: will AI buy your product?
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  ✓ Will buy — product is recommended ·{" "}
                  ✗ Blocked — data needs fixing
                </Text>
              </BlockStack>
              {simFetching && !simulations ? (
                <Box padding="400">
                  <BlockStack gap="200" inlineAlign="center">
                    <Spinner size="small" />
                  </BlockStack>
                </Box>
              ) : recentSimulations.length === 0 ? (
                <EmptyState
                  heading="No checks yet"
                  image=""
                  action={{ content: "Run a check", url: "/simulator" }}
                >
                  <Text as="p" variant="bodyMd">
                    Go to Products and click "Check: will AI buy?" on any product.
                  </Text>
                </EmptyState>
              ) : (
                <BlockStack gap="300">
                  {recentSimulations.map((sim) => {
                    const reason = humanFailReason(
                      sim.failureReason as string | null | undefined
                    );
                    return (
                      <Box
                        key={sim.id}
                        padding="300"
                        borderWidth="025"
                        borderColor="border"
                        borderRadius="200"
                      >
                        <InlineStack
                          align="space-between"
                          blockAlign="center"
                          gap="400"
                        >
                          <BlockStack gap="100">
                            <Text as="span" variant="bodyMd" fontWeight="semibold">
                              {sim.product?.title ?? "Unknown product"}
                            </Text>
                            <Text as="span" variant="bodySm" tone="subdued">
                              {new Date(sim.createdAt).toLocaleDateString()}
                            </Text>
                          </BlockStack>
                          <InlineStack gap="200">
                            <Badge>{sim.agentType ?? "—"}</Badge>
                            <Badge tone={resultStatusTone(sim.resultStatus)}>
                              {resultStatusLabel(sim.resultStatus)}
                            </Badge>
                            {reason && (
                              <Badge tone="critical">{reason}</Badge>
                            )}
                          </InlineStack>
                        </InlineStack>
                      </Box>
                    );
                  })}
                </BlockStack>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Recent Citations */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <BlockStack gap="100">
                <Text as="h2" variant="headingMd">
                  AI search engine mentions
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  Each mention is a potential customer who found you via Perplexity or SearchGPT
                </Text>
              </BlockStack>
              {citFetching && !citations ? (
                <Box padding="400">
                  <BlockStack gap="200" inlineAlign="center">
                    <Spinner size="small" />
                  </BlockStack>
                </Box>
              ) : recentCitations.length === 0 ? (
                <Text as="p" variant="bodyMd" tone="subdued">
                  Once Perplexity or SearchGPT mentions your product, it will appear here. Optimize your catalog to speed up the first mention.
                </Text>
              ) : (
                <BlockStack gap="300">
                  {recentCitations.map((cit) => (
                    <Box
                      key={cit.id}
                      padding="300"
                      borderWidth="025"
                      borderColor="border"
                      borderRadius="200"
                    >
                      <InlineStack
                        align="space-between"
                        blockAlign="center"
                        gap="400"
                      >
                        <BlockStack gap="100">
                          <Text as="span" variant="bodyMd" fontWeight="semibold">
                            {cit.triggerQuery ?? "—"}
                          </Text>
                          <Text as="span" variant="bodySm" tone="subdued">
                            {cit.citedProduct?.title ?? "Product not identified"} ·{" "}
                            {new Date(cit.createdAt).toLocaleDateString()}
                          </Text>
                        </BlockStack>
                        <Badge>{cit.sourceEngine ?? "—"}</Badge>
                      </InlineStack>
                    </Box>
                  ))}
                </BlockStack>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

      </Layout>
    </Page>
  );
}
