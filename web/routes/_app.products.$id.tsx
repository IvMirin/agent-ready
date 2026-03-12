import { useState, useCallback } from "react";
import { useFindOne, useFindMany, useAction } from "@gadgetinc/react";
import { useParams } from "react-router";
import {
  Badge,
  Banner,
  BlockStack,
  Box,
  Button,
  Card,
  Collapsible,
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
} from "@shopify/polaris";
import { api } from "../api";

// ── Top AI models as of March 2026 ────────────────────────────────────────
const AI_AGENTS = [
  { label: "Perplexity Sonar Large 3.1 — strict", value: "Perplexity" },
  { label: "SearchGPT / ChatGPT Shopping (GPT-4o)", value: "SearchGPT" },
  { label: "Google Gemini 2.0 Flash Shopping", value: "GeminiShopping" },
  { label: "Microsoft Copilot Shopping (GPT-4o Turbo)", value: "CopilotShopping" },
  { label: "Amazon AI Nova Pro", value: "AmazonNovaPro" },
  { label: "Claude Sonnet 3.7 (Anthropic)", value: "ClaudeSonnet" },
];

// ── Helpers ───────────────────────────────────────────────────────────────

function failReasonHuman(reason: string | null | undefined): string | null {
  const map: Record<string, string> = {
    MISSING_WEIGHT: "No weight — AI can't recommend for 'lightweight' queries",
    MISSING_DIMENSIONS: "No dimensions — buyer can't verify compatibility",
    MISSING_MATERIAL: "No material — often appears in search queries",
    MISSING_VARIANT_ID: "No Shopify variant — AI can't add to cart",
    AMBIGUOUS_DESCRIPTION: "Ambiguous description — AI won't recommend",
    NO_STRUCTURED_DATA: "No structured data — AI only reads tags",
  };
  return reason ? (map[reason] ?? null) : null;
}

function specRowsFromJson(
  specsJson: Record<string, unknown> | null | undefined
): [string, string, React.ReactNode][] {
  if (!specsJson || typeof specsJson !== "object") return [];
  const labelMap: Record<string, string> = {
    weight: "⚖️ Weight",
    dimensions: "📐 Dimensions",
    materials: "🧱 Material",
    sku: "🏷 SKU",
    targetAudience: "👤 Target Audience",
    primaryUseCase: "🎯 Primary Use Case",
    competitiveAdvantage: "🏆 Competitive Advantage",
    compatibility: "🔌 Compatibility",
    warranty: "🛡 Warranty",
    keyFeatures: "✨ Key Features",
  };
  return Object.entries(specsJson)
    .filter(([, v]) => v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0))
    .map(([key, value]) => {
      const isSemanticField = ["targetAudience", "primaryUseCase", "competitiveAdvantage"].includes(key);
      return [
        labelMap[key] ?? key,
        Array.isArray(value) ? (value as string[]).join(", ") : String(value),
        <Badge tone={isSemanticField ? "info" : "success"} key={key}>
          {isSemanticField ? "✓ AEO v2" : "✓ Present"}
        </Badge>,
      ];
    });
}

// ── Visibility Probability Bar ────────────────────────────────────────────

function VisibilityBar({ score }: { score: number }) {
  const color = score >= 70 ? "#16a34a" : score >= 40 ? "#d97706" : "#dc2626";
  const label = score >= 70 ? "High — likely recommended" : score >= 40 ? "Medium — sometimes appears" : "Low — usually skipped";
  return (
    <BlockStack gap="200">
      <InlineStack align="space-between">
        <Text as="span" variant="bodySm" tone="subdued">AI Visibility Probability</Text>
        <Text as="span" variant="bodySm" fontWeight="semibold" as="span"
          tone={score >= 70 ? "success" : score >= 40 ? undefined : "critical"}>
          {score}% — {label}
        </Text>
      </InlineStack>
      <div style={{ height: 12, background: "#f3f4f6", borderRadius: 6, overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${score}%`, background: color,
          borderRadius: 6, transition: "width 0.8s ease",
        }} />
      </div>
      <InlineStack align="space-between">
        <Text as="span" variant="bodySm" tone="subdued">0%</Text>
        <Text as="span" variant="bodySm" tone="subdued">70% threshold</Text>
        <Text as="span" variant="bodySm" tone="subdued">100%</Text>
      </InlineStack>
    </BlockStack>
  );
}

// ── Component ─────────────────────────────────────────────────────────────

export default function ProductDetail() {
  const { id: productId } = useParams<{ id: string }>();
  const [simModalOpen, setSimModalOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState("Perplexity");
  const [manualSpecKey, setManualSpecKey] = useState("");
  const [manualSpecValue, setManualSpecValue] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [jsonOpen, setJsonOpen] = useState(false);  // Collapsible JSON

  const [{ data: product, fetching, error }] = useFindOne(
    api.shopifyProduct, productId!,
    {
      select: {
        id: true, title: true,
        factSummary: { markdown: true },
        originalBodyHtml: { markdown: true },
        technicalSpecsJson: true,
        agenticScore: true, isAgentReady: true, lastOptimizedAt: true,
        variants: { edges: { node: { id: true, sku: true, price: true, inventoryQuantity: true } } },
      },
    }
  );

  const [{ data: simulations, fetching: loadingSims }] = useFindMany(
    api.a2ASimulation,
    {
      filter: { product: { equals: productId } },
      select: {
        id: true, agentType: true, resultStatus: true,
        failureReason: true, failureDetail: true, autoReoptimized: true, createdAt: true,
      },
      sort: { createdAt: "Descending" },
      first: 10,
    }
  );

  // Single optimize action — covers extract + optimize in one
  const [{ fetching: optimizing }, optimizeProduct] = useAction(api.shopifyProduct.optimize);
  const [{ fetching: simulating }, runSimulation] = useAction(api.a2ASimulation.runSimulation);
  const [{ fetching: saving }, saveProduct] = useAction(api.shopifyProduct.optimize);

  const handleOptimize = useCallback(async () => {
    await optimizeProduct({ id: productId! });
    setShowSuccess(true);
  }, [productId, optimizeProduct]);

  const handleRunSim = useCallback(async () => {
    await runSimulation({ a2ASimulation: { product: { _link: productId! }, agentType: selectedAgent } });
    setSimModalOpen(false);
  }, [productId, selectedAgent, runSimulation]);

  const handleSaveManualSpec = useCallback(async () => {
    if (!manualSpecKey.trim() || !manualSpecValue.trim()) return;
    const currentSpecs = (product?.technicalSpecsJson as Record<string, unknown>) ?? {};
    const updatedSpecs = {
      ...currentSpecs,
      [manualSpecKey.trim().toLowerCase().replace(/\s+/g, "_")]: manualSpecValue.trim(),
    };
    await saveProduct({ id: productId!, technicalSpecsJson: updatedSpecs });
    setManualSpecKey(""); setManualSpecValue("");
  }, [productId, product, manualSpecKey, manualSpecValue, saveProduct]);

  if (fetching) return <Spinner accessibilityLabel="Loading product" />;
  if (error) return <Banner tone="critical" title="Loading error"><Text as="p" variant="bodyMd">{error.message}</Text></Banner>;
  if (!product) return <Text as="p" variant="bodyMd">Product not found.</Text>;

  const specs = (product.technicalSpecsJson as Record<string, unknown> | null) ?? {};
  const specRows = specRowsFromJson(specs);
  const primaryVariant = product.variants?.edges?.[0]?.node ?? {};
  const score = product.agenticScore ?? 0;

  const requiredFields = ["weight", "dimensions", "materials"];
  const missingFields = requiredFields.filter((f) => !specs[f] || specs[f] === null || specs[f] === "");
  const hasSemanticContext = specs.targetAudience && specs.primaryUseCase && specs.competitiveAdvantage;

  const schemaJson = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    ...specs,
    sku: (primaryVariant as { sku?: string }).sku ?? (specs.sku as string) ?? null,
    offers: {
      "@type": "Offer",
      price: (primaryVariant as { price?: string }).price ?? null,
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
    },
  };

  const simRows = (simulations ?? []).map((s) => {
    const reason = failReasonHuman(s.failureReason as string | null);
    return [
      s.agentType ?? "—",
      <Badge key={`ss-${s.id}`} tone={s.resultStatus === "PASS" ? "success" : s.resultStatus === "SOFT_FAIL" ? "warning" : "critical"}>
        {s.resultStatus === "PASS" ? "✓ Will buy" : s.resultStatus === "SOFT_FAIL" ? "⚠ Will skip" : "✗ Blocked"}
      </Badge>,
      reason ? <Badge key={`sr-${s.id}`} tone="warning">{reason.split(" — ")[0]}</Badge> : <Badge key={`ok-${s.id}`} tone="success">No issues</Badge>,
      s.autoReoptimized ? <Badge tone="info">Auto-fixed</Badge> : "—",
      s.createdAt ? new Date(s.createdAt).toLocaleString() : "—",
    ];
  });

  return (
    <Page
      title={product.title ?? "Product"}
      backAction={{ content: "Back to catalog", url: "/products" }}
      primaryAction={{ content: product.isAgentReady ? "Re-optimize" : "✨ Optimize for AEO", onAction: handleOptimize, loading: optimizing }}
      secondaryActions={[{ content: "Check: will AI buy?", onAction: () => setSimModalOpen(true) }]}
    >
      <Layout>

        {/* Success banner */}
        {showSuccess && product.isAgentReady && (
          <Layout.Section>
            <Banner tone="success" title="✅ Done! Product is now visible to AI search engines"
              onDismiss={() => setShowSuccess(false)}>
              <Text as="p" variant="bodyMd">
                This product can now appear in answers from Perplexity, SearchGPT, Gemini and other AI search engines.
                Schema.org data saved to Shopify metafield <strong>custom.aeo_optimized_data</strong>.
              </Text>
            </Banner>
          </Layout.Section>
        )}

        {/* ── AI Optimization Hub (One Magic Button) ──────────────────── */}
        <Layout.Section>
          <div style={{
            background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)",
            borderRadius: 12, padding: 24, color: "white",
          }}>
            <InlineStack align="space-between" blockAlign="center" gap="400" wrap>
              <BlockStack gap="200">
                <Text as="h2" variant="headingLg" as="h2">
                  <span style={{ color: "white" }}>✨ AI Optimization Hub</span>
                </Text>
                <Text as="p" variant="bodyMd" as="p">
                  <span style={{ color: "#c7d2fe" }}>
                    AEO Engine v2 — extracts physical specs + semantic context + generates Schema.org JSON-LD
                  </span>
                </Text>
                <InlineStack gap="200" wrap>
                  {missingFields.length > 0 ? (
                    missingFields.map((f) => (
                      <span key={f} style={{
                        background: "rgba(251,191,36,0.2)", border: "1px solid rgba(251,191,36,0.4)",
                        borderRadius: 20, padding: "2px 10px", fontSize: 12, color: "#fef3c7",
                      }}>
                        ⚠ No {f}
                      </span>
                    ))
                  ) : (
                    <span style={{ background: "rgba(34,197,94,0.2)", border: "1px solid rgba(34,197,94,0.4)", borderRadius: 20, padding: "2px 10px", fontSize: 12, color: "#dcfce7" }}>
                      ✓ Physical specs complete
                    </span>
                  )}
                  {!hasSemanticContext ? (
                    <span style={{ background: "rgba(139,92,246,0.2)", border: "1px solid rgba(139,92,246,0.4)", borderRadius: 20, padding: "2px 10px", fontSize: 12, color: "#ede9fe" }}>
                      ⚡ Semantic context needed (AEO v2)
                    </span>
                  ) : (
                    <span style={{ background: "rgba(34,197,94,0.2)", border: "1px solid rgba(34,197,94,0.4)", borderRadius: 20, padding: "2px 10px", fontSize: 12, color: "#dcfce7" }}>
                      ✓ Semantic context ready
                    </span>
                  )}
                </InlineStack>
              </BlockStack>
              <button
                onClick={handleOptimize}
                disabled={optimizing}
                style={{
                  background: optimizing ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.15)",
                  border: "1px solid rgba(255,255,255,0.3)",
                  borderRadius: 8, padding: "12px 24px", color: "white",
                  fontSize: 15, fontWeight: 600, cursor: optimizing ? "not-allowed" : "pointer",
                  backdropFilter: "blur(4px)", transition: "all 0.2s",
                  whiteSpace: "nowrap",
                }}
              >
                {optimizing ? "⏳ Optimizing..." : "✨ Optimize for AEO"}
              </button>
            </InlineStack>
          </div>
        </Layout.Section>

        {/* ── AI Visibility Score ──────────────────────────────────────── */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between">
                <Text as="h2" variant="headingMd">AI Search Visibility</Text>
                <Badge tone={product.isAgentReady ? "success" : score >= 40 ? "warning" : "critical"}>
                  {score}/100
                </Badge>
              </InlineStack>

              <VisibilityBar score={score} />

              <Banner
                tone={product.isAgentReady ? "success" : score >= 40 ? "warning" : "warning"}
                title={product.isAgentReady
                  ? "✅ Visible to AI search engines"
                  : score >= 40
                  ? "⚠️ Partial visibility — competitors with full data get priority"
                  : "⚠️ Not yet visible — missing specs and semantic context"}
              >
                <Text as="p" variant="bodyMd">
                  {product.isAgentReady
                    ? "Perplexity Sonar, SearchGPT, Gemini 2.0 and Copilot can recommend this product."
                    : score >= 40
                    ? "Add target audience, use case, and competitive advantage to reach PASS threshold."
                    : "Run AEO Optimization to extract specs and generate semantic context automatically."}
                </Text>
              </Banner>

              <InlineStack gap="600" wrap>
                <BlockStack gap="050">
                  <Text variant="bodySm" tone="subdued" as="span">SKU</Text>
                  <Text variant="bodyMd" as="span">{(primaryVariant as { sku?: string }).sku ?? (specs.sku as string) ?? "—"}</Text>
                </BlockStack>
                <BlockStack gap="050">
                  <Text variant="bodySm" tone="subdued" as="span">Price</Text>
                  <Text variant="bodyMd" as="span">
                    {(primaryVariant as { price?: string }).price ? `$${(primaryVariant as { price: string }).price}` : "—"}
                  </Text>
                </BlockStack>
                <BlockStack gap="050">
                  <Text variant="bodySm" tone="subdued" as="span">In stock</Text>
                  <Text variant="bodyMd" as="span">{(primaryVariant as { inventoryQuantity?: number }).inventoryQuantity ?? "—"}</Text>
                </BlockStack>
                <BlockStack gap="050">
                  <Text variant="bodySm" tone="subdued" as="span">Last optimization</Text>
                  <Text variant="bodyMd" as="span">
                    {product.lastOptimizedAt ? new Date(product.lastOptimizedAt).toLocaleString() : "Never"}
                  </Text>
                </BlockStack>
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* ── Extracted Specs + Semantic Context ──────────────────────── */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between">
                <BlockStack gap="100">
                  <Text as="h2" variant="headingMd">Data visible to AI search engines</Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Physical specs (⚖️📐🧱) + Semantic context (👤🎯🏆) — AEO Engine v2
                  </Text>
                </BlockStack>
                <Text as="p" variant="bodySm" tone="subdued">{specRows.length} fields</Text>
              </InlineStack>

              {specRows.length > 0 ? (
                <DataTable
                  columnContentTypes={["text", "text", "text"]}
                  headings={["Field", "Value", "Status"]}
                  rows={specRows}
                />
              ) : (
                <Banner tone="warning"
                  action={{ content: "✨ Optimize for AEO", onAction: handleOptimize }}>
                  <Text as="p" variant="bodyMd">
                    No data extracted yet. Click "Optimize for AEO" — AEO Engine v2 will extract
                    physical specs AND generate target audience, use case, and competitive advantage.
                  </Text>
                </Banner>
              )}

              <Divider />
              <Text as="h3" variant="headingSm">Add spec manually</Text>
              <InlineStack gap="300" blockAlign="end">
                <Box minWidth="180px">
                  <TextField label="Name" placeholder="e.g. weight"
                    value={manualSpecKey} onChange={setManualSpecKey} autoComplete="off" />
                </Box>
                <Box minWidth="200px">
                  <TextField label="Value" placeholder="e.g. 1.2 kg"
                    value={manualSpecValue} onChange={setManualSpecValue} autoComplete="off" />
                </Box>
                <Button onClick={handleSaveManualSpec} loading={saving}
                  disabled={!manualSpecKey.trim() || !manualSpecValue.trim()}>
                  Save
                </Button>
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* ── Before / After ───────────────────────────────────────────── */}
        {product.originalBodyHtml?.markdown && (
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Before and after AEO optimization</Text>
                <InlineStack gap="400" wrap={false}>
                  <Box width="50%">
                    <BlockStack gap="200">
                      <Badge tone="warning">Before — not AI-optimized</Badge>
                      <div style={{ background: "#fffbeb", padding: 12, borderRadius: 8, fontSize: 13, whiteSpace: "pre-wrap", maxHeight: 260, overflow: "auto", lineHeight: 1.6 }}
                        dangerouslySetInnerHTML={{ __html: product.originalBodyHtml?.markdown ?? "" }} />
                    </BlockStack>
                  </Box>
                  <Divider />
                  <Box width="50%">
                    <BlockStack gap="200">
                      <Badge tone="success">After — visible in Perplexity, SearchGPT, Gemini</Badge>
                      <div style={{ background: "#f0fdf4", padding: 12, borderRadius: 8, fontSize: 13, whiteSpace: "pre-wrap", maxHeight: 260, overflow: "auto", lineHeight: 1.6 }}>
                        {product.factSummary?.markdown ?? "Click \"Optimize for AEO\" to generate"}
                      </div>
                    </BlockStack>
                  </Box>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        )}

        {/* ── Simulation History ───────────────────────────────────────── */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between">
                <BlockStack gap="100">
                  <Text as="h2" variant="headingMd">Check history: will AI buy?</Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Results across top AI search models (March 2026)
                  </Text>
                </BlockStack>
                <Button variant="plain" onClick={() => setSimModalOpen(true)}>Run check</Button>
              </InlineStack>
              {loadingSims ? <Spinner accessibilityLabel="Loading" /> :
                (simulations?.length ?? 0) > 0 ? (
                  <DataTable
                    columnContentTypes={["text", "text", "text", "text", "text"]}
                    headings={["AI Agent", "Result", "Issue", "Auto-fix", "When"]}
                    rows={simRows}
                  />
                ) : (
                  <Text as="p" variant="bodyMd" tone="subdued">No checks yet. Click "Check: will AI buy?"</Text>
                )}
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* ── Technical Details (Collapsible JSON) ─────────────────────── */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between">
                <BlockStack gap="100">
                  <Text as="h2" variant="headingMd">Technical Details</Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Schema.org JSON-LD sent to AI search engines
                  </Text>
                </BlockStack>
                <Button variant="plain" onClick={() => setJsonOpen(!jsonOpen)}>
                  {jsonOpen ? "Hide ↑" : "Show JSON ↓"}
                </Button>
              </InlineStack>

              <Collapsible open={jsonOpen} id="json-collapsible" transition={{ duration: "200ms", timingFunction: "ease-in-out" }}>
                <BlockStack gap="200">
                  <InlineStack gap="200">
                    <Button size="slim" onClick={() => {
                      try { navigator.clipboard.writeText(JSON.stringify(schemaJson, null, 2)); } catch {}
                    }}>
                      Copy JSON
                    </Button>
                    <Text as="span" variant="bodySm" tone="subdued">
                      Save to metafield: custom.aeo_optimized_data
                    </Text>
                  </InlineStack>
                  <pre style={{
                    background: "#0f172a", color: "#a5f3fc", padding: 16, borderRadius: 8,
                    fontSize: 12, overflow: "auto", maxHeight: 300, lineHeight: 1.5,
                  }}>
                    {JSON.stringify(schemaJson, null, 2)}
                  </pre>
                </BlockStack>
              </Collapsible>
            </BlockStack>
          </Card>
        </Layout.Section>

      </Layout>

      {/* Simulate Modal */}
      <Modal open={simModalOpen} onClose={() => setSimModalOpen(false)}
        title="Check: will AI buy this product?"
        primaryAction={{ content: "Run check", onAction: handleRunSim, loading: simulating }}
        secondaryActions={[{ content: "Cancel", onAction: () => setSimModalOpen(false) }]}>
        <Modal.Section>
          <BlockStack gap="400">
            <Text as="p" variant="bodyMd">
              Simulates a purchase attempt through the selected AI search engine.
              Uses AEO Engine v2 evaluation criteria.
            </Text>
            <Select
              label="AI search engine (March 2026)"
              options={AI_AGENTS}
              value={selectedAgent}
              onChange={setSelectedAgent}
            />
          </BlockStack>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
