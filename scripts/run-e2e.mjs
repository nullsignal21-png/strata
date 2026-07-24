import { spawn, spawnSync } from "node:child_process";
import process from "node:process";

const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const localBaseUrl = /^http:\/\/(?:127\.0\.0\.1|localhost):3000$/.test(baseUrl);
const useExistingServer = process.env.PLAYWRIGHT_SKIP_WEBSERVER === "true";
const playwrightArgs = ["node_modules/@playwright/test/cli.js", "test", ...process.argv.slice(2)];
let server = null;

async function serverIsReady() {
  try {
    const response = await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(2_000) });
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForServer() {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (await serverIsReady()) return;
    if (server?.exitCode !== null) {
      throw new Error(`Next.js exited before becoming ready with code ${server?.exitCode}.`);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${baseUrl}/api/health.`);
}

async function stopServer() {
  if (!server?.pid || server.exitCode !== null) return;

  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"], { stdio: "ignore" });
    return;
  }

  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {
    server.kill("SIGTERM");
  }
  await Promise.race([
    new Promise((resolve) => server.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 5_000)),
  ]);
  if (server.exitCode === null) {
    try {
      process.kill(-server.pid, "SIGKILL");
    } catch {
      server.kill("SIGKILL");
    }
  }
}

let exitCode = 1;
try {
  if (localBaseUrl && !useExistingServer) {
    if (await serverIsReady()) {
      throw new Error(
        "Port 3000 already serves an application. Stop it or set PLAYWRIGHT_SKIP_WEBSERVER=true explicitly.",
      );
    }
    server = spawn(
      process.execPath,
      ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "-p", "3000"],
      {
        env: { ...process.env, PLAYWRIGHT_SKIP_WEBSERVER: "true" },
        stdio: "inherit",
        detached: process.platform !== "win32",
      },
    );
    await waitForServer();
  } else if (!(await serverIsReady())) {
    throw new Error(`No reachable application was found at ${baseUrl}.`);
  }

  const test = spawn(process.execPath, playwrightArgs, {
    env: { ...process.env, PLAYWRIGHT_SKIP_WEBSERVER: "true" },
    stdio: "inherit",
  });
  exitCode = await new Promise((resolve, reject) => {
    test.once("error", reject);
    test.once("exit", (code) => resolve(code ?? 1));
  });
} finally {
  await stopServer();
}

process.exit(exitCode);
