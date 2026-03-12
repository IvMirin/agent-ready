import { useState, useCallback } from "react";
import { useFindOne, useFindMany, useAction } from "@gadgetinc/react";
import { useParams } from "react-router";
import {
  Badge,
  Banner,
  BlockStack,
  Box,
  Button,
  ButtonGroup,
  CalloutCard,
  Card,
  DataTable,
  Divider,
  InlineStack,
  Layout,
  Modal,
  Page,
  ProgressBar,
  Select,
  Spinner,
  Text,
  TextField,
  Tooltip,
} from "@shopify/polaris";
import { api } from "../api";

// ─── Helpers ──────────────────────────────────────────────────

function failReasonHuman(reason: string | null | undefined): string | null {
  const map: Record<string, string> = {
    MISSING_WEIGHT: "No weight — AI can't recommend for queries like 'lightweight backpack'",
    MISSING_DIMENSIONS: "No dimensions — buyer can't verify compatibility",
    MISSING_MATERIAL: "No material — often appears in queries ('leather bag')",
    MISSING_VARIANT_ID: "No Shopify variant — AI can't add to cart",
    AMBIGUOUS_DESCRIPTION: "Ambiguous description — AI doesn't know which product to recommend",
    NO_STRUCTURED_DATA: "No structured data — AI only reads tags",
  };
  return reason ? (map[reason] ?? null) : null;
}

function specRowsFromJson(
  specsJson: Record<string, unknown> | null | undefined
): [string, string, React.ReactNode][] {
  if (!specsJson || typeof specsJson !== "object") return [];
  const labelMap: Record<string, string> = {
    weight: "Weight",
    dimensions: "Dimensions",
    material: "Material",
    sku: "SKU",
    compatibility: "Compatibility",
    warranty: "Warranty",
    power_requirements: "Power",
    certifications: "Certifications",
    color_options: "Colors",
  };
  return Object.entries(specsJson)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([key, value]) => [
      labelMap[key] ?? key,
      Array.isArray(value) ? value.join(", ") : String(value),
      <Badge tone="success" key={key}>✓ Present</Badge>,
    ]);
}

// ─── Component ────────────────────────────────────────────────

export default function ProductDetail() {
  const { id: productId } = useParams<{ id: string }>();

  const [simModalOpen, setSimModalOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState("Perplexity");
  const [manualSpecKey, setManualSpecKey] = useState("");
  const [manualSpecValue, setManualSpecValue] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);

  const [{ data: product, fetching, error }] = useFindOne(
    api.shopifyProduct,
    productId!,
    {
      select: {
        id: true,
        title: true,
        factSummary: { markdown: true },
        originalBodyHtml: { markdown: true },
        technicalSpecsJson: true,
        agenticScore: true,
        isAgentReady: true,
        lastOptimizedAt: true,
        variants: {
          edges: {
            node: {
              id: true,
              sku: true,
              price: true,
              inventoryQuantity: true,
            },
          },
        },
      },
    }
  );

  const [{ data: simulations, fetching: loadingSims }] = useFindMany(
    api.a2ASimulation,
    {
      filter: { product: { equals: productId } },
      select: {
        id: true,
        agentType: true,
        resultStatus: true,
        failureReason: true,
        failureDetail: true,
        autoReoptimized: true,
        createdAt: true,
      },
      sort: { createdAt: "Descending" },
      first: 10,
    }
  );

  const [{ fetching: optimizing }, optimizeProduct] = useAction(
    api.shopifyProduct.optimize
  );
  const [{ fetching: simulating }, runSimulation] = useAction(
    api.a2ASimulation.runSimulation
  );
  const [{ fetching: saving }, saveProduct] = useAction(
    api.shopifyProduct.optimize
  );

  const handleOptimize = useCallback(async () => {
    await optimizeProduct({ id: productId! });
    setShowSuccess(true);
  }, [productId, optimizeProduct]);

  const handleRunSim = useCallback(async () => {
    await runSimulation({
      a2ASimulation: {
        product: { _link: productId! },
        agentType: selectedAgent,
      },
    });
    setSimModalOpen(false);
  }, [productId, selectedAgent, runSimulation]);

  const handleSaveManualSpec = useCallback(async () => {
    if (!manualSpecKey.trim() || !manualSpecValue.trim()) return;
    const currentSpecs =
      (product?.technicalSpecsJson as Record<string, unknown>) ?? {};
    const updatedSpecs = {
      ...currentSpecs,
      [manualSpecKey
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "_")]: manualSpecValue.trim(),
    };
    await saveProduct({ id: productId!, technicalSpecsJson: updatedSpecs });
    setManualSpecKey("");
    setManualSpecValue("");
  }, [productId, product, manualSpecKey, manualSpecValue, saveProduct]);

  if (fetching) return <Spinner accessibilityLabel="Loading product" />;
  if (error)
    return (
      <Banner tone="critical" title="Loading error">
        <Text as="p" variant="bodyMd">{error.message}</Text>
      </Banner>
    );
  if (!product) return <Text as="p" variant="bodyMd">Product not found.</Text>;

  const specs =
    (product.technicalSpecsJson as Record<string, unknown> | null) ?? {};
  const specRows = specRowsFromJson(specs);
  const primaryVariant = product.variants?.edges?.[0]?.node ?? {};
  const score = product.agenticScore ?? 0;

  const requiredFields = ["weight", "dimensions", "material", "sku"];
  const missingFields = requiredFields.filter(
    (f) => !specs[f] || specs[f] === null || specs[f] === ""
  );
  const missingLabels = missingFields.map(
    (f) =>
      ({ weight: "weight", dimensions: "dimensions", material: "material", sku: "SKU" }[f] ?? f)
  );

  const simRows = (simulations ?? []).map((s) => {
    const reason = failReasonHuman(s.failureReason as string | null);
    const shortReason = reason ? reason.split(" — ")[0] : null;
    return [
      s.agentType ?? "—",
      <Badge
        key={`ss-${s.id}`}
        tone={
          s.resultStatus === "PASS"
            ? "success"
            : s.resultStatus === "SOFT_FAIL"
            ? "warning"
            : "critical"
        }
      >
        {s.resultStatus === "PASS"
          ? "✓ Will buy"
          : s.resultStatus === "SOFT_FAIL"
          ? "⚠ Will skip"
          : "✗ Blocked"}
      </Badge>,
      shortReason ? (
        <Tooltip key={`sr-${s.id}`} content={s.failureDetail ?? ""}>
          <Badge tone="critical">{shortReason}</Badge>
        </Tooltip>
      ) : (
        <Badge key={`ok-${s.id}`} tone="success">
          No issues
        </Badge>
      ),
      s.autoReoptimized ? (
        <Badge tone="info">Auto-fixed</Badge>
      ) : (
        "—"
      ),
      s.createdAt ? new Date(s.createdAt).toLocaleString() : "—",
    ];
  });

  return (
    <Page
      title={product.title ?? "Product"}
      backAction={{ content: "Back to catalog", url: "/products" }}
      primaryAction={{
        content:
          product.isAgentReady ? "Re-optimize" : "Fix & Optimize",
        onAction: handleOptimize,
        loading: optimizing,
      }}
      secondaryActions={[
        {
          content: "Check: will AI buy?",
          onAction: () => setSimModalOpen(true),
        },
      ]}
    >
      <Layout>

        {/* Success banner after optimization */}
        {showSuccess && product.isAgentReady && (
          <Layout.Section>
            <Banner
              tone="success"
              title="✅ Done! Product is now visible to AI search engines"
              onDismiss={() => setShowSuccess(false)}
            >
              <Text as="p" variant="bodyMd">
                This product can now appear in Perplexity answers for queries
                like '{(product.title ?? "").toLowerCase().split(" ").slice(0, 4).join(" ")}'.
                Data saved to Shopify metafields.
              </Text>
            </Banner>
          </Layout.Section>
        )}

        {/* Missing fields — merchant-first explanation */}
        {missingFields.length > 0 && (
          <Layout.Section>
            <Banner
              tone="warning"
              title="What prevents Perplexity from recommending this product"
              action={{ content: "Fix automatically", onAction: handleOptimize }}
            >
              <Text as="p" variant="bodyMd">
                Need to add: <strong>{missingLabels.join(", ")}</strong>.
              </Text>
              <Text as="p" variant="bodyMd">
                {missingFields
                  .map((f) => failReasonHuman(`MISSING_${f.toUpperCase()}`))
                  .filter(Boolean)
                  .join(" ")}
              </Text>
            </Banner>
          </Layout.Section>
        )}

        {/* Readiness score */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between">
                <Text as="h2" variant="headingMd">
                  AI Search Visibility
                </Text>
                <Badge
                  tone={
                    product.isAgentReady
                      ? "success"
                      : score >= 40
                      ? "warning"
                      : "critical"
                  }
                >
                  {score}/100
                </Badge>
              </InlineStack>

              <Banner
                tone={
                  product.isAgentReady
                    ? "success"
                    : score >= 40
                    ? "warning"
                    : "critical"
                }
                title={
                  product.isAgentReady
                    ? "✅ This product is visible to AI search engines"
                    : score >= 40
                    ? "⚠️ Partial visibility"
                    : "❌ Product is hidden from AI search engines"
                }
              >
                <Text as="p" variant="bodyMd">
                  {product.isAgentReady
                    ? "Perplexity, SearchGPT and Gemini can recommend it for search queries."
                    : score >= 40
                    ? "Product sometimes appears in AI answers, but without complete data competitors get priority."
                    : "Perplexity, SearchGPT and Gemini skip this product — no data on weight, dimensions or material."}
                </Text>
              </Banner>

              <ProgressBar
                progress={score}
                tone={
                  product.isAgentReady
                    ? "success"
                    : score >= 40
                    ? "highlight"
                    : "critical"
                }
              />

              <InlineStack gap="600" wrap>
                <BlockStack gap="050">
                  <Text variant="bodySm" tone="subdued" as="span">SKU</Text>
                  <Text variant="bodyMd" as="span">
                    {(primaryVariant as { sku?: string }).sku ?? (specs.sku as string) ?? "—"}
                  </Text>
                </BlockStack>
                <BlockStack gap="050">
                  <Text variant="bodySm" tone="subdued" as="span">Price</Text>
                  <Text variant="bodyMd" as="span">
                    {(primaryVariant as { price?: string }).price
                      ? `€${(primaryVariant as { price: string }).price}`
                      : "—"}
                  </Text>
                </BlockStack>
                <BlockStack gap="050">
                  <Text variant="bodySm" tone="subdued" as="span">In stock</Text>
                  <Text variant="bodyMd" as="span">
                    {(primaryVariant as { inventoryQuantity?: number })
                      .inventoryQuantity ?? "—"}
                  </Text>
                </BlockStack>
                <BlockStack gap="050">
                  <Text variant="bodySm" tone="subdued" as="span">Last optimization</Text>
                  <Text variant="bodyMd" as="span">
                    {product.lastOptimizedAt
                      ? new Date(product.lastOptimizedAt).toLocaleString()
                      : "Never"}
                  </Text>
                </BlockStack>
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Extracted specs */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between">
                <BlockStack gap="100">
                  <Text as="h2" variant="headingMd">
                    Data visible to AI search engines
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    These are the exact fields Perplexity and SearchGPT use for recommendations.
                  </Text>
                </BlockStack>
                <Text as="p" variant="bodySm" tone="subdued">
                  {specRows.length} fields
                </Text>
              </InlineStack>

              {specRows.length > 0 ? (
                <DataTable
                  columnContentTypes={["text", "text", "text"]}
                  headings={["Spec", "Value", "Status"]}
                  rows={specRows}
                />
              ) : (
                <Banner
                  tone="warning"
                  action={{
                    content: "Extract automatically",
                    onAction: handleOptimize,
                  }}
                >
                  <Text as="p" variant="bodyMd">
                    Data not yet extracted. Click "Fix & Optimize" —
                    we'll extract weight, dimensions and material from the product description.
                  </Text>
                </Banner>
              )}

              <Divider />

              <Text as="h3" variant="headingSm">
                Add spec manually
              </Text>
              <InlineStack gap="300" blockAlign="end">
                <Box minWidth="180px">
                  <TextField
                    label="Name"
                    placeholder="e.g. weight"
                    value={manualSpecKey}
                    onChange={setManualSpecKey}
                    autoComplete="off"
                  />
                </Box>
                <Box minWidth="200px">
                  <TextField
                    label="Value"
                    placeholder="e.g. 1.2 kg"
                    value={manualSpecValue}
                    onChange={setManualSpecValue}
                    autoComplete="off"
                  />
                </Box>
                <Button
                  onClick={handleSaveManualSpec}
                  loading={saving}
                  disabled={!manualSpecKey.trim() || !manualSpecValue.trim()}
                >
                  Save
                </Button>
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Before / After */}
        {product.originalBodyHtml?.markdown && (
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Before and after optimization
                </Text>
                <InlineStack gap="400" wrap={false}>
                  <Box width="50%">
                    <BlockStack gap="200">
                      <Badge tone="critical">Before — invisible to AI</Badge>
                      <div
                        style={{
                          background: "#FFF4F4",
                          padding: "12px",
                          borderRadius: "8px",
                          fontSize: "13px",
                          whiteSpace: "pre-wrap",
                          maxHeight: "320px",
                          overflow: "auto",
                          lineHeight: "1.6",
                        }}
                        dangerouslySetInnerHTML={{
                          __html: product.originalBodyHtml?.markdown ?? "",
                        }}
                      />
                    </BlockStack>
                  </Box>
                  <Divider />
                  <Box width="50%">
                    <BlockStack gap="200">
                      <Badge tone="success">
                        After — visible in Perplexity and SearchGPT
                      </Badge>
                      <div
                        style={{
                          background: "#F0FFF4",
                          padding: "12px",
                          borderRadius: "8px",
                          fontSize: "13px",
                          whiteSpace: "pre-wrap",
                          maxHeight: "320px",
                          overflow: "auto",
                          lineHeight: "1.6",
                        }}
                      >
                        {product.factSummary?.markdown ??
                          "Click \"Fix & Optimize\" to generate"}
                      </div>
                    </BlockStack>
                  </Box>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        )}

        {/* Simulation history */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between">
                <BlockStack gap="100">
                  <Text as="h2" variant="headingMd">
                    Check history: will AI buy?
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Results of purchase simulation through various AI agents.
                  </Text>
                </BlockStack>
                <Button variant="plain" onClick={() => setSimModalOpen(true)}>
                  Run check
                </Button>
              </InlineStack>
              {loadingSims ? (
                <Spinner accessibilityLabel="Loading" />
              ) : (simulations?.length ?? 0) > 0 ? (
                <DataTable
                  columnContentTypes={["text", "text", "text", "text", "text"]}
                  headings={[
                    "AI Agent",
                    "Result",
                    "Issue",
                    "Auto-fix",
                    "When",
                  ]}
                  rows={simRows}
                />
              ) : (
                <Text as="p" variant="bodyMd" tone="subdued">
                  No checks yet. Click "Check: will AI buy?"
                </Text>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Agent JSON preview */}
        <Layout.Section>
          <CalloutCard
            title="What AI search engines see"
            illustration=""
            primaryAction={{
              content: "Copy JSON",
              onAction: () => {
                try {
                  navigator.clipboard.writeText(
                    JSON.stringify(
                      {
                        "@type": "Product",
                        name: product.title,
                        ...specs,
                        sku:
                          (primaryVariant as { sku?: string }).sku ??
                          (specs.sku as string),
                        price: (primaryVariant as { price?: string }).price,
                        availability: "InStock",
                      },
                      null,
                      2
                    )
                  );
                } catch {}
              },
            }}
          >
            <Text as="p" variant="bodySm" tone="subdued">
              This is the exact JSON sent to Perplexity, SearchGPT and Gemini during search.
              The more fields — the higher your product ranks in AI recommendations.
            </Text>
            <pre
              style={{
                background: "#1a1a2e",
                color: "#a8ff78",
                padding: "16px",
                borderRadius: "8px",
                fontSize: "12px",
                overflow: "auto",
                maxHeight: "200px",
                marginTop: "12px",
              }}
            >
              {JSON.stringify(
                {
                  "@type": "Product",
                  name: product.title,
                  ...specs,
                  sku:
                    (primaryVariant as { sku?: string }).sku ??
                    (specs.sku as string) ??
                    null,
                  price:
                    (primaryVariant as { price?: string }).price ?? null,
                  availability: "InStock",
                },
                null,
                2
              )}
            </pre>
          </CalloutCard>
        </Layout.Section>
      </Layout>

      {/* Simulate Modal */}
      <Modal
        open={simModalOpen}
        onClose={() => setSimModalOpen(false)}
        title="Check: will AI buy this product?"
        primaryAction={{
          content: "Run check",
          onAction: handleRunSim,
          loading: simulating,
        }}
        secondaryActions={[
          { content: "Cancel", onAction: () => setSimModalOpen(false) },
        ]}
      >
        <Modal.Section>
          <BlockStack gap="400">
            <Text as="p" variant="bodyMd">
              GPT-4o simulates purchasing this product through the selected AI agent.
              If it finds a problem — we fix it automatically.
            </Text>
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
          </BlockStack>
        </Modal.Section>
      </Modal>
    </Page>
  );
}