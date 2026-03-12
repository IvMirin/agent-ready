import { useState, useCallback } from "react";
import { useFindMany, useAction } from "@gadgetinc/react";
import {
  Badge, Banner, BlockStack, Box, Button, ButtonGroup,
  Card, DataTable, EmptyState, InlineStack, Layout,
  Page, ProgressBar, Spinner, Text,
} from "@shopify/polaris";
import { useNavigate } from "react-router";
import { api } from "../api";

function getMissingReason(specs: Record<string, unknown> | null | undefined): string | null {
  if (!specs) return 'No data — click "Optimize for AEO"';
  const missing: string[] = [];
  if (!specs.weight) missing.push("weight");
  if (!specs.dimensions) missing.push("dimensions");
  if (!specs.materials) missing.push("material");
  if (!specs.targetAudience) missing.push("audience");
  if (missing.length === 0) return null;
  return `Missing: ${missing.join(", ")}`;
}

function scoreEmoji(score: number): string {
  if (score >= 70) return "🟢";
  if (score >= 40) return "🟡";
  return "🔴";
}

export default function ProductsIndex() {
  const navigate = useNavigate();
  const [bulkOptimizing, setBulkOptimizing] = useState(false);
  const [optimizedIds, setOptimizedIds] = useState<Set<string>>(new Set());

  const [{ data: products, fetching, error }] = useFindMany(api.shopifyProduct, {
    first: 250,
    select: {
      id: true, title: true, agenticScore: true, isAgentReady: true,
      lastOptimizedAt: true, technicalSpecsJson: true,
      factSummary: { markdown: true }, originalBodyHtml: { markdown: true },
    },
    sort: { agenticScore: "Ascending" },
  });

  const [{ fetching: optimizing }, optimizeProduct] = useAction(api.shopifyProduct.optimize);

  const productList = products ?? [];
  const notReady = productList.filter((p) => !p.isAgentReady);

  const handleOptimizeAll = useCallback(async () => {
    if (bulkOptimizing || productList.length === 0) return;
    setBulkOptimizing(true);
    try {
      for (const p of productList) {
        await optimizeProduct({ id: p.id });
        setOptimizedIds((prev) => new Set([...prev, p.id]));
      }
    } finally { setBulkOptimizing(false); }
  }, [bulkOptimizing, productList, optimizeProduct]);

  const rows = productList.map((p) => {
    const score = p.agenticScore ?? 0;
    const specs = p.technicalSpecsJson as Record<string, unknown> | null | undefined;
    const missingReason = getMissingReason(specs);
    const justOptimized = optimizedIds.has(p.id) && p.isAgentReady;

    return [
      <BlockStack key={`n-${p.id}`} gap="050">
        <Text variant="bodyMd" fontWeight="semibold" as="span">{p.title ?? "—"}</Text>
        {missingReason && !p.isAgentReady && (
          <Text variant="bodySm" tone="caution" as="span">{missingReason} — skipped by AI</Text>
        )}
        {justOptimized && (
          <Text variant="bodySm" tone="success" as="span">✓ Now visible in AI search results</Text>
        )}
      </BlockStack>,

      <BlockStack key={`s-${p.id}`} gap="100">
        <Text variant="bodySm" as="span">
          {scoreEmoji(score)} {score}/100
          {p.isAgentReady ? " — AI-ready" : score >= 40 ? " — Partial" : " — Not visible"}
        </Text>
        <ProgressBar
          progress={score}
          tone={p.isAgentReady ? "success" : score >= 40 ? "highlight" : "critical"}
          size="small"
        />
      </BlockStack>,

      p.lastOptimizedAt ? (
        <Text key={`d-${p.id}`} variant="bodySm" as="span">
          {new Date(p.lastOptimizedAt).toLocaleDateString()}
        </Text>
      ) : (
        <Text key={`d-${p.id}`} variant="bodySm" tone="subdued" as="span">Never</Text>
      ),

      <ButtonGroup key={`b-${p.id}`}>
        <Button size="slim" variant={p.isAgentReady ? "secondary" : "primary"}
          onClick={() => optimizeProduct({ id: p.id })} loading={optimizing}>
          {p.isAgentReady ? "Re-optimize" : "✨ Optimize for AEO"}
        </Button>
        <Button size="slim" variant="plain" onClick={() => navigate(`/products/${p.id}`)}>
          Details
        </Button>
      </ButtonGroup>,
    ];
  });

  if (error) return (
    <Page title="Products">
      <Banner tone="critical"><Text as="p" variant="bodyMd">{error.message}</Text></Banner>
    </Page>
  );

  return (
    <Page
      title="Products"
      subtitle="🔴 Not visible · 🟡 Partial · 🟢 AI-ready (Perplexity, SearchGPT, Gemini)"
      primaryAction={{
        content: bulkOptimizing
          ? `Optimizing... (${optimizedIds.size}/${productList.length})`
          : `✨ Optimize all (${productList.length})`,
        onAction: handleOptimizeAll,
        loading: bulkOptimizing,
        disabled: productList.length === 0,
      }}
    >
      <Layout>
        {notReady.length > 0 && !fetching && (
          <Layout.Section>
            <Banner
              tone="warning"
              title={`${notReady.length} products are not visible to AI search engines`}
              action={{ content: "Optimize all in 2 minutes", onAction: handleOptimizeAll }}
            >
              <Text as="p" variant="bodyMd">
                Perplexity Sonar, SearchGPT (GPT-4o), Gemini 2.0, and Copilot skip products
                without structured specs and semantic context. Use AEO Engine v2 to fix all at once.
              </Text>
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <BlockStack gap="100">
                <Text as="h2" variant="headingMd">Product Catalog</Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  Click "Details" to see full AEO analysis. AEO Engine v2 extracts physical specs
                  + target audience + use case + competitive advantage.
                </Text>
              </BlockStack>

              {fetching && productList.length === 0 ? (
                <Box padding="800"><BlockStack gap="400" inlineAlign="center"><Spinner size="large" /></BlockStack></Box>
              ) : productList.length === 0 ? (
                <EmptyState heading="Products not synced yet" image="">
                  <Text as="p" variant="bodyMd">Connect your Shopify store and sync products.</Text>
                </EmptyState>
              ) : (
                <DataTable
                  columnContentTypes={["text", "text", "text", "text"]}
                  headings={["Product", "AEO Visibility Score", "Last Optimized", "Actions"]}
                  rows={rows}
                  truncate
                />
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
