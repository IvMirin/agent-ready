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
  Modal,
  Page,
  Select,
  Spinner,
  Text,
  TextField,
} from "@shopify/polaris";
import { api } from "../api";

export default function Citations() {
  const [addOpen, setAddOpen] = useState(false);
  const [engineFilter, setEngineFilter] = useState("all");
  const [form, setForm] = useState({
    sourceEngine: "Perplexity",
    triggerQuery: "",
    citationSnippet: "",
  });
  const [formError, setFormError] = useState("");

  const [{ data: citations, fetching, error }] = useFindMany(
    api.citationEvent,
    {
      first: 100,
      sort: { createdAt: "Descending" },
      select: {
        id: true,
        sourceEngine: true,
        triggerQuery: true,
        citationSnippet: true,
        createdAt: true,
        citedProduct: { id: true, title: true },
      },
    }
  );

  const [{ fetching: creating }, createCitation] = useAction(
    api.citationEvent.create
  );

  const handleCreate = useCallback(async () => {
    setFormError("");
    if (!form.triggerQuery.trim()) {
      setFormError("Enter a search query");
      return;
    }
    if (!form.citationSnippet.trim()) {
      setFormError("Enter the mention text");
      return;
    }
    try {
      await createCitation({
        ...form,
        detectedAt: new Date().toISOString(),
      });
      setForm({ sourceEngine: "Perplexity", triggerQuery: "", citationSnippet: "" });
      setAddOpen(false);
    } catch (err: any) {
      setFormError(err.message ?? "Failed to save");
    }
  }, [form, createCitation]);

  const filtered =
    engineFilter === "all"
      ? (citations ?? [])
      : (citations ?? []).filter((c) => c.sourceEngine === engineFilter);

  const engineTone = (e: string | null | undefined) => {
    if (e === "Perplexity") return "success" as const;
    if (e === "SearchGPT") return "info" as const;
    if (e === "GeminiAI") return "warning" as const;
    return "new" as const;
  };

  // Summary by engine
  const byEngine = (citations ?? []).reduce<Record<string, number>>((acc, c) => {
    const e = c.sourceEngine ?? "Unknown";
    acc[e] = (acc[e] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <Page
      title="AI Search Engine Mentions"
      subtitle="Each mention is a potential customer who found you via Perplexity or SearchGPT"
      primaryAction={{
        content: "Add mention",
        onAction: () => setAddOpen(true),
      }}
    >
      <Layout>
        {/* Summary stats */}
        {Object.keys(byEngine).length > 0 && (
          <Layout.Section>
            <InlineStack gap="400" wrap>
              {Object.entries(byEngine).map(([engine, count]) => (
                <Card key={engine}>
                  <BlockStack gap="100" inlineAlign="center">
                    <Text as="p" variant="headingLg" alignment="center">
                      {count}
                    </Text>
                    <Badge tone={engineTone(engine)}>{engine}</Badge>
                  </BlockStack>
                </Card>
              ))}
            </InlineStack>
          </Layout.Section>
        )}

        {/* List */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between">
                <BlockStack gap="100">
                  <Text as="h2" variant="headingMd">
                    All mentions
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    The query that led a shopper to your product through AI
                  </Text>
                </BlockStack>
                <Select
                  label=""
                  labelHidden
                  options={[
                    { label: "All engines", value: "all" },
                    { label: "Perplexity", value: "Perplexity" },
                    { label: "SearchGPT", value: "SearchGPT" },
                    { label: "GeminiAI", value: "GeminiAI" },
                    { label: "Copilot", value: "Copilot" },
                  ]}
                  value={engineFilter}
                  onChange={setEngineFilter}
                />
              </InlineStack>

              {error && (
                <Banner tone="critical">
                  <Text as="p" variant="bodyMd">{error.message}</Text>
                </Banner>
              )}

              {fetching && !citations ? (
                <Box padding="800">
                  <BlockStack gap="400" inlineAlign="center">
                    <Spinner size="large" />
                  </BlockStack>
                </Box>
              ) : filtered.length === 0 ? (
                <EmptyState heading="No mentions yet" image="">
                  <Text as="p" variant="bodyMd">
                    Once Perplexity or SearchGPT mentions your product, it will
                    appear here. Add a mention manually to test the feature.
                  </Text>
                </EmptyState>
              ) : (
                <BlockStack gap="300">
                  {filtered.map((cit) => (
                    <Box
                      key={cit.id}
                      padding="300"
                      borderWidth="025"
                      borderColor="border"
                      borderRadius="200"
                    >
                      <InlineStack
                        align="space-between"
                        blockAlign="start"
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
                          {cit.citationSnippet && (
                            <Text as="span" variant="bodySm" tone="subdued">
                              «{cit.citationSnippet.slice(0, 120)}
                              {cit.citationSnippet.length > 120 ? "…" : ""}»
                            </Text>
                          )}
                        </BlockStack>
                        <Badge tone={engineTone(cit.sourceEngine)}>
                          {cit.sourceEngine ?? "—"}
                        </Badge>
                      </InlineStack>
                    </Box>
                  ))}
                </BlockStack>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>

      {/* Add Modal */}
      <Modal
        open={addOpen}
        onClose={() => { setAddOpen(false); setFormError(""); }}
        title="Add mention manually"
        primaryAction={{
          content: "Save",
          onAction: handleCreate,
          loading: creating,
        }}
        secondaryActions={[
          { content: "Cancel", onAction: () => { setAddOpen(false); setFormError(""); } },
        ]}
      >
        <Modal.Section>
          <BlockStack gap="400">
            {formError && (
              <Banner tone="critical">
                <Text as="p" variant="bodyMd">{formError}</Text>
              </Banner>
            )}
            <Select
              label="AI search engine"
              options={[
                { label: "Perplexity", value: "Perplexity" },
                { label: "SearchGPT", value: "SearchGPT" },
                { label: "GeminiAI", value: "GeminiAI" },
                { label: "Copilot", value: "Copilot" },
              ]}
              value={form.sourceEngine}
              onChange={(v) => setForm((p) => ({ ...p, sourceEngine: v }))}
            />
            <TextField
              label="Shopper query"
              placeholder="e.g. best snowboard under $500"
              value={form.triggerQuery}
              onChange={(v) => setForm((p) => ({ ...p, triggerQuery: v }))}
              autoComplete="off"
            />
            <TextField
              label="AI response text"
              placeholder="Paste a fragment of the Perplexity or SearchGPT response..."
              value={form.citationSnippet}
              onChange={(v) => setForm((p) => ({ ...p, citationSnippet: v }))}
              multiline={4}
              autoComplete="off"
            />
            <Text as="p" variant="bodySm" tone="subdued">
              The system will automatically try to match the mentioned product in your catalog.
            </Text>
          </BlockStack>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
