import { Banner, Text } from "@shopify/polaris";

interface UpgradeBannerProps {
  productCount: number;
  plan: string | null | undefined;
}

export function UpgradeBanner({ productCount, plan }: UpgradeBannerProps) {
  if (plan === "pro" || plan === "growth") {
    return null;
  }

  if (productCount <= 100) {
    return null;
  }

  return (
    <Banner
      tone="warning"
      title="Product limit reached"
      action={{ content: "View Pricing Plans", url: "/pricing" }}
    >
      <Text as="p">
        Your Starter plan is limited to 100 products. You have {productCount} products. Upgrade to Pro ($19/mo) or Growth ($49/mo) to optimize your entire catalog.
      </Text>
    </Banner>
  );
}