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

  // Get API key from environment
  getApiKey: (): string | undefined => {
    return process.env.OPENAI_API_KEY;
  },

  // Validate API key exists
  validateApiKey: (): boolean => {
    const key = process.env.OPENAI_API_KEY;
    return Boolean(key && key.length > 0);
  },

  // Get error message for missing API key
  getApiKeyError: (): string => {
    return "OpenAI API key not configured. Run: oa config set api_key <your-key>";
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
