import OpenAI from "openai";
import { categoriesForDirection, type TransactionDirectionValue } from "@/lib/categories";
import { getEnv, isAiCategorizationEnabled } from "@/lib/env";
import { logger } from "@/lib/logging";
import type { MatchableJob } from "@/lib/jobMatcher";

export type ModelCategorization = {
  category: string;
  jobMatch: string | null;
  confidence: number;
  reason: string;
};

let client: OpenAI | null = null;

function getOpenAIClient() {
  const env = getEnv();
  if (!env.OPENAI_API_KEY) return null;
  client ??= new OpenAI({ apiKey: env.OPENAI_API_KEY });
  return client;
}

export async function categorizeWithOpenAI(input: {
  merchant: string;
  description: string;
  memo: string | null;
  rawCategory: string | null;
  direction: TransactionDirectionValue;
  jobs: MatchableJob[];
}): Promise<ModelCategorization | null> {
  if (!isAiCategorizationEnabled()) return null;

  const openai = getOpenAIClient();
  const env = getEnv();
  if (!openai || !env.OPENAI_MODEL) return null;

  const allowedCategories = categoriesForDirection(input.direction);
  const schema = {
    type: "object",
    additionalProperties: false,
    required: ["category", "jobMatch", "confidence", "reason"],
    properties: {
      category: { type: "string", enum: allowedCategories },
      jobMatch: { anyOf: [{ type: "string" }, { type: "null" }] },
      confidence: { type: "number", minimum: 0, maximum: 1 },
      reason: { type: "string" },
    },
  } as const;

  try {
    const response = await openai.responses.create(
      {
        model: env.OPENAI_MODEL,
        instructions:
          "Categorize contractor bank transactions for job costing. Return only the requested structured JSON. Use a job only when the transaction text clearly matches the job name, customer, city, address, or trade.",
        input: JSON.stringify({
          transaction: {
            merchant: input.merchant,
            description: input.description,
            memo: input.memo,
            rawCategory: input.rawCategory,
            direction: input.direction,
          },
          allowedCategories,
          jobs: input.jobs.map((job) => ({
            name: job.name,
            customerName: job.customerName,
            tradeType: job.tradeType,
            city: job.city,
          })),
        }),
        store: false,
        temperature: 0,
        text: {
          format: {
            type: "json_schema",
            name: "transaction_categorization",
            strict: true,
            schema,
          },
        },
      },
      { signal: AbortSignal.timeout(8000) },
    );

    const content = response.output_text;
    if (!content) return null;

    const parsed = JSON.parse(content) as ModelCategorization;
    return {
      category: parsed.category,
      jobMatch: parsed.jobMatch,
      confidence: Math.max(0, Math.min(1, parsed.confidence)),
      reason: parsed.reason.slice(0, 180),
    };
  } catch (error) {
    logger.warn("openai_categorization_failed", {
      error: error instanceof Error ? error.name : "unknown",
    });
    return null;
  }
}
