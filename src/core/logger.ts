import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";

export const logger = pino({
  level: process.env.LOG_LEVEL || (isDev ? "debug" : "info"),
  transport: isDev
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "HH:MM:ss",
          ignore: "pid,hostname",
        },
      }
    : undefined,
});

// Create child loggers for different modules
export const cliLogger = logger.child({ module: "cli" });
export const agentLogger = logger.child({ module: "agent" });
export const parserLogger = logger.child({ module: "parser" });
