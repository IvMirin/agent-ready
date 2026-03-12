import { useState, useCallback } from "react";
import { useFindMany, useAction } from "@gadgetinc/react";
import {
  Badge,
  Banner,
  BlockStack,
  Box,
  Button,
  ButtonGroup,
  Card,
  DataTable,
  EmptyState,
  InlineStack,
  Layout,
  Page,
  ProgressBar,
  Spinner,
  Text,
  Tooltip,
} from "@shopify/polaris";
import { useNavigate } from "react-router";
import { api } from "../api";

// ─── Helpers ──────────────────────────────────────────────────

function getMissingReason(
  specs: Record<string, unknown> | null | undefined
): string | null {
  if (!specs) return 'No data — click "Fix"';
  const missing: string[] = [];
  if (!specs.weight)     missing.push("weight");
  if (!specs.dimensions) missing.push("dimensions");
  if (!specs.material)   missing.push("material");
  if (!specs.sku)        missing.push("SKU");
  if (missing.length === 0) return null;
  return `Missing: ${missing.join(", ")}`;
}

function scoreEmoji(score: number): string {
  if (score >= 70) return "🟢";
  if (score >= 40) return "🟡";
  return "🔴";
}

function scoreTone(
  score: number
): "success" | "caution" | "critical" {
  if (score >= 70) return "success";
  if (score >= 40) return "caution";
  return "critical";
}

// ─── Component ────────────────────────────────────────────────

export default function ProductsIndex() {
  const navigate = useNavigate();
  const [bulkOptimizing, setBulkOptimizing] = useState(false);
  const [optimizedIds, setOptimizedIds] = useState<Set<string>>(new Set());

  const [{ data: products, fetching, error }] = useFindMany(
    api.shopifyProduct,
    {
      first: 250,
      select: {
        id: true,
        title: true,
        agenticScore: true,
        isAgentReady: true,
        lastOptimizedAt: true,
        technicalSpecsJson: true,
        factSummary: { markdown: true },
        originalBodyHtml: { markdown: true },
      },
      sort: { agenticScore: "Ascending" },
    }
  );

  const [{ fetching: optimizing }, optimizeProduct] = useAction(
    api.shopifyProduct.optimize
  );

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
    } finally {
      setBulkOptimizing(false);
    }
  }, [bulkOptimizing, productList, optimizeProduct]);

  const rows = productList.map((p) => {
    const score = p.agenticScore ?? 0;
    const specs = p.technicalSpecsJson as
      | Record<string, unknown>
      | null
      | undefined;
    const missingReason = getMissingReason(specs);
    const justOptimized = optimizedIds.has(p.id) && p.isAgentReady;

    return [
      // Column 1 — Product name + inline hint
      <BlockStack key={`n-${p.id}`} gap="050">
        <Text variant="bodyMd" fontWeight="semibold" as="span">
          {p.title ?? "—"}
        </Text>
        {missingReason && !p.isAgentReady && (
          <Text variant="bodySm" tone="critical" as="span">
            {missingReason} — skipped by Perplexity
          </Text>
        )}
        {justOptimized && (
          <Text variant="bodySm" tone="success" as="span">
            ✓ Will now appear in AI answers
          </Text>
        )}
      </BlockStack>,

      // Column 2 — Score bar
      <BlockStack key={`s-${p.id}`} gap="100">
        <Text variant="bodySm" as="span">
          {scoreEmoji(score)} {score}/100
          {p.isAgentReady ? " — Visible in AI" : score >= 40 ? " — Partial" : " — Invisible"}
        </Text>
        <ProgressBar
          progress={score}
          tone={p.isAgentReady ? "success" : score >= 40 ? "highlight" : "critical"}
          size="small"
        />
      </BlockStack>,

      // Column 3 — Last optimized
      p.lastOptimizedAt ? (
        <Text key={`d-${p.id}`} variant="bodySm" as="span">
          {new Date(p.lastOptimizedAt).toLocaleDateString()}
        </Text>
      ) : (
        <Text key={`d-${p.id}`} variant="bodySm" tone="subdued" as="span">
          Not processed
        </Text>
      ),

      // Column 4 — Actions
      <ButtonGroup key={`b-${p.id}`}>
        <Button
          size="slim"
          variant={p.isAgentReady ? "secondary" : "primary"}
          onClick={() => optimizeProduct({ id: p.id })}
          loading={optimizing}
        >
          {p.isAgentReady ? "Refresh" : "Fix & Optimize"}
        </Button>
        <Button
          size="slim"
          variant="plain"
          onClick={() => navigate(`/products/${p.id}`)}
        >
          Details
        </Button>
      </ButtonGroup>,
    ];
  });

  if (error) {
    return (
      <Page title="Products">
        <Banner tone="critical">
          <Text as="p" variant="bodyMd">{error.message}</Text>
        </Banner>
      </Page>
    );
  }

  return (
    <Page
      title="Products"
      subtitle="🔴 Invisible to AI · 🟡 Partial · 🟢 Visible in Perplexity and SearchGPT"
      primaryAction={{
        content: bulkOptimizing
          ? `Optimizing... (${optimizedIds.size}/${productList.length})`
          : `Fix all (${productList.length})`,
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
              title={`${notReady.length} products are hidden from AI shoppers`}
              action={{
                content: "Fix all in 2 minutes",
                onAction: handleOptimizeAll,
              }}
            >
              <Text as="p" variant="bodyMd">
                Perplexity and SearchGPT don't recommend products without weight,
                dimensions, or material. Click "Fix & Optimize" on each red
                product, or "Fix all" for batch processing.
              </Text>
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between">
                <BlockStack gap="100">
                  <Text as="h2" variant="headingMd">
                    Product Catalog
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Click "Details" to see what AI search engines see about this product.
                  </Text>
                </BlockStack>
              </InlineStack>

              {fetching && productList.length === 0 ? (
                <Box padding="800">
                  <BlockStack gap="400" inlineAlign="center">
                    <Spinner size="large" />
                  </BlockStack>
                </Box>
              ) : productList.length === 0 ? (
                <EmptyState heading="Products not synced yet" image="">
                  <Text as="p" variant="bodyMd">
                    Connect your Shopify store and sync products.
                  </Text>
                </EmptyState>
              ) : (
                <DataTable
                  columnContentTypes={["text", "text", "text", "text"]}
                  headings={[
                    "Product",
                    "AI Visibility",
                    "Processed",
                    "Actions",
                  ]}
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
