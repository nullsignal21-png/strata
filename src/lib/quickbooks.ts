import { getEnv } from "@/lib/env";

const authBase = "https://appcenter.intuit.com/connect/oauth2";

export function hasQuickBooksEnv() {
  const env = getEnv();
  return Boolean(env.QUICKBOOKS_CLIENT_ID && env.QUICKBOOKS_CLIENT_SECRET && env.QUICKBOOKS_REDIRECT_URI);
}

export function quickBooksMode() {
  return hasQuickBooksEnv() ? "sandbox_oauth" : "export";
}

export function buildQuickBooksAuthUrl(state: string) {
  if (!hasQuickBooksEnv()) return null;
  const env = getEnv();

  const params = new URLSearchParams({
    client_id: env.QUICKBOOKS_CLIENT_ID!,
    response_type: "code",
    scope: "com.intuit.quickbooks.accounting",
    redirect_uri: env.QUICKBOOKS_REDIRECT_URI!,
    state,
  });

  return `${authBase}?${params.toString()}`;
}
