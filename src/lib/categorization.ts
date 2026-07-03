import type { CategoryRule } from "@prisma/client";
import { CATEGORIES, isCategory } from "@/lib/categories";
import { categorizeWithOpenAI } from "@/lib/openai";
import { findJobByModelName, matchJob, type MatchableJob } from "@/lib/jobMatcher";

export type CategorizationInput = {
  merchant: string;
  description: string;
  rawCategory: string | null;
  amount: number;
};

export type CategorizationResult = {
  aiCategory: string;
  jobId: string | null;
  confidence: number;
  status: "categorized" | "needs_review";
};

const builtInRules = [
  ["home depot", "Materials", 0.96],
  ["lowe", "Materials", 0.95],
  ["ferguson", "Materials", 0.96],
  ["johnstone supply", "Materials", 0.96],
  ["shell", "Fuel & Vehicle", 0.92],
  ["bp", "Fuel & Vehicle", 0.9],
  ["exxon", "Fuel & Vehicle", 0.9],
  ["quickbooks", "Software", 0.94],
  ["stripe", "Software", 0.88],
  ["google workspace", "Software", 0.88],
  ["verizon", "Utilities", 0.88],
  ["office depot", "Office/Admin", 0.9],
  ["waste management", "Job Site / Disposal", 0.88],
  ["insurance", "Insurance", 0.84],
  ["permit", "Permits & Fees", 0.74],
  ["subcontractor", "Subcontractor", 0.78],
] as const;

function combinedText(input: CategorizationInput) {
  return `${input.merchant} ${input.description} ${input.rawCategory ?? ""}`.toLowerCase();
}

function ruleCategory(input: CategorizationInput, rules: CategoryRule[]) {
  const text = combinedText(input);

  for (const rule of rules) {
    if (text.includes(rule.keyword.toLowerCase()) && isCategory(rule.category)) {
      return { category: rule.category, confidence: 0.92 };
    }
  }

  for (const [keyword, category, confidence] of builtInRules) {
    if (text.includes(keyword)) {
      return { category, confidence };
    }
  }

  if (input.rawCategory && CATEGORIES.some((category) => category.toLowerCase() === input.rawCategory?.toLowerCase())) {
    return { category: input.rawCategory, confidence: 0.7 };
  }

  return { category: "Uncategorized", confidence: 0.3 };
}

export async function categorizeTransaction(
  input: CategorizationInput,
  jobs: MatchableJob[],
  rules: CategoryRule[],
): Promise<CategorizationResult> {
  const rule = ruleCategory(input, rules);
  const heuristicJob = matchJob(`${input.merchant} ${input.description}`, jobs);

  let category = rule.category;
  let jobId = heuristicJob.jobId;
  let confidence = Math.min(rule.confidence, jobId ? Math.max(heuristicJob.confidence, 0.75) : rule.confidence);

  if (rule.confidence < 0.75 || !jobId) {
    const model = await categorizeWithOpenAI({ ...input, jobs });
    if (model) {
      const modelJob = findJobByModelName(model.jobMatch, jobs);
      if (isCategory(model.category)) {
        category = model.category;
      }
      if (!jobId && modelJob.jobId) {
        jobId = modelJob.jobId;
      }
      confidence = Math.max(confidence, model.confidence);
    }
  }

  const status = confidence < 0.75 || category === "Uncategorized" ? "needs_review" : "categorized";
  return { aiCategory: category, jobId, confidence, status };
}
