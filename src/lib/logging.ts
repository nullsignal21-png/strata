type LogLevel = "info" | "warn" | "error";

type LogContext = Record<string, string | number | boolean | null | undefined>;

function write(level: LogLevel, event: string, context: LogContext = {}) {
  const payload = {
    level,
    event,
    at: new Date().toISOString(),
    ...context,
  };

  const line = JSON.stringify(payload);
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.info(line);
  }
}

export const logger = {
  info: (event: string, context?: LogContext) => write("info", event, context),
  warn: (event: string, context?: LogContext) => write("warn", event, context),
  error: (event: string, context?: LogContext) => write("error", event, context),
};
