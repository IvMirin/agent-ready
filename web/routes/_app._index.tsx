import { useFindFirst, useFindMany } from "@gadgetinc/react";
import {
  Badge,
  Banner,
  BlockStack,
  Box,
  Button,
  Card,
  EmptyState,
  InlineGrid,
  InlineStack,
  Layout,
  Link,
  Page,
  ProgressBar,
  Spinner,
  Text,
} from "@shopify/polaris";
import { useNavigate } from "react-router";
import { api } from "../api";
import { UpgradeBanner } from "../components/UpgradeBanner";

// ── Helpers ────────────────────────────────────────────────────────────────

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

const statusTone = (s: string | null | undefined) => {
  if (s === "PASS") return "success" as const;
  if (s === "SOFT_FAIL") return "warning" as const;
  if (s === "HARD_FAIL") return "critical" as const;
  return undefined;
};
const statusLabel = (s: string | null | undefined) => {
  if (s === "PASS") return "✓ Will buy";
  if (s === "SOFT_FAIL") return "⚠ Will skip";
  if (s === "HARD_FAIL") return "✗ Blocked";
  return s ?? "—";
};

// ── AEO Health Score Ring ─────────────────────────────────────────────────

function AEOHealthRing({ score, size = 120 }: { score: number; size?: number }) {
  const r = (size - 16) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = score >= 70 ? "#16a34a" : score >= 40 ? "#d97706" : "#dc2626";
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={10} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth={10}
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.8s ease" }}
        />
      </svg>
      <div style={{
        position: "absolute", top: "50%", left: "50%",
        transform: "translate(-50%, -50%)", textAlign: "center",
      }}>
        <div style={{ fontSize: 22, fontWeight: 700, color, lineHeight: 1 }}>{score}</div>
        <div style={{ fontSize: 10, color: "#6b7280", lineHeight: 1.2 }}>AEO Score</div>
      </div>
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────────

export default function Index() {
  const navigate = useNavigate();

  const [{ data: simulations, fetching: simFetching, error: simError }] =
    useFindMany(api.a2ASimulation, {
      first: 250,
      select: {
        id: true, resultStatus: true, failureReason: true,
        agentType: true, createdAt: true,
        product: { id: true, title: true },
      },
    });

  const [{ data: products, fetching: prodFetching, error: prodError }] =
    useFindMany(api.shopifyProduct, {
      first: 250,
      select: { id: true, title: true, isAgentReady: true, agenticScore: true },
    });

  const [{ data: shopData }] = useFindFirst(api.shopifyShop, {
    select: { id: true, plan: true },
  });

  const [{ data: citations, fetching: citFetching, error: citError }] =
    useFindMany(api.citationEvent, {
      first: 50,
      sort: { createdAt: "Descending" },
      select: {
        id: true, sourceEngine: true, triggerQuery: true,
        citedProduct: { id: true, title: true }, createdAt: true,
      },
    });

  const error = simError || prodError || citError;
  const isLoading = simFetching || prodFetching || citFetching;

  // ── Stats ──────────────────────────────────────────────────────────────
  const totalProducts = products?.length ?? 0;
  const readyProducts = products?.filter((p) => p.isAgentReady).length ?? 0;
  const notReadyProducts = totalProducts - readyProducts;
  const readyPct = totalProducts > 0 ? Math.round((readyProducts / totalProducts) * 100) : 0;

  // Overall AEO Health Score = average agenticScore across all products
  const avgScore = totalProducts > 0
    ? Math.round((products ?? []).reduce((s, p) => s + (p.agenticScore ?? 0), 0) / totalProducts)
    : 0;

  const totalSimulations = simulations?.length ?? 0;
  const passCount = simulations?.filter((s) => s.resultStatus === "PASS").length ?? 0;
  const passRateNum = totalSimulations > 0 ? Math.round((passCount / totalSimulations) * 100) : 0;
  const totalCitations = citations?.length ?? 0;

  const recentSimulations = simulations
    ? [...simulations].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5)
    : [];

  // ── Action Center: 3 lowest score products with highest potential ──────
  const actionItems = (products ?? [])
    .filter((p) => !p.isAgentReady)
    .sort((a, b) => (b.agenticScore ?? 0) - (a.agenticScore ?? 0)) // highest score first (closest to PASS)
    .slice(0, 3);

  // ── Citation filter ────────────────────────────────────────────────────
  const citByEngine = (citations ?? []).reduce<Record<string, number>>((acc, c) => {
    const e = c.sourceEngine ?? "Unknown";
    acc[e] = (acc[e] ?? 0) + 1;
    return acc;
  }, {});

  const engineBadgeTone = (e: string) => {
    if (e === "Perplexity") return "success" as const;
    if (e === "SearchGPT") return "info" as const;
    if (e === "GeminiAI") return "warning" as const;
    return "new" as const;
  };

  if (error) return (
    <Page title="AgentReady — Dashboard">
      <Banner tone="critical"><Text as="p" variant="bodyMd">{error.message ?? "Failed to load data."}</Text></Banner>
    </Page>
  );

  if (isLoading && !simulations && !products) return (
    <Page title="AgentReady — Dashboard">
      <Layout><Layout.Section>
        <Box padding="800"><BlockStack gap="400" inlineAlign="center"><Spinner size="large" /></BlockStack></Box>
      </Layout.Section></Layout>
    </Page>
  );

  return (
    <Page
      title="AgentReady — Dashboard"
      subtitle={totalProducts > 0 ? `${readyPct}% of your catalog is visible to AI search engines` : "Your store's visibility in AI search engines"}
    >
      <Layout>
        <Layout.Section>
          <UpgradeBanner productCount={totalProducts} plan={shopData?.plan} />
        </Layout.Section>

        {notReadyProducts > 0 && !isLoading && (
          <Layout.Section>
            <Banner
              tone="warning"
              title={`${notReadyProducts} of ${totalProducts} products are not visible to AI search engines`}
              action={{ content: "Fix in Products", url: "/products" }}
            >
              <Text as="p" variant="bodyMd">
                Perplexity, SearchGPT, Gemini and other AI engines skip products missing weight, dimensions, or semantic context.
              </Text>
            </Banner>
          </Layout.Section>
        )}

        {/* ── AEO Health Score + Stat Cards ─────────────────────────── */}
        <Layout.Section>
          <InlineGrid columns={{ xs: 1, sm: 2, md: 4 }} gap="400">

            {/* AEO Health Score Ring */}
            <Card>
              <BlockStack gap="200" inlineAlign="center">
                <AEOHealthRing score={avgScore} size={110} />
                <Text as="p" variant="bodySm" tone="subdued" alignment="center">
                  Catalog AEO Health
                </Text>
                <Text as="p" variant="bodySm" tone="subdued" alignment="center">
                  {avgScore >= 70 ? "🟢 AI-ready" : avgScore >= 40 ? "🟡 Needs work" : "🔴 Action required"}
                </Text>
              </BlockStack>
            </Card>

            {/* AI Visibility */}
            <Card>
              <BlockStack gap="200" inlineAlign="center">
                <Text as="p" variant="headingXl" alignment="center"
                  tone={readyPct >= 70 ? "success" : readyPct >= 40 ? undefined : "critical"}>
                  {readyProducts} / {totalProducts}
                </Text>
                <Text as="p" variant="bodySm" tone="subdued" alignment="center">Products visible in AI search</Text>
                <ProgressBar progress={readyPct} tone={readyPct >= 70 ? "success" : "critical"} size="small" />
                <Text as="p" variant="bodySm" tone="subdued" alignment="center">
                  {notReadyProducts > 0 ? `${notReadyProducts} hidden from Perplexity` : "Entire catalog optimized 🎉"}
                </Text>
              </BlockStack>
            </Card>

            {/* Pass Rate */}
            <Card>
              <BlockStack gap="200" inlineAlign="center">
                <Text as="p" variant="headingXl" alignment="center"
                  tone={passRateNum >= 70 ? "success" : passRateNum >= 40 ? undefined : "critical"}>
                  {totalSimulations > 0 ? `${passRateNum}%` : "—"}
                </Text>
                <Text as="p" variant="bodySm" tone="subdued" alignment="center">AI agent will buy</Text>
                {totalSimulations > 0 && <ProgressBar progress={passRateNum} tone={passRateNum >= 70 ? "success" : "critical"} size="small" />}
                <Text as="p" variant="bodySm" tone="subdued" alignment="center">
                  {totalSimulations > 0 ? `${passCount} of ${totalSimulations} checks passed` : "Run checks in Simulator"}
                </Text>
              </BlockStack>
            </Card>

            {/* Citations */}
            <Card>
              <BlockStack gap="200" inlineAlign="center">
                <Text as="p" variant="headingXl" alignment="center">{totalCitations}</Text>
                <Text as="p" variant="bodySm" tone="subdued" alignment="center">AI search mentions</Text>
                <Text as="p" variant="bodySm" tone="subdued" alignment="center">
                  {totalCitations > 0 ? "Shoppers found you via AI" : "No mentions yet"}
                </Text>
              </BlockStack>
            </Card>
          </InlineGrid>
        </Layout.Section>

        {/* ── Action Center ──────────────────────────────────────────── */}
        {actionItems.length > 0 && (
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <BlockStack gap="100">
                  <Text as="h2" variant="headingMd">⚡ Action Center — Highest Impact Opportunities</Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    These unoptimized products are closest to passing — optimizing them will have the fastest impact on your AEO score.
                  </Text>
                </BlockStack>
                <BlockStack gap="200">
                  {actionItems.map((p) => (
                    <Box key={p.id} padding="300" borderWidth="025" borderColor="border" borderRadius="200"
                      background="bg-surface-secondary">
                      <InlineStack align="space-between" blockAlign="center" gap="400">
                        <BlockStack gap="050">
                          <Text as="span" variant="bodyMd" fontWeight="semibold">{p.title ?? "—"}</Text>
                          <Text as="span" variant="bodySm" tone="subdued">
                            AEO Score: {p.agenticScore ?? 0}/100 — {100 - (p.agenticScore ?? 0)} points to PASS
                          </Text>
                        </BlockStack>
                        <Button size="slim" variant="primary" onClick={() => navigate(`/products/${p.id}`)}>
                          ✨ Optimize for AEO
                        </Button>
                      </InlineStack>
                      <Box paddingBlockStart="200">
                        <ProgressBar
                          progress={p.agenticScore ?? 0}
                          tone={(p.agenticScore ?? 0) >= 40 ? "highlight" : "critical"}
                          size="small"
                        />
                      </Box>
                    </Box>
                  ))}
                </BlockStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        )}

        {/* ── Recent Simulations ─────────────────────────────────────── */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <BlockStack gap="100">
                <Text as="h2" variant="headingMd">Recent checks: will AI buy your product?</Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  ✓ Will buy — product recommended · ✗ Blocked — data needs fixing
                </Text>
              </BlockStack>
              {simFetching && !simulations ? (
                <Box padding="400"><BlockStack gap="200" inlineAlign="center"><Spinner size="small" /></BlockStack></Box>
              ) : recentSimulations.length === 0 ? (
                <EmptyState heading="No checks yet" image=""
                  action={{ content: "Run a check", url: "/simulator" }}>
                  <Text as="p" variant="bodyMd">Go to A2A Simulator and run your first check.</Text>
                </EmptyState>
              ) : (
                <BlockStack gap="300">
                  {recentSimulations.map((sim) => {
                    const reason = humanFailReason(sim.failureReason as string | null | undefined);
                    return (
                      <Box key={sim.id} padding="300" borderWidth="025" borderColor="border" borderRadius="200">
                        <InlineStack align="space-between" blockAlign="center" gap="400">
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
                            <Badge tone={statusTone(sim.resultStatus)}>{statusLabel(sim.resultStatus)}</Badge>
                            {reason && <Badge tone="warning">{reason}</Badge>}
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

        {/* ── Citations by Engine ────────────────────────────────────── */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <BlockStack gap="100">
                <Text as="h2" variant="headingMd">AI Search Engine Mentions</Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  Each mention is a potential customer who found you via AI search
                </Text>
              </BlockStack>

              {/* Engine breakdown */}
              {Object.keys(citByEngine).length > 0 && (
                <InlineStack gap="300" wrap>
                  {Object.entries(citByEngine).map(([engine, count]) => (
                    <Box key={engine} padding="200" borderWidth="025" borderColor="border" borderRadius="200">
                      <InlineStack gap="200" blockAlign="center">
                        <Text as="span" variant="bodyMd" fontWeight="semibold">{count}</Text>
                        <Badge tone={engineBadgeTone(engine)}>{engine}</Badge>
                      </InlineStack>
                    </Box>
                  ))}
                </InlineStack>
              )}

              {citFetching && !citations ? (
                <Box padding="400"><BlockStack gap="200" inlineAlign="center"><Spinner size="small" /></BlockStack></Box>
              ) : (citations ?? []).length === 0 ? (
                <Text as="p" variant="bodyMd" tone="subdued">
                  Once Perplexity or SearchGPT mentions your product, it appears here.
                  Optimize your catalog to accelerate first mention.
                </Text>
              ) : (
                <BlockStack gap="300">
                  {(citations ?? []).slice(0, 5).map((cit) => (
                    <Box key={cit.id} padding="300" borderWidth="025" borderColor="border" borderRadius="200">
                      <InlineStack align="space-between" blockAlign="center" gap="400">
                        <BlockStack gap="100">
                          <Text as="span" variant="bodyMd" fontWeight="semibold">{cit.triggerQuery ?? "—"}</Text>
                          <Text as="span" variant="bodySm" tone="subdued">
                            {cit.citedProduct?.title ?? "Product not identified"} ·{" "}
                            {new Date(cit.createdAt).toLocaleDateString()}
                          </Text>
                        </BlockStack>
                        <Badge tone={engineBadgeTone(cit.sourceEngine ?? "")}>{cit.sourceEngine ?? "—"}</Badge>
                      </InlineStack>
                    </Box>
                  ))}
                  {(citations ?? []).length > 5 && (
                    <Button variant="plain" url="/citations">View all {citations!.length} mentions →</Button>
                  )}
                </BlockStack>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
