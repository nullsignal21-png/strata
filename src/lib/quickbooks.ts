const authBase = "https://appcenter.intuit.com/connect/oauth2";

export function hasQuickBooksEnv() {
  return Boolean(
    process.env.QUICKBOOKS_CLIENT_ID &&
      process.env.QUICKBOOKS_CLIENT_SECRET &&
      process.env.QUICKBOOKS_REDIRECT_URI,
  );
}

export function quickBooksMode() {
  return hasQuickBooksEnv() ? "sandbox_oauth" : "export";
}

export function buildQuickBooksAuthUrl(state: string) {
  if (!hasQuickBooksEnv()) return null;

  const params = new URLSearchParams({
    client_id: process.env.QUICKBOOKS_CLIENT_ID!,
    response_type: "code",
    scope: "com.intuit.quickbooks.accounting",
    redirect_uri: process.env.QUICKBOOKS_REDIRECT_URI!,
    state,
  });

  return `${authBase}?${params.toString()}`;
}
