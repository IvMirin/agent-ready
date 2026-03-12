import type OpenAI from "openai";

function stripHtml(text: string): string {
  return text.replace(/<[^>]*>/g, "");
}

export interface AnalysisResult {
  factFirstDescription: string;
  extractedSpecs: {
    dimensions: string | null;
    weight: string | null;
    materials: string | null;
    keyFeatures: string[];
  };
  agenticScore: number;
  resultStatus: "PASS" | "SOFT_FAIL" | "HARD_FAIL";
  failureReason:
    | "MISSING_DIMENSIONS"
    | "MISSING_WEIGHT"
    | "AMBIGUOUS_DESCRIPTION"
    | "NO_STRUCTURED_DATA"
    | null;
  agentPayloadSnapshot: Record<string, unknown>;
}

interface ProductInput {
  title: string;
  body: string | null;
  productType: string | null;
  vendor: string | null;
  tags: string[] | null;
  variants: Array<{
    title: string;
    sku: string | null;
    price: string | null;
    option1: string | null;
    option2: string | null;
    option3: string | null;
    barcode: string | null;
  }>;
}

const SYSTEM_PROMPT = `You are an AI Shopping Agent Simulator. Your job is to evaluate how well a product listing would perform when parsed by AI shopping agents such as Perplexity, SearchGPT, and Gemini Shopping.

These AI agents need structured, fact-first product data to confidently recommend products to users. Marketing fluff, vague descriptions, and missing technical specifications reduce the likelihood that an AI agent will cite or recommend a product.

Given a product's details (title, description, product type, vendor, tags, and variant information), you must:

1. **Extract technical specifications** from all available data:
   - Dimensions (length, width, height, or any size measurements)
   - Weight (in any unit)
   - Materials (what the product is made of)
   - Key features (concrete, factual product attributes — not marketing claims)

2. **Rewrite the description** into a "Fact-First" hybrid format:
   - Start with a structured specs block using bullet points covering: dimensions, weight, materials, and key features
   - Follow with a concise marketing paragraph (2-3 sentences max) that highlights the product's value proposition

3. **Score the product's "agentic readiness"** from 0 to 100 based on:
   - Completeness of structured data (dimensions, weight, materials present)
   - Clarity and specificity of the description
   - Presence of concrete, extractable facts vs. vague marketing language
   - Variant information quality (SKUs, prices, options clearly defined)

4. **Determine resultStatus**:
   - "PASS" if agenticScore >= 70
   - "SOFT_FAIL" if agenticScore is between 40 and 69 (inclusive)
   - "HARD_FAIL" if agenticScore < 40

5. **Determine failureReason** (set to null if resultStatus is "PASS"):
   - "MISSING_DIMENSIONS" if no dimensions could be found or inferred
   - "MISSING_WEIGHT" if no weight could be found or inferred
   - "AMBIGUOUS_DESCRIPTION" if the description is too vague or overly marketing-heavy with few concrete facts
   - "NO_STRUCTURED_DATA" if there is almost no extractable technical data at all
   Choose the most impactful failure reason. If resultStatus is "PASS", failureReason must be null.

Return your response as valid JSON with exactly these keys:
{
  "factFirstDescription": "string — the rewritten Fact-First description",
  "extractedSpecs": {
    "dimensions": "string or null",
    "weight": "string or null",
    "materials": "string or null",
    "keyFeatures": ["array of strings"]
  },
  "agenticScore": number,
  "resultStatus": "PASS" | "SOFT_FAIL" | "HARD_FAIL",
  "failureReason": "MISSING_DIMENSIONS" | "MISSING_WEIGHT" | "AMBIGUOUS_DESCRIPTION" | "NO_STRUCTURED_DATA" | null
}`;

function buildUserMessage(product: ProductInput): string {
  const plainBody = product.body ? stripHtml(product.body) : "(no description provided)";
  const tagsStr = product.tags && product.tags.length > 0 ? product.tags.join(", ") : "(none)";

  let variantDetails = "(no variants)";
  if (product.variants && product.variants.length > 0) {
    variantDetails = product.variants
      .map((v, i) => {
        const parts: string[] = [`Variant ${i + 1}: ${v.title}`];
        if (v.sku) parts.push(`  SKU: ${v.sku}`);
        if (v.price) parts.push(`  Price: ${v.price}`);
        if (v.option1) parts.push(`  Option 1: ${v.option1}`);
        if (v.option2) parts.push(`  Option 2: ${v.option2}`);
        if (v.option3) parts.push(`  Option 3: ${v.option3}`);
        if (v.barcode) parts.push(`  Barcode: ${v.barcode}`);
        return parts.join("\n");
      })
      .join("\n\n");
  }

  return `Please analyze the following product listing:

**Title:** ${product.title}

**Description:**
${plainBody}

**Product Type:** ${product.productType ?? "(not specified)"}

**Vendor:** ${product.vendor ?? "(not specified)"}

**Tags:** ${tagsStr}

**Variants:**
${variantDetails}`;
}

export async function analyzeProduct(
  openai: OpenAI,
  product: ProductInput
): Promise<AnalysisResult> {
  const userMessage = buildUserMessage(product);

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    temperature: 0.3,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI returned an empty response");
  }

  const parsedResponse = JSON.parse(content) as {
    factFirstDescription: string;
    extractedSpecs: {
      dimensions: string | null;
      weight: string | null;
      materials: string | null;
      keyFeatures: string[];
    };
    agenticScore: number;
    resultStatus: "PASS" | "SOFT_FAIL" | "HARD_FAIL";
    failureReason:
      | "MISSING_DIMENSIONS"
      | "MISSING_WEIGHT"
      | "AMBIGUOUS_DESCRIPTION"
      | "NO_STRUCTURED_DATA"
      | null;
  };

  const agentPayloadSnapshot: Record<string, unknown> = {
    input: {
      title: product.title,
      body: product.body,
      productType: product.productType,
      vendor: product.vendor,
      tags: product.tags,
      variants: product.variants,
    },
    rawResponse: parsedResponse,
    model: "gpt-4o-mini",
    timestamp: new Date().toISOString(),
  };

  return {
    factFirstDescription: parsedResponse.factFirstDescription,
    extractedSpecs: {
      dimensions: parsedResponse.extractedSpecs?.dimensions ?? null,
      weight: parsedResponse.extractedSpecs?.weight ?? null,
      materials: parsedResponse.extractedSpecs?.materials ?? null,
      keyFeatures: parsedResponse.extractedSpecs?.keyFeatures ?? [],
    },
    agenticScore: parsedResponse.agenticScore,
    resultStatus: parsedResponse.resultStatus,
    failureReason: parsedResponse.failureReason ?? null,
    agentPayloadSnapshot,
  };
}