import { JobStatus, TransactionDirection, TransactionStatus } from "@prisma/client";
import { z } from "zod";
import { CATEGORIES } from "@/lib/categories";

export const idSchema = z.string().min(8).max(128);

const moneySchema = z.coerce
  .number()
  .finite()
  .min(0)
  .max(9_999_999_999.99)
  .multipleOf(0.01);
const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}, "Date must be a real calendar date in YYYY-MM-DD format.");
const optionalDateSchema = z.preprocess(
  (value) => (value === "" ? null : value),
  isoDateSchema.nullable().optional(),
);

export const jobCreateSchema = z.object({
  name: z.string().trim().min(1),
  customerName: z.string().trim().min(1),
  tradeType: z.string().trim().min(1),
  city: z.string().trim().optional().default(""),
  address: z.string().trim().optional().default(""),
  estimatedRevenue: moneySchema,
  actualRevenue: moneySchema,
  status: z.enum(JobStatus).optional().default(JobStatus.active),
  startDate: optionalDateSchema,
  endDate: optionalDateSchema,
});

export const jobPatchSchema = jobCreateSchema.partial().extend({
  id: idSchema,
});

export const transactionPatchSchema = z.object({
  id: idSchema,
  aiCategory: z.enum(CATEGORIES).optional(),
  jobId: idSchema.nullable().optional(),
  direction: z.enum(TransactionDirection).optional(),
  status: z.enum(TransactionStatus).optional(),
});

export const bulkTransactionSchema = z.object({
  ids: z.array(idSchema).min(1).max(200),
  action: z.enum(["mark_reviewed", "categorize", "assign_suggested"]),
});

const mappedHeader = z.string().trim().min(1).max(256).nullable().optional();

export const uploadOptionsSchema = z.object({
  preview: z.boolean().optional().default(false),
  signedAmountConvention: z.enum(["negative_expense", "positive_expense"]).optional().default("negative_expense"),
  columnMapping: z
    .object({
      date: mappedHeader,
      description: mappedHeader,
      merchant: mappedHeader,
      amount: mappedHeader,
      debit: mappedHeader,
      credit: mappedHeader,
      transactionType: mappedHeader,
      category: mappedHeader,
      memo: mappedHeader,
    })
    .optional(),
});

export const resetDemoSchema = z.object({
  token: z.string().min(12),
});
