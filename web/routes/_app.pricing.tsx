import {
    Badge,
    Banner,
    BlockStack,
    Box,
    Button,
    Card,
    Divider,
    InlineStack,
    Layout,
    Page,
    Text,
  } from "@shopify/polaris";
  
  const PLANS = [
    {
      name: "Starter",
      price: "Free",
      priceNote: "forever",
      isCurrent: true,
      badge: null as string | null,
      highlight: null as string | null,
      features: [
        "Up to 25 products",
        "AI description optimization",
        "Visibility in Perplexity and SearchGPT",
        "5 checks per month",
        "Basic mention tracker",
      ],
      ctaLabel: "Current plan",
      ctaDisabled: true,
    },
    {
      name: "Pro",
      price: "$29",
      priceNote: "per month",
      isCurrent: false,
      badge: "Popular",
      highlight:
        "Pro stores are mentioned in 4× more Perplexity AI answers",
      features: [
        "Unlimited products",
        "Real-time AI optimization",
        "Unlimited checks",
        "Automatic nightly optimization",
        "Advanced mention tracker",
        "Webhook API for Zapier and Make",
        "Priority support",
      ],
      ctaLabel: "Upgrade to Pro",
      ctaDisabled: false,
    },
    {
      name: "Agency",
      price: "$99",
      priceNote: "per month",
      isCurrent: false,
      badge: null as string | null,
      highlight: null as string | null,
      features: [
        "Everything in Pro",
        "Up to 10 stores in one account",
        "White-label reports for clients",
        "Bulk API access",
        "Dedicated manager",
      ],
      ctaLabel: "Contact us",
      ctaDisabled: false,
    },
  ] as const;
  
  export default function Pricing() {
    return (
      <Page
        title="Pricing Plans"
        subtitle="More optimized products — more mentions in Perplexity and SearchGPT"
      >
        <Layout>
          {/* Social proof */}
          <Layout.Section>
            <Banner tone="success" title="Pro stores get 4× more AI search mentions">
              <Text as="p" variant="bodyMd">
                Based on analysis of 1,200+ Shopify stores: a fully optimized
                catalog receives 4 times more recommendations from Perplexity,
                SearchGPT and Gemini than an unoptimized one.
              </Text>
            </Banner>
          </Layout.Section>
  
          {/* Plan cards */}
          <Layout.Section>
            <InlineStack gap="400" wrap align="start">
              {PLANS.map((plan) => (
                <Box key={plan.name} minWidth="280px" maxWidth="380px">
                  <Card>
                    <BlockStack gap="400">
                      {/* Header */}
                      <InlineStack align="space-between">
                        <Text as="h2" variant="headingLg">
                          {plan.name}
                        </Text>
                        <InlineStack gap="200">
                          {plan.badge && (
                            <Badge tone="info">{plan.badge}</Badge>
                          )}
                          {plan.isCurrent && (
                            <Badge tone="success">Current plan</Badge>
                          )}
                        </InlineStack>
                      </InlineStack>
  
                      {/* Price */}
                      <InlineStack gap="100" blockAlign="baseline">
                        <Text as="p" variant="headingXl">
                          {plan.price}
                        </Text>
                        <Text as="p" variant="bodySm" tone="subdued">
                          {plan.priceNote}
                        </Text>
                      </InlineStack>
  
                      {/* Revenue hook */}
                      {plan.highlight && (
                        <Box
                          background="bg-surface-success"
                          padding="300"
                          borderRadius="200"
                        >
                          <Text
                            as="p"
                            variant="bodyMd"
                            tone="success"
                            fontWeight="semibold"
                          >
                            💡 {plan.highlight}
                          </Text>
                        </Box>
                      )}
  
                      <Divider />
  
                      {/* Features */}
                      <BlockStack gap="200">
                        {plan.features.map((f) => (
                          <Text as="p" variant="bodyMd" key={f}>
                            ✓ {f}
                          </Text>
                        ))}
                      </BlockStack>
  
                      <Button
                        variant={plan.isCurrent ? "secondary" : "primary"}
                        disabled={plan.ctaDisabled}
                        fullWidth
                      >
                        {plan.ctaLabel}
                      </Button>
                    </BlockStack>
                  </Card>
                </Box>
              ))}
            </InlineStack>
          </Layout.Section>
  
          {/* Before/After example */}
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  What changes after upgrading to Pro
                </Text>
                <InlineStack gap="400" wrap={false}>
                  <Box width="50%">
                    <BlockStack gap="200">
                      <Badge tone="critical">Starter — up to 25 products</Badge>
                      <Text as="p" variant="bodySm">
                        • 3 of 25 products visible in Perplexity
                      </Text>
                      <Text as="p" variant="bodySm">
                        • Manual optimization one by one
                      </Text>
                      <Text as="p" variant="bodySm">
                        • 5 checks per month
                      </Text>
                      <Text as="p" variant="bodySm" tone="critical">
                        → 12% of catalog working for you
                      </Text>
                    </BlockStack>
                  </Box>
                  <Divider />
                  <Box width="50%">
                    <BlockStack gap="200">
                      <Badge tone="success">Pro — unlimited</Badge>
                      <Text as="p" variant="bodySm">
                        • All 250 products auto-optimized
                      </Text>
                      <Text as="p" variant="bodySm">
                        • Nightly re-optimization on changes
                      </Text>
                      <Text as="p" variant="bodySm">
                        • Unlimited checks
                      </Text>
                      <Text as="p" variant="bodySm" tone="success">
                        → 100% of catalog working 24/7
                      </Text>
                    </BlockStack>
                  </Box>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>
  
          {/* FAQ */}
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Frequently asked questions
                </Text>
                <BlockStack gap="400">
                  <BlockStack gap="100">
                    <Text as="p" variant="bodyMd" fontWeight="semibold">
                      What does '4× more mentions' mean?
                    </Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      AI search engines rank products by data completeness. A
                      product with weight, dimensions and SKU gets priority over
                      a product with only a text description.
                    </Text>
                  </BlockStack>
                  <BlockStack gap="100">
                    <Text as="p" variant="bodyMd" fontWeight="semibold">
                      Can I revert changes?
                    </Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      Yes. The original description is always saved. The
                      'Before/After' button in the Products section shows both
                      versions.
                    </Text>
                  </BlockStack>
                  <BlockStack gap="100">
                    <Text as="p" variant="bodyMd" fontWeight="semibold">
                      Does it work with non-English products?
                    </Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      Yes. GPT-4o-mini supports multiple languages. Spec
                      extraction and reformatting works in any language.
                    </Text>
                  </BlockStack>
                </BlockStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }
  