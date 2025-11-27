// Central configuration for OpenAccounting
import { homedir } from "os";
import { join } from "path";

// Application directories
export const paths = {
  home: join(homedir(), ".openaccounting"),
  database: join(homedir(), ".openaccounting", "openaccounting.db"),
  documents: join(homedir(), ".openaccounting", "documents"),
  backups: join(homedir(), ".openaccounting", "backups"),
};

// AI Configuration
export const ai = {
  // Model for general chat and tool calls
  chatModel: "gpt-4o-mini",

  // Model for document/image analysis (Vision)
  visionModel: "gpt-4o-mini",

  // Model for complex analysis (use gpt-4o for better accuracy if needed)
  analysisModel: "gpt-4o-mini",

  // Default parameters
  maxTokens: 500,
  temperature: 0.7,

  // Get API key from environment or database setting
  getApiKey: (): string | undefined => {
    // First check environment variable
    if (process.env.OPENAI_API_KEY) {
      return process.env.OPENAI_API_KEY;
    }
    // Then check database setting (lazy import to avoid circular deps)
    try {
      const { getSetting } = require("./db/index.js");
      const dbKey = getSetting("openai_api_key");
      if (dbKey) return dbKey;
    } catch {
      // Database not initialized yet
    }
    return undefined;
  },

  // Validate API key exists
  validateApiKey: (): boolean => {
    const key = ai.getApiKey();
    return Boolean(key && key.startsWith("sk-"));
  },

  // Get error message for missing API key
  getApiKeyError: (): string => {
    return "OpenAI API key not configured. Set it in Settings (press 's') or create a .env file with OPENAI_API_KEY=sk-...";
  },
};

// Application settings
export const app = {
  name: "OpenAccounting",
  version: "0.2.0",

  // Default pagination limits
  defaultLimit: 100,

  // Date format
  dateFormat: "YYYY-MM-DD",
};

// Export everything for convenience
export default {
  paths,
  ai,
  app,
};
