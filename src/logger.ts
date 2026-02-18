/**
 * Structured logging via pino.
 *
 * Log level is configurable through the LOG_LEVEL environment variable.
 * Defaults to "info".
 */
import pino from "pino";

const level = process.env.LOG_LEVEL ?? "info";

const logger = pino({
  level,
  transport:
    process.env.NODE_ENV !== "test"
      ? { target: "pino-pretty", options: { colorize: true } }
      : undefined,
});

export default logger;
