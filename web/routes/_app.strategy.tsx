import {
  BlockStack, Box, Button, Card, InlineGrid, InlineStack,
  Layout, Page, Text, Badge,
} from "@shopify/polaris";

const STRATEGY_STEPS = [
  {
    phase: "Phase 1",
    title: "Physical Specs Audit",
    description: "Ensure all products have weight, dimensions, and material. These are the baseline for any AI search engine.",
    status: "active",
    engines: ["Perplexity", "SearchGPT", "Gemini 2.0"],
    impact: 35,
    action: "Go to Products → Fix missing specs",
    url: "/products",
  },
  {
    phase: "Phase 2",
    title: "Semantic Context Enrichment",
    description: "Add Target Audience, Primary Use Case, and Competitive Advantage. AEO Engine v2 does this automatically.",
    status: "pending",
    engines: ["Perplexity Sonar", "Claude 3.7", "Copilot"],
    impact: 30,
    action: "Run AEO Optimization on all products",
    url: "/products",
  },
  {
    phase: "Phase 3",
    title: "Schema.org JSON-LD Injection",
    description: "Inject structured data into Shopify metafields (custom.aeo_optimized_data). Enables rich snippets in AI answers.",
    status: "pending",
    engines: ["Google Gemini", "Amazon Nova", "SearchGPT"],
    impact: 20,
    action: "Optimize products — Schema.org is generated automatically",
    url: "/products",
  },
  {
    phase: "Phase 4",
    title: "Continuous AEO Monitoring",
    description: "Run weekly A2A simulations across all 6 top AI engines. Auto-fix products that drop below PASS threshold.",
    status: "pending",
    engines: ["All 6 engines"],
    impact: 15,
    action: "Go to A2A Simulator",
    url: "/simulator",
  },
];

const TOP_AI_ENGINES = [
  { name: "Perplexity Sonar Large 3.1", type: "Strict", readyPct: 0, color: "#16a34a" },
  { name: "SearchGPT / ChatGPT Shopping", type: "GPT-4o", readyPct: 0, color: "#2563eb" },
  { name: "Google Gemini 2.0 Flash", type: "Shopping", readyPct: 0, color: "#dc2626" },
  { name: "Microsoft Copilot Shopping", type: "GPT-4o Turbo", readyPct: 0, color: "#7c3aed" },
  { name: "Amazon AI Nova Pro", type: "Strict", readyPct: 0, color: "#f59e0b" },
  { name: "Claude Sonnet 3.7", type: "Anthropic", readyPct: 0, color: "#0891b2" },
];

export default function AEOStrategy() {
  return (
    <Page
      title="AEO Strategy"
      subtitle="Agentic Engine Optimization roadmap — March 2026"
    >
      <Layout>
        {/* What is AEO */}
        <Layout.Section>
          <div style={{
            background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)",
            borderRadius: 12, padding: 24,
          }}>
            <BlockStack gap="300">
              <Text as="h2" variant="headingLg">
                <span style={{ color: "white" }}>What is AEO?</span>
              </Text>
              <Text as="p" variant="bodyMd">
                <span style={{ color: "#c7d2fe" }}>
                  Agentic Engine Optimization (AEO) is the next evolution of SEO.
                  Instead of optimizing for Google's algorithm, you optimize for AI agents —
                  Perplexity, SearchGPT, Gemini, Copilot — that autonomously research, evaluate,
                  and purchase products on behalf of users.
                </span>
              </Text>
              <Text as="p" variant="bodyMd">
                <span style={{ color: "#a5b4fc" }}>
                  By March 2026, an estimated 35% of product discovery happens through AI search.
                  Products without structured specs and semantic context are invisible to this traffic.
                </span>
              </Text>
            </BlockStack>
          </div>
        </Layout.Section>

        {/* Top AI Engines */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">Top AI Search Engines — March 2026</Text>
              <InlineGrid columns={{ xs: 1, sm: 2, md: 3 }} gap="300">
                {TOP_AI_ENGINES.map((engine) => (
                  <Box key={engine.name} padding="300" borderWidth="025" borderColor="border" borderRadius="200">
                    <BlockStack gap="200">
                      <InlineStack align="space-between">
                        <Text as="span" variant="bodyMd" fontWeight="semibold">{engine.name}</Text>
                        <Badge>{engine.type}</Badge>
                      </InlineStack>
                      <Text as="p" variant="bodySm" tone="subdued">
                        Run A2A Simulator to check your products
                      </Text>
                      <Button size="slim" variant="plain" url="/simulator">
                        Test now →
                      </Button>
                    </BlockStack>
                  </Box>
                ))}
              </InlineGrid>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* 4-Phase Roadmap */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">4-Phase AEO Optimization Roadmap</Text>
              <BlockStack gap="400">
                {STRATEGY_STEPS.map((step, i) => (
                  <Box key={step.phase} padding="400" borderWidth="025" borderColor="border" borderRadius="200"
                    background={step.status === "active" ? "bg-surface-selected" : "bg-surface"}>
                    <BlockStack gap="300">
                      <InlineStack align="space-between" blockAlign="center">
                        <InlineStack gap="300" blockAlign="center">
                          <div style={{
                            width: 32, height: 32, borderRadius: "50%",
                            background: step.status === "active" ? "#4f46e5" : "#e5e7eb",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            color: step.status === "active" ? "white" : "#6b7280",
                            fontWeight: 700, fontSize: 14,
                          }}>{i + 1}</div>
                          <BlockStack gap="050">
                            <Text as="span" variant="bodySm" tone="subdued">{step.phase}</Text>
                            <Text as="span" variant="bodyMd" fontWeight="semibold">{step.title}</Text>
                          </BlockStack>
                        </InlineStack>
                        <Badge tone={step.status === "active" ? "info" : "new"}>
                          +{step.impact} pts
                        </Badge>
                      </InlineStack>
                      <Text as="p" variant="bodyMd">{step.description}</Text>
                      <InlineStack gap="200" wrap>
                        {step.engines.map((e) => (
                          <Badge key={e} tone="success">{e}</Badge>
                        ))}
                      </InlineStack>
                      <Button size="slim" variant="primary" url={step.url}>{step.action} →</Button>
                    </BlockStack>
                  </Box>
                ))}
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
