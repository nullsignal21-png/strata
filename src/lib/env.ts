import { z } from "zod";

const optionalString = z.preprocess((value) => (value === "" ? undefined : value), z.string().optional());
const optionalUrl = z.preprocess((value) => (value === "" ? undefined : value), z.string().url().optional());

const envSchema = z.object({
  DATABASE_URL: optionalString,
  DIRECT_URL: optionalString,
  DEMO_MODE: z
    .enum(["true", "false"])
    .optional()
    .default(process.env.NODE_ENV === "production" ? "false" : "true"),
  DEMO_COMPANY_SLUG: z.string().min(1).optional().default("triangle-hvac-plumbing"),
  DEMO_RESET_TOKEN: optionalString,
  ENABLE_AI_CATEGORIZATION: z.enum(["true", "false"]).optional().default("false"),
  OPENAI_API_KEY: optionalString,
  OPENAI_MODEL: optionalString,
  QUICKBOOKS_CLIENT_ID: optionalString,
  QUICKBOOKS_CLIENT_SECRET: optionalString,
  QUICKBOOKS_REDIRECT_URI: optionalUrl,
  QUICKBOOKS_ENV: z.enum(["sandbox", "production"]).optional().default("sandbox"),
});

export type AppEnv = z.infer<typeof envSchema>;

export function getEnv(): AppEnv {
  return envSchema.parse(process.env);
}

export function isDemoMode() {
  return getEnv().DEMO_MODE === "true";
}

export function isAiCategorizationEnabled() {
  const env = getEnv();
  return env.ENABLE_AI_CATEGORIZATION === "true" && Boolean(env.OPENAI_API_KEY && env.OPENAI_MODEL);
}
