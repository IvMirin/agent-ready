import { useState, useCallback } from "react";
import { useFindMany, useAction } from "@gadgetinc/react";
import {
  Badge,
  Banner,
  BlockStack,
  Box,
  Button,
  Card,
  EmptyState,
  InlineStack,
  Layout,
  Page,
  Select,
  Spinner,
  Text,
  Tooltip,
} from "@shopify/polaris";
import { api } from "../api";

function humanFailReason(reason: string | null | undefined): string | null {
  const map: Record<string, string> = {
    MISSING_WEIGHT: "Missing product weight",
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

const statusLabel = (s: string | null | undefined): string => {
  if (s === "PASS") return "✓ Will buy";
  if (s === "SOFT_FAIL") return "⚠ Will skip";
  if (s === "HARD_FAIL") return "✗ Blocked";
  return s ?? "—";
};

export default function Simulator() {
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedAgent, setSelectedAgent] = useState("Perplexity");

  const [{ data: products, fetching: prodFetching }] = useFindMany(
    api.shopifyProduct,
    {
      first: 250,
      select: { id: true, title: true, isAgentReady: true },
    }
  );

  const [{ data: simulations, fetching: simFetching, error }] = useFindMany(
    api.a2ASimulation,
    {
      first: 50,
      sort: { createdAt: "Descending" },
      select: {
        id: true,
        agentType: true,
        resultStatus: true,
        failureReason: true,
        autoReoptimized: true,
        createdAt: true,
        product: { id: true, title: true },
      },
    }
  );

  const [{ fetching: running }, runSimulation] = useAction(
    api.a2ASimulation.runSimulation
  );

  const handleRun = useCallback(async () => {
    if (!selectedProductId) return;
    await runSimulation({
      a2ASimulation: {
        product: { _link: selectedProductId },
        agentType: selectedAgent,
      },
    });
  }, [selectedProductId, selectedAgent, runSimulation]);

  const productOptions = [
    { label: "Select a product...", value: "" },
    ...(products ?? []).map((p) => ({
      label: `${p.isAgentReady ? "🟢" : "🔴"} ${p.title ?? p.id}`,
      value: p.id,
    })),
  ];

  return (
    <Page
      title="Check: will AI buy your product?"
      subtitle="Simulating a purchase through Perplexity, SearchGPT and other AI agents"
    >
      <Layout>
        {/* Run form */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <BlockStack gap="100">
                <Text as="h2" variant="headingMd">
                  Run a check
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  GPT-4o simulates purchasing your product just like a real AI
                  agent would. If we find an issue — we fix it automatically.
                </Text>
              </BlockStack>

              {prodFetching ? (
                <Spinner size="small" />
              ) : (
                <Select
                  label="Product"
                  options={productOptions}
                  value={selectedProductId}
                  onChange={setSelectedProductId}
                />
              )}

              <Select
                label="Which AI search engine to check?"
                options={[
                  { label: "Perplexity — strict check", value: "Perplexity" },
                  { label: "SearchGPT — medium check", value: "SearchGPT" },
                  {
                    label: "Gemini Shopping — medium check",
                    value: "GeminiShopping",
                  },
                  {
                    label: "GPT-4o Agent — maximum strictness",
                    value: "GPT4Agent",
                  },
                ]}
                value={selectedAgent}
                onChange={setSelectedAgent}
              />

              <Button
                variant="primary"
                onClick={handleRun}
                loading={running}
                disabled={!selectedProductId}
              >
                Run check
              </Button>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Results */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <BlockStack gap="100">
                <Text as="h2" variant="headingMd">
                  Check history
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  ✓ Will buy — AI can purchase · ✗ Blocked — insufficient data
                </Text>
              </BlockStack>

              {error && (
                <Banner tone="critical">
                  <Text as="p" variant="bodyMd">{error.message}</Text>
                </Banner>
              )}

              {simFetching && !simulations ? (
                <Box padding="400">
                  <BlockStack gap="200" inlineAlign="center">
                    <Spinner size="large" />
                  </BlockStack>
                </Box>
              ) : (simulations?.length ?? 0) === 0 ? (
                <EmptyState heading="No checks yet" image="">
                  <Text as="p" variant="bodyMd">
                    Select a product above and run your first check.
                  </Text>
                </EmptyState>
              ) : (
                <BlockStack gap="300">
                  {(simulations ?? []).map((sim) => {
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
                              {sim.product?.title ?? "—"}
                            </Text>
                            <Text as="span" variant="bodySm" tone="subdued">
                              {new Date(sim.createdAt).toLocaleDateString()}
                            </Text>
                          </BlockStack>
                          <InlineStack gap="200" wrap={false}>
                            <Badge>{sim.agentType ?? "—"}</Badge>
                            <Badge tone={statusTone(sim.resultStatus)}>
                              {statusLabel(sim.resultStatus)}
                            </Badge>
                            {reason && (
                              <Tooltip content={sim.failureReason ?? ""}>
                                <Badge tone="critical">{reason}</Badge>
                              </Tooltip>
                            )}
                            {sim.autoReoptimized && (
                              <Badge tone="info">Auto-fixed</Badge>
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
      </Layout>
    </Page>
  );
}
