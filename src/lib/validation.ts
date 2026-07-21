import { JobStatus, TransactionDirection, TransactionStatus } from "@prisma/client";
import { z } from "zod";
import { CATEGORIES } from "@/lib/categories";

export const idSchema = z.string().min(8).max(128);

export const jobCreateSchema = z.object({
  name: z.string().trim().min(1),
  customerName: z.string().trim().min(1),
  tradeType: z.string().trim().min(1),
  city: z.string().trim().optional().default(""),
  address: z.string().trim().optional().default(""),
  estimatedRevenue: z.coerce.number().min(0),
  actualRevenue: z.coerce.number().min(0),
  status: z.enum(JobStatus).optional().default(JobStatus.active),
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

export const uploadOptionsSchema = z.object({
  preview: z.boolean().optional().default(false),
  signedAmountConvention: z.enum(["negative_expense", "positive_expense"]).optional().default("negative_expense"),
});

export const resetDemoSchema = z.object({
  token: z.string().min(12),
});
