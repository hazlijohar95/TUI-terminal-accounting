import React from "react";
import { Box, Text } from "ink";
import { colors } from "../themes/colors.js";
import { getConversation } from "../../core/conversation.js";
import type { AgentStage } from "../../agent/stages.js";

type StatusBarProps = {
  currentStage?: AgentStage | null;
  model?: string;
  workspace?: string;
};

export function StatusBar({ currentStage, model = "gpt-4o-mini", workspace }: StatusBarProps) {
  const conversation = getConversation();
  const stats = conversation.getStats();

  const stageIndicator = currentStage
    ? getStageIndicator(currentStage)
    : { text: "Ready", color: colors.success };

  return (
    <Box
      borderStyle="single"
      borderColor={colors.border}
      paddingX={1}
      justifyContent="space-between"
    >
      <Box>
        <Text color={stageIndicator.color}>{stageIndicator.text}</Text>
        <Text color={colors.textDimmed}> │ </Text>
        <Text color={colors.textMuted}>
          {stats.messageCount} msgs
        </Text>
        <Text color={colors.textDimmed}> │ </Text>
        <Text color={colors.textMuted}>
          ~{stats.totalTokens} tokens
        </Text>
      </Box>

      <Box>
        {workspace && (
          <>
            <Text color={colors.textMuted}>{workspace}</Text>
            <Text color={colors.textDimmed}> │ </Text>
          </>
        )}
        <Text color={colors.primary}>{model}</Text>
      </Box>
    </Box>
  );
}

function getStageIndicator(stage: AgentStage): { text: string; color: string } {
  switch (stage) {
    case "planning":
      return { text: "🧠 Planning", color: "cyan" };
    case "actions":
      return { text: "⚡ Executing", color: "yellow" };
    case "validating":
      return { text: "✓ Validating", color: "magenta" };
    case "answering":
      return { text: "💬 Answering", color: "green" };
    case "complete":
      return { text: "✅ Complete", color: colors.success };
    case "error":
      return { text: "❌ Error", color: colors.error };
    default:
      return { text: "Ready", color: colors.success };
  }
}
