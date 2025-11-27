import React, { useState, useEffect, useRef } from "react";
import { Box, Text, useApp, useInput } from "ink";
import Spinner from "ink-spinner";
import { Input } from "./components/Input.js";
import { Markdown } from "./components/Markdown.js";
import { Welcome } from "./components/Welcome.js";
import { Suggestions, generateSuggestions } from "./components/Suggestions.js";
import { colors } from "./themes/colors.js";
import { runStreamingAgent } from "../agent/streaming.js";
import { loadWorkspaceConfig } from "../core/workspace.js";
import { listWorkspaceFiles } from "../core/files.js";
import { getConversation } from "../core/conversation.js";
import { getCommandRegistry, type CommandContext } from "../core/commands.js";
import { STAGE_CONFIG, type AgentStage, type StageEvent } from "../agent/stages.js";
import { useInputHistory } from "./hooks/useInputHistory.js";
import { parseAnyLedgerFormat } from "../core/ledger-parser.js";
import { ensureWorkspace } from "../cli/commands/init.js";
import { getDashboardData } from "../cli/commands/dashboard.js";

export function App() {
  const { exit } = useApp();
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [outputType, setOutputType] = useState<"info" | "success" | "error" | "warning">("info");
  const [isLoading, setIsLoading] = useState(false);
  const [files, setFiles] = useState<string[]>([]);
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [currentStage, setCurrentStage] = useState<AgentStage | null>(null);
  const [stageMessage, setStageMessage] = useState("");
  const [streamingText, setStreamingText] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [transactionCount, setTransactionCount] = useState(0);
  const [ledgerPath, setLedgerPath] = useState("");
  const [showWelcome, setShowWelcome] = useState(true);
  const [isCancelled, setIsCancelled] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [lastQuestion, setLastQuestion] = useState("");

  const commandRegistry = getCommandRegistry();
  const { addToHistory, navigateUp, navigateDown, resetNavigation } = useInputHistory();

  // Timer for elapsed time during loading
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Load workspace on mount with auto-init
  useEffect(() => {
    const initializeWorkspace = async () => {
      try {
        // Auto-initialize if needed
        const wasInitialized = await ensureWorkspace();

        const workspace = loadWorkspaceConfig();
        setWorkspaceName(workspace.name);
        setLedgerPath(workspace.ledger.path);

        const workspaceFiles = listWorkspaceFiles();
        setFiles(workspaceFiles);

        // Count transactions and show proactive insights
        try {
          const entries = parseAnyLedgerFormat(workspace.ledger.path);
          setTransactionCount(entries.length);

          // Show proactive insights on startup
          if (entries.length > 0) {
            const data = getDashboardData();
            const insights: string[] = [];

            if (wasInitialized) {
              insights.push("**Welcome!** I've set up your workspace with sample data.\n");
            }

            // Key financial insight
            const savingsRate = data.income > 0 ? Math.round(((data.income - data.expenses) / data.income) * 100) : 0;
            if (data.net >= 0) {
              insights.push(`**This Month:** You're saving $${data.net.toFixed(0)} (${savingsRate}% of income)`);
            } else {
              insights.push(`**Alert:** Spending exceeds income by $${Math.abs(data.net).toFixed(0)}`);
            }

            // Top expense
            if (data.topCategories.length > 0) {
              const top = data.topCategories[0];
              insights.push(`**Top Expense:** ${top.name} at $${top.amount.toFixed(0)} (${top.percentage}%)`);
            }

            // Any alerts
            if (data.alerts.length > 0) {
              insights.push(`\n${data.alerts[0]}`);
            }

            insights.push("\n*Ask me anything about your finances, or try /help for commands*");

            setOutput(insights.join("\n"));
            setOutputType("info");
            setShowWelcome(false);
          }
        } catch {
          setTransactionCount(0);
        }
      } catch {
        setFiles([]);
      }
    };

    initializeWorkspace();
  }, []);

  // Handle elapsed time
  useEffect(() => {
    if (isLoading) {
      setElapsedTime(0);
      timerRef.current = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isLoading]);

  // Handle special keyboard shortcuts only when NOT typing
  useInput((_char, key) => {
    // Only handle special keys, let TextInput handle everything else
    if (key.escape && isLoading) {
      setIsCancelled(true);
      setIsLoading(false);
      setOutput("Operation cancelled.");
      setOutputType("warning");
    }
  }, { isActive: isLoading }); // Only active when loading

  const handleStageChange = (event: StageEvent) => {
    if (isCancelled) return;
    setCurrentStage(event.stage);
    setStageMessage(event.message);
  };

  const handleToken = (token: string) => {
    if (isCancelled) return;
    setStreamingText(prev => prev + token);
  };

  // Command context for slash commands
  const commandContext: CommandContext = {
    setOutput: (content, type = "info") => {
      setOutput(content);
      setOutputType(type);
      setShowWelcome(false);
    },
    exit,
    clearScreen: () => {
      setOutput("");
      setStreamingText("");
      setShowWelcome(false);
    },
  };

  const handleSubmit = async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;

    setInput("");
    setShowWelcome(false);
    addToHistory(trimmed);
    resetNavigation();
    setSuggestions([]);

    // Handle special commands (with or without slash)
    const lower = trimmed.toLowerCase();

    // Quick commands
    if (lower === "help" || lower === "/help") {
      setOutput(`**How to use OpenAccounting**

Just type what you want to know:
• "How am I doing this month?"
• "Show my top expenses"
• "Compare food spending to last month"

**Quick actions:**
• \`add coffee 5.50\` - Add an expense
• \`dashboard\` - See your financial summary
• \`clear\` - Clear screen
• \`quit\` - Exit

**Keyboard:**
• \`↑/↓\` - Previous questions
• \`Esc\` - Cancel`);
      setOutputType("info");
      return;
    }

    if (lower === "quit" || lower === "exit" || lower === "/quit") {
      exit();
      return;
    }

    if (lower === "clear" || lower === "/clear") {
      setOutput("");
      setStreamingText("");
      return;
    }

    if (lower === "dashboard" || lower === "/dashboard" || lower === "show dashboard") {
      const handled = await commandRegistry.execute("/dashboard", commandContext);
      if (handled) return;
    }

    // Handle "add" command
    if (lower.startsWith("add ")) {
      const handled = await commandRegistry.execute("/" + trimmed, commandContext);
      if (handled) return;
    }

    setIsLoading(true);
    setStreamingText("");
    setCurrentStage(null);
    setIsCancelled(false);
    setLastQuestion(trimmed);

    try {
      const workspace = loadWorkspaceConfig();

      // Everything else is a question to the AI
      await runStreamingAgent({
        input: trimmed,
        kind: "question",
        ledgerPath: workspace.ledger.path,
        onStageChange: handleStageChange,
        onToken: handleToken,
        onComplete: (fullResponse) => {
          if (!isCancelled) {
            setOutput(fullResponse);
            setOutputType("success");
            // Generate smart suggestions
            const newSuggestions = generateSuggestions(fullResponse, trimmed);
            setSuggestions(newSuggestions);
          }
        },
      });
    } catch (err) {
      if (!isCancelled) {
        setOutput((err as Error).message);
        setOutputType("error");
      }
    } finally {
      setIsLoading(false);
      setCurrentStage(null);
      setStreamingText("");
    }
  };

  // Get stage display info
  const getStageDisplay = () => {
    if (!currentStage) return { label: "Processing", color: colors.primary };
    const config = STAGE_CONFIG[currentStage];
    return {
      label: `${config.emoji} ${config.label}`,
      color: config.color,
    };
  };

  const stageDisplay = getStageDisplay();

  return (
    <Box flexDirection="column" padding={1}>
      {/* Minimal header */}
      <Box marginBottom={1}>
        <Text bold color={colors.primary}>Open</Text>
        <Text bold color={colors.secondary}>Accounting</Text>
        {workspaceName && (
          <>
            <Text color={colors.textDimmed}> • </Text>
            <Text color={colors.success}>●</Text>
            <Text color={colors.textMuted}> {workspaceName}</Text>
          </>
        )}
      </Box>

      {/* Main content area */}
      <Box
        borderStyle="round"
        borderColor={isLoading ? colors.primary : colors.border}
        padding={1}
        flexDirection="column"
        minHeight={12}
      >
        {isLoading ? (
          <Box flexDirection="column">
            <Box>
              <Text color={stageDisplay.color}>
                <Spinner type="dots" />
              </Text>
              <Text color={stageDisplay.color}> {stageDisplay.label}</Text>
              {elapsedTime > 0 && (
                <Text color={colors.textDimmed}> ({elapsedTime}s)</Text>
              )}
            </Box>
            {streamingText && (
              <Box marginTop={1}>
                <Markdown content={streamingText} />
              </Box>
            )}
          </Box>
        ) : showWelcome && !output ? (
          <Welcome
            workspaceName={workspaceName}
            transactionCount={transactionCount}
          />
        ) : output ? (
          <Box flexDirection="column">
            <Markdown content={output} />
            {suggestions.length > 0 && (
              <Suggestions suggestions={suggestions} />
            )}
          </Box>
        ) : (
          <Text color={colors.textDimmed}>
            Ask me anything about your finances...
          </Text>
        )}
      </Box>

      {/* Input bar */}
      <Box marginTop={1}>
        <Input
          value={input}
          onChange={setInput}
          onSubmit={handleSubmit}
        />
      </Box>

      {/* Minimal footer */}
      <Box marginTop={1} justifyContent="space-between">
        <Text color={colors.textDimmed}>
          ↑/↓ history • Esc cancel • help
        </Text>
      </Box>
    </Box>
  );
}
