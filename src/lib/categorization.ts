import type { CategoryRule } from "@prisma/client";
import {
  categoriesForDirection,
  defaultCategoryForDirection,
  isCategory,
  type TransactionDirectionValue,
} from "@/lib/categories";
import { categorizeWithOpenAI } from "@/lib/openai";
import { findJobByModelName, matchJob, type MatchableJob } from "@/lib/jobMatcher";

export type CategorizationInput = {
  merchant: string;
  description: string;
  memo: string | null;
  rawCategory: string | null;
  amount: number;
  direction: TransactionDirectionValue;
};

export type CategorizationResult = {
  aiCategory: string;
  jobId: string | null;
  suggestedJobId: string | null;
  confidence: number;
  matchConfidence: number;
  matchReason: string | null;
  status: "categorized" | "needs_review";
};

const expenseRules = [
  ["home depot", "Materials", 0.96],
  ["lowe", "Materials", 0.95],
  ["ferguson", "Materials", 0.96],
  ["johnstone supply", "Materials", 0.96],
  ["grainger", "Tools & Equipment", 0.9],
  ["shell", "Fuel & Vehicle", 0.92],
  ["bp", "Fuel & Vehicle", 0.9],
  ["exxon", "Fuel & Vehicle", 0.9],
  ["u-haul", "Fuel & Vehicle", 0.86],
  ["quickbooks", "Software", 0.94],
  ["stripe", "Software", 0.88],
  ["google workspace", "Software", 0.88],
  ["verizon", "Utilities", 0.88],
  ["duke energy", "Utilities", 0.86],
  ["office depot", "Office/Admin", 0.9],
  ["waste management", "Job Site / Disposal", 0.88],
  ["insurance", "Insurance", 0.84],
  ["permit", "Permits & Fees", 0.74],
  ["subcontractor", "Subcontractor", 0.78],
  ["meal", "Meals", 0.76],
] as const;

const incomeRules = [
  ["customer payment", "Customer Payment", 0.9],
  ["invoice payment", "Customer Payment", 0.9],
  ["deposit", "Customer Payment", 0.84],
  ["ach credit", "Customer Payment", 0.78],
  ["refund", "Refund", 0.86],
] as const;

function combinedText(input: CategorizationInput) {
  return `${input.merchant} ${input.description} ${input.memo ?? ""} ${input.rawCategory ?? ""}`.toLowerCase();
}

function allowedCategory(input: CategorizationInput, category: string) {
  return categoriesForDirection(input.direction).some((allowed) => allowed === category);
}

function ruleCategory(input: CategorizationInput, rules: CategoryRule[]) {
  const text = combinedText(input);
  const merchant = input.merchant.toLowerCase();

  for (const rule of rules) {
    if (rule.direction !== input.direction || !allowedCategory(input, rule.category)) continue;
    const keyword = rule.keyword.toLowerCase();
    if (merchant === keyword || text.includes(keyword)) {
      return { category: rule.category, confidence: merchant === keyword ? 0.97 : 0.92 };
    }
  }

  const builtInRules = input.direction === "income" ? incomeRules : expenseRules;
  for (const [keyword, category, confidence] of builtInRules) {
    if (text.includes(keyword)) {
      return { category, confidence };
    }
  }

  if (input.rawCategory && allowedCategory(input, input.rawCategory)) {
    return { category: input.rawCategory, confidence: 0.7 };
  }

  return { category: defaultCategoryForDirection(input.direction), confidence: 0.3 };
}

export async function categorizeTransaction(
  input: CategorizationInput,
  jobs: MatchableJob[],
  rules: CategoryRule[],
): Promise<CategorizationResult> {
  const rule = ruleCategory(input, rules);
  const heuristicJob = matchJob(`${input.merchant} ${input.description} ${input.memo ?? ""}`, jobs);

  let category = rule.category;
  let categoryConfidence = rule.confidence;
  let suggestedJobId = heuristicJob.jobId;
  let jobId = heuristicJob.status === "matched" ? heuristicJob.jobId : null;
  let matchConfidence = heuristicJob.confidence;
  let matchReason = heuristicJob.status === "unmatched" ? null : heuristicJob.reason;

  if (rule.confidence < 0.75 || heuristicJob.status !== "matched") {
    const model = await categorizeWithOpenAI({ ...input, jobs });
    if (model) {
      const modelJob = findJobByModelName(model.jobMatch, jobs);
      if (isCategory(model.category) && allowedCategory(input, model.category)) {
        category = model.category;
      }
      if (!jobId && modelJob.status === "matched") {
        jobId = modelJob.jobId;
        suggestedJobId = modelJob.jobId;
        matchConfidence = modelJob.confidence;
        matchReason = model.reason || modelJob.reason;
      }
      categoryConfidence = Math.max(categoryConfidence, model.confidence);
    }
  }

  const needsReview =
    categoryConfidence < 0.75 ||
    category === defaultCategoryForDirection(input.direction) ||
    (suggestedJobId !== null && jobId === null);

  return {
    aiCategory: category,
    jobId,
    suggestedJobId,
    confidence: categoryConfidence,
    matchConfidence,
    matchReason,
    status: needsReview ? "needs_review" : "categorized",
  };
}
