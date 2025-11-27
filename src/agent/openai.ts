import OpenAI from "openai";
import {
  SYSTEM_PROMPT_QUESTION,
  SYSTEM_PROMPT_PROPOSE,
  buildContextFromLedger,
} from "./prompts.js";
import { getLedgerSnapshot, type LedgerEntry } from "./tools.js";
import { validateApiKey } from "../core/workspace.js";
import { agentLogger } from "../core/logger.js";

function getClient(): OpenAI {
  const apiKey = validateApiKey(process.env.OPENAI_API_KEY);
  agentLogger.debug("OpenAI client initialized");
  return new OpenAI({ apiKey });
}

export async function askQuestion(
  question: string,
  ledgerPath: string
): Promise<string> {
  agentLogger.info({ question: question.substring(0, 50) }, "Processing question");
  const client = getClient();

  // Get ledger data for context
  let entries: LedgerEntry[] = [];
  try {
    entries = getLedgerSnapshot(ledgerPath);
    agentLogger.debug({ entryCount: entries.length }, "Loaded ledger entries");
  } catch (err) {
    agentLogger.warn({ err }, "Failed to load ledger");
  }

  const context = buildContextFromLedger(entries);

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: SYSTEM_PROMPT_QUESTION,
      },
      {
        role: "user",
        content: `## User's Ledger Data\n${context}\n\n## Question\n${question}`,
      },
    ],
    temperature: 0.7,
    max_tokens: 1000,
  });

  agentLogger.info("Question answered successfully");
  return response.choices[0]?.message?.content || "No response from AI.";
}

export async function proposePostings(
  instruction: string,
  ledgerPath: string
): Promise<string> {
  agentLogger.info({ instruction: instruction.substring(0, 50) }, "Processing proposal");
  const client = getClient();

  // Get ledger data for context
  let entries: LedgerEntry[] = [];
  try {
    entries = getLedgerSnapshot(ledgerPath);
    agentLogger.debug({ entryCount: entries.length }, "Loaded ledger entries");
  } catch (err) {
    agentLogger.warn({ err }, "Failed to load ledger");
  }

  const context = buildContextFromLedger(entries);

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: SYSTEM_PROMPT_PROPOSE,
      },
      {
        role: "user",
        content: `## Current Ledger Context\n${context}\n\n## Instruction\n${instruction}`,
      },
    ],
    temperature: 0.3,
    max_tokens: 1500,
  });

  agentLogger.info("Proposal generated successfully");
  return response.choices[0]?.message?.content || "No response from AI.";
}
