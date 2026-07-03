import OpenAI from "openai";
import { CATEGORIES } from "@/lib/categories";
import type { MatchableJob } from "@/lib/jobMatcher";

export type ModelCategorization = {
  category: string;
  jobMatch: string | null;
  confidence: number;
  reason: string;
};

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["category", "jobMatch", "confidence", "reason"],
  properties: {
    category: { type: "string", enum: CATEGORIES },
    jobMatch: { anyOf: [{ type: "string" }, { type: "null" }] },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    reason: { type: "string" },
  },
} as const;

export async function categorizeWithOpenAI(input: {
  merchant: string;
  description: string;
  rawCategory: string | null;
  amount: number;
  jobs: MatchableJob[];
}): Promise<ModelCategorization | null> {
  if (!process.env.OPENAI_API_KEY) return null;

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    temperature: 0,
    messages: [
      {
        role: "system",
        content:
          "Categorize contractor bank transactions for job costing. Return only the requested structured JSON.",
      },
      {
        role: "user",
        content: JSON.stringify({
          transaction: {
            merchant: input.merchant,
            description: input.description,
            rawCategory: input.rawCategory,
            amount: input.amount,
          },
          categories: CATEGORIES,
          jobs: input.jobs.map((job) => ({
            name: job.name,
            customerName: job.customerName,
            tradeType: job.tradeType,
          })),
        }),
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "transaction_categorization",
        strict: true,
        schema,
      },
    },
  });

  const content = response.choices[0]?.message.content;
  if (!content) return null;

  try {
    const parsed = JSON.parse(content) as ModelCategorization;
    return {
      category: parsed.category,
      jobMatch: parsed.jobMatch,
      confidence: Math.max(0, Math.min(1, parsed.confidence)),
      reason: parsed.reason,
    };
  } catch {
    return null;
  }
}
