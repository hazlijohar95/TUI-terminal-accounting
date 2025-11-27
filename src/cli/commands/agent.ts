// Agent command for natural language queries
import * as p from "@clack/prompts";
import pc from "picocolors";
import OpenAI from "openai";
import type { ChatCompletionMessageParam, ChatCompletionMessageToolCall } from "openai/resources/chat/completions";
import "../types/global.js";
import { existsSync } from "fs";
import { getDatabaseContext, buildDatabaseContextString } from "../../agent/tools/db-queries.js";
import { SYSTEM_PROMPT_QUESTION } from "../../agent/prompts.js";
import { agentTools, executeTool } from "../../agent/agent-tools.js";
import { createDocument, listDocuments } from "../../domain/documents.js";
import { processDocument } from "../../agent/document-processor.js";
import {
  renderHeader,
  renderAgentMessageAnimated,
  renderSuggestions,
  getContextualSuggestions,
  getQuickActions,
  createSpinner,
} from "../chat-ui.js";

// Agentic system prompt
const AGENTIC_SYSTEM_PROMPT = `You are a proactive financial advisor and assistant for OpenAccounting.
You have access to tools that let you take real actions on behalf of the user.

When a user asks you to do something (create invoice, record payment, etc.), you should:
1. Use the appropriate tool to execute the action
2. Confirm what you did with specific details

When answering questions, be direct and specific with real numbers.
Always suggest actionable next steps.

Document handling:
- Users can upload receipts, bank statements, and other documents by providing a file path
- When a document is uploaded, use process_document to extract data
- Then use create_expense_from_document to create the expense entry
- For bank statements (CSV/Excel), the extracted data will contain multiple transactions

Important: You CAN and SHOULD use tools to help users. Don't just describe what they should do - actually do it for them when they ask.`;

// Check if input looks like a file path
function isFilePath(input: string): boolean {
  // Common file path patterns
  const pathPatterns = [
    /^\//, // Absolute path
    /^~\//, // Home directory
    /^\.\.?\//, // Relative path
    /\.(pdf|png|jpg|jpeg|gif|csv|xlsx|xls)$/i, // Has file extension
  ];
  return pathPatterns.some(p => p.test(input.trim()));
}

// Expand tilde in path
function expandPath(filePath: string): string {
  if (filePath.startsWith("~/")) {
    const home = process.env.HOME || process.env.USERPROFILE || "";
    return filePath.replace("~", home);
  }
  return filePath;
}

export async function askCommand(args: string[]): Promise<void> {
  const question = args.join(" ");

  if (!question) {
    // Interactive mode - prompt for question
    const input = await p.text({
      message: "What would you like to know?",
      placeholder: "e.g., How much am I owed? What's my cash flow?",
    });

    if (p.isCancel(input) || !input) {
      return;
    }

    return askCommand([(input as string)]);
  }

  // Check for API key
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    p.log.error("OpenAI API key not found");
    p.log.info("Set OPENAI_API_KEY in your environment or .env file");
    return;
  }

  const s = p.spinner();
  s.start("Thinking...");

  try {
    // Get database context
    const context = getDatabaseContext();
    const contextString = buildDatabaseContextString(context);

    // Call OpenAI
    const client = new OpenAI({ apiKey });

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT_QUESTION,
        },
        {
          role: "user",
          content: `## Your Business Data\n${contextString}\n\n## Question\n${question}`,
        },
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    s.stop("Done");

    const answer = response.choices[0]?.message?.content || "No response generated.";

    // Display the answer in a nice box
    console.log();
    p.note(answer, pc.cyan("Agent"));

  } catch (err) {
    s.stop("Error");
    p.log.error((err as Error).message);
  }
}

// Chat mode - conversational interface with the agent
export async function chatCommand(): Promise<void> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    p.log.error("OpenAI API key not found");
    return;
  }

  console.clear();
  renderHeader();

  const client = new OpenAI({ apiKey });

  // Get initial context
  const context = getDatabaseContext();
  const contextString = buildDatabaseContextString(context);

  // Conversation history with proper typing for tool calls
  const messages: ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: AGENTIC_SYSTEM_PROMPT + `\n\n## Current Business Data\n${contextString}`,
    },
    {
      role: "user",
      content: "Give a brief greeting (1 sentence) and the most important insight about my finances (1-2 sentences).",
    },
  ];

  // Animated loading
  const spinner = createSpinner("Analyzing your data...");
  spinner.start();

  const greeting = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: messages,
    temperature: 0.7,
    max_tokens: 300,
  });

  spinner.stop();

  const initialResponse = greeting.choices[0]?.message?.content || "How can I help you today?";
  messages.push({ role: "assistant", content: initialResponse });

  // Show initial response with animation
  await renderAgentMessageAnimated(initialResponse);

  // Show contextual suggestions
  const suggestions = getContextualSuggestions(context);
  renderSuggestions(suggestions);

  let lastResponse = initialResponse;

  // Use raw stdin to avoid readline conflicts
  const stdin = process.stdin;
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding('utf8');

  let inputBuffer = '';
  let isProcessing = false;

  const showPrompt = () => {
    process.stdout.write(pc.bold(pc.green("\n  ❯ ")));
  };

  showPrompt();

  const cleanup = () => {
    stdin.setRawMode(false);
    stdin.removeAllListeners('data');
  };

  stdin.on('data', async (key: string) => {
    // Ctrl+C
    if (key === '\u0003') {
      cleanup();
      console.log();
      console.log(pc.dim("  👋 See you later!"));
      console.log();
      return;
    }

    // Enter key
    if (key === '\r' || key === '\n') {
      console.log(); // New line after input

      const trimmed = inputBuffer.trim();
      inputBuffer = '';

      if (!trimmed) {
        showPrompt();
        return;
      }

      if (trimmed === "exit" || trimmed === "quit" || trimmed === "back") {
        cleanup();
        console.log(pc.dim("  👋 See you later!"));
        console.log();
        return;
      }

      // Check for quick action shortcuts
      const quickActions = getQuickActions(lastResponse);
      const quickAction = quickActions.find(a => a.key === trimmed);
      if (quickAction) {
        cleanup();
        console.log(pc.dim(`  → ${quickAction.command}`));
        globalThis.__nextCommand = quickAction.command;
        return;
      }

      if (isProcessing) return;
      isProcessing = true;

      // Check if input is a file path (document upload)
      if (isFilePath(trimmed)) {
        const filePath = expandPath(trimmed);

        if (!existsSync(filePath)) {
          console.log(pc.red(`  File not found: ${filePath}`));
          isProcessing = false;
          showPrompt();
          return;
        }

        // Upload and process document
        const uploadSpinner = createSpinner("Uploading document...");
        uploadSpinner.start();

        try {
          const doc = createDocument({ source_path: filePath });
          uploadSpinner.stop();
          console.log(pc.green(`  ✓ Uploaded: ${doc.original_name}`));

          // Process immediately
          const processSpinner = createSpinner("Extracting data...");
          processSpinner.start();

          const extracted = await processDocument(doc, apiKey);
          processSpinner.stop();

          if (extracted) {
            console.log(pc.green(`  ✓ Extracted data from document`));

            // Tell the agent about the upload
            const uploadMessage = `I just uploaded a document: ${doc.original_name} (ID: ${doc.id}). ` +
              `The extracted data shows: ${JSON.stringify(extracted)}. ` +
              `Please help me create an expense entry from this.`;

            messages.push({ role: "user", content: uploadMessage });
          } else {
            console.log(pc.yellow(`  ⚠ Could not extract data automatically`));
            messages.push({
              role: "user",
              content: `I uploaded a document: ${doc.original_name} (ID: ${doc.id}), but automatic extraction failed. Can you help process it?`
            });
          }
        } catch (err) {
          uploadSpinner.stop();
          console.log(pc.red(`  ✗ Upload failed: ${(err as Error).message}`));
          isProcessing = false;
          showPrompt();
          return;
        }
      } else {
        // Regular user message
        messages.push({ role: "user", content: trimmed });
      }

      // Animated thinking
      const thinkingSpinner = createSpinner("Thinking...");
      thinkingSpinner.start();

      try {
        // Call with tools
        let response = await client.chat.completions.create({
          model: "gpt-4o-mini",
          messages: messages,
          tools: agentTools,
          tool_choice: "auto",
          temperature: 0.7,
          max_tokens: 800,
        });

        thinkingSpinner.stop();

        let assistantMessage = response.choices[0]?.message;

        // Handle tool calls
        while (assistantMessage?.tool_calls && assistantMessage.tool_calls.length > 0) {
          // Add assistant message with tool calls
          messages.push(assistantMessage);

          // Execute each tool
          for (const toolCall of assistantMessage.tool_calls) {
            if (toolCall.type !== "function") continue;
            const toolName = toolCall.function.name;
            const toolArgs = JSON.parse(toolCall.function.arguments);

            // Show what's being executed
            console.log();
            console.log(pc.yellow(`  ⚡ Executing: ${toolName}`));

            const result = await executeTool(toolName, toolArgs);

            // Show result
            if (result.success) {
              console.log(pc.green(`  ✓ ${result.result}`));
            } else {
              console.log(pc.red(`  ✗ ${result.result}`));
            }

            // Add tool result to messages
            messages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: result.result,
            });
          }

          // Get follow-up response
          const followUpSpinner = createSpinner("Processing...");
          followUpSpinner.start();

          response = await client.chat.completions.create({
            model: "gpt-4o-mini",
            messages: messages,
            tools: agentTools,
            tool_choice: "auto",
            temperature: 0.7,
            max_tokens: 500,
          });

          followUpSpinner.stop();
          assistantMessage = response.choices[0]?.message;
        }

        // Display final response
        const answer = assistantMessage?.content || "Done!";
        printAgentBox(answer);

        messages.push({ role: "assistant", content: answer });
        lastResponse = answer;

        // Show quick actions based on response
        const actions = getQuickActions(answer);
        if (actions.length > 0) {
          console.log();
          console.log(pc.dim("  Quick actions:"));
          for (const action of actions) {
            console.log(`  ${pc.cyan(`[${action.key}]`)} ${pc.dim(action.label)}`);
          }
        }

      } catch (err) {
        thinkingSpinner.stop();
        console.log();
        console.log(pc.red("  ✗ Error: ") + (err as Error).message);
      }

      isProcessing = false;
      showPrompt();
      return;
    }

    // Backspace
    if (key === '\u007F' || key === '\b') {
      if (inputBuffer.length > 0) {
        inputBuffer = inputBuffer.slice(0, -1);
        process.stdout.write('\b \b');
      }
      return;
    }

    // Regular character - echo and buffer
    if (!isProcessing && key.length === 1 && key.charCodeAt(0) >= 32) {
      inputBuffer += key;
      process.stdout.write(key);
    }
  });

  // Wait indefinitely until cleanup is called
  return new Promise<void>((resolve) => {
    const checkInterval = setInterval(() => {
      if (!stdin.listenerCount('data')) {
        clearInterval(checkInterval);
        resolve();
      }
    }, 100);
  });
}

// Helper to print agent response in a box
function printAgentBox(text: string): void {
  const width = 56;
  const lines = wrapText(text, width - 4).split('\n');

  console.log();
  console.log(pc.cyan("  ┌─ Agent ") + pc.cyan("─".repeat(width - 11)) + pc.cyan("┐"));
  for (const line of lines) {
    const padding = width - 4 - line.length;
    console.log(pc.cyan("  │ ") + line + " ".repeat(Math.max(0, padding)) + pc.cyan(" │"));
  }
  console.log(pc.cyan("  └") + pc.cyan("─".repeat(width - 2)) + pc.cyan("┘"));
}

// Helper to wrap text
function wrapText(text: string, width: number): string {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if (currentLine.length + word.length + 1 <= width) {
      currentLine += (currentLine ? ' ' : '') + word;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);

  return lines.join('\n');
}
