import { getConversation, resetConversation } from "./conversation.js";
import { cliLogger } from "./logger.js";
import { getDashboardString } from "../cli/commands/dashboard.js";
import { quickAdd } from "../cli/commands/add.js";

export type CommandContext = {
  setOutput: (content: string, type?: "info" | "success" | "error" | "warning") => void;
  exit: () => void;
  clearScreen: () => void;
};

export type Command = {
  name: string;
  aliases: string[];
  description: string;
  usage: string;
  execute: (args: string[], context: CommandContext) => Promise<void> | void;
};

export class CommandRegistry {
  private commands: Map<string, Command> = new Map();

  register(command: Command): void {
    this.commands.set(command.name, command);
    for (const alias of command.aliases) {
      this.commands.set(alias, command);
    }
    cliLogger.debug({ name: command.name, aliases: command.aliases }, "Command registered");
  }

  get(name: string): Command | undefined {
    return this.commands.get(name.toLowerCase());
  }

  getAll(): Command[] {
    // Return unique commands (no aliases)
    const seen = new Set<string>();
    const commands: Command[] = [];
    for (const cmd of this.commands.values()) {
      if (!seen.has(cmd.name)) {
        seen.add(cmd.name);
        commands.push(cmd);
      }
    }
    return commands.sort((a, b) => a.name.localeCompare(b.name));
  }

  async execute(input: string, context: CommandContext): Promise<boolean> {
    if (!input.startsWith("/")) {
      return false;
    }

    const parts = input.slice(1).split(" ");
    const commandName = parts[0].toLowerCase();
    const args = parts.slice(1);

    const command = this.get(commandName);
    if (!command) {
      context.setOutput(`Unknown command: /${commandName}\nType /help for available commands.`, "error");
      return true;
    }

    try {
      await command.execute(args, context);
    } catch (err) {
      context.setOutput(`Command error: ${(err as Error).message}`, "error");
      cliLogger.error({ err, command: commandName }, "Command execution failed");
    }

    return true;
  }
}

// Create and populate default registry
export function createDefaultRegistry(): CommandRegistry {
  const registry = new CommandRegistry();

  // Help command
  registry.register({
    name: "help",
    aliases: ["h", "?"],
    description: "Show all available commands",
    usage: "/help [command]",
    execute: (args, context) => {
      if (args.length > 0) {
        const cmd = registry.get(args[0]);
        if (cmd) {
          context.setOutput(
            `Command: /${cmd.name}\n` +
            `Aliases: ${cmd.aliases.length > 0 ? cmd.aliases.map(a => "/" + a).join(", ") : "none"}\n` +
            `Description: ${cmd.description}\n` +
            `Usage: ${cmd.usage}`,
            "info"
          );
          return;
        }
      }

      const commands = registry.getAll();
      const helpText = commands
        .map(cmd => `  /${cmd.name.padEnd(12)} ${cmd.description}`)
        .join("\n");

      context.setOutput(
        `Available Commands:\n\n${helpText}\n\nType /help <command> for more details.`,
        "info"
      );
    },
  });

  // Clear command
  registry.register({
    name: "clear",
    aliases: ["cls", "c"],
    description: "Clear the output screen",
    usage: "/clear",
    execute: (_args, context) => {
      context.clearScreen();
      context.setOutput("Screen cleared.", "info");
    },
  });

  // History command
  registry.register({
    name: "history",
    aliases: ["hist"],
    description: "Show conversation history",
    usage: "/history [count]",
    execute: (args, context) => {
      const conversation = getConversation();
      const count = args[0] ? parseInt(args[0], 10) : 10;
      const messages = conversation.getRecentMessages(count);

      if (messages.length === 0) {
        context.setOutput("No conversation history yet.", "info");
        return;
      }

      const history = messages
        .map(m => {
          const time = m.timestamp.toLocaleTimeString();
          const role = m.role === "user" ? "You" : "Assistant";
          const preview = m.content.length > 80
            ? m.content.substring(0, 80) + "..."
            : m.content;
          return `[${time}] ${role}: ${preview}`;
        })
        .join("\n");

      context.setOutput(`Recent History (${messages.length} messages):\n\n${history}`, "info");
    },
  });

  // Reset command
  registry.register({
    name: "reset",
    aliases: ["new"],
    description: "Clear conversation memory and start fresh",
    usage: "/reset",
    execute: (_args, context) => {
      resetConversation();
      context.setOutput("Conversation memory cleared. Starting fresh.", "success");
    },
  });

  // Stats command
  registry.register({
    name: "stats",
    aliases: ["info"],
    description: "Show conversation statistics",
    usage: "/stats",
    execute: (_args, context) => {
      const conversation = getConversation();
      const stats = conversation.getStats();
      const duration = Math.round((Date.now() - stats.startTime.getTime()) / 1000 / 60);

      context.setOutput(
        `Conversation Stats:\n\n` +
        `  Messages: ${stats.messageCount}\n` +
        `  User: ${stats.userMessages}\n` +
        `  Assistant: ${stats.assistantMessages}\n` +
        `  Est. Tokens: ${stats.totalTokens}\n` +
        `  Duration: ${duration} min\n` +
        `  Last Activity: ${stats.lastActivity.toLocaleTimeString()}`,
        "info"
      );
    },
  });

  // Export command
  registry.register({
    name: "export",
    aliases: ["save"],
    description: "Export conversation to JSON",
    usage: "/export",
    execute: (_args, context) => {
      const conversation = getConversation();
      const exported = conversation.export();
      context.setOutput(
        `Conversation exported:\n\n${exported.substring(0, 500)}${exported.length > 500 ? "..." : ""}`,
        "success"
      );
    },
  });

  // Search command
  registry.register({
    name: "search",
    aliases: ["find"],
    description: "Search conversation history",
    usage: "/search <query>",
    execute: (args, context) => {
      if (args.length === 0) {
        context.setOutput("Usage: /search <query>", "error");
        return;
      }

      const query = args.join(" ");
      const conversation = getConversation();
      const results = conversation.search(query);

      if (results.length === 0) {
        context.setOutput(`No results found for "${query}"`, "info");
        return;
      }

      const output = results
        .slice(0, 5)
        .map(m => {
          const preview = m.content.length > 100
            ? m.content.substring(0, 100) + "..."
            : m.content;
          return `[${m.role}] ${preview}`;
        })
        .join("\n\n");

      context.setOutput(`Found ${results.length} results for "${query}":\n\n${output}`, "success");
    },
  });

  // Tools command
  registry.register({
    name: "tools",
    aliases: ["t"],
    description: "List available agent tools",
    usage: "/tools",
    execute: (_args, context) => {
      const tools = [
        "search_entries    - Search ledger entries",
        "calculate_totals  - Calculate account totals",
        "analyze_patterns  - Analyze spending patterns",
        "read_file         - Read file contents",
        "write_file        - Write to file",
        "edit_file         - Edit file with search/replace",
        "import_csv        - Import bank CSV",
        "create_tx         - Create transaction",
        "update_tx         - Update transaction",
        "delete_tx         - Delete transaction",
      ];

      context.setOutput(`Available Agent Tools:\n\n  ${tools.join("\n  ")}`, "info");
    },
  });

  // Dashboard command
  registry.register({
    name: "dashboard",
    aliases: ["dash", "d"],
    description: "Show financial dashboard",
    usage: "/dashboard [month]",
    execute: (args, context) => {
      const month = args[0];
      try {
        const dashboard = getDashboardString(month);
        context.setOutput(dashboard, "info");
      } catch (err) {
        context.setOutput(`Dashboard error: ${(err as Error).message}`, "error");
      }
    },
  });

  // Add transaction command
  registry.register({
    name: "add",
    aliases: ["a"],
    description: "Quick add a transaction",
    usage: "/add <description> <amount>",
    execute: (args, context) => {
      if (args.length < 2) {
        context.setOutput("Usage: /add <description> <amount>\nExample: /add coffee 5.50", "error");
        return;
      }

      const input = args.join(" ");
      const result = quickAdd(input);

      if (result.success) {
        context.setOutput(result.message, "success");
      } else {
        context.setOutput(result.message, "error");
      }
    },
  });

  // Quit command
  registry.register({
    name: "quit",
    aliases: ["exit", "q"],
    description: "Exit the application",
    usage: "/quit",
    execute: (_args, context) => {
      context.exit();
    },
  });

  return registry;
}

// Global registry instance
let globalRegistry: CommandRegistry | null = null;

export function getCommandRegistry(): CommandRegistry {
  if (!globalRegistry) {
    globalRegistry = createDefaultRegistry();
  }
  return globalRegistry;
}
