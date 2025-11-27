import React, { useState, useEffect } from "react";
import { Box, Text, useApp, useInput, useStdout } from "ink";
import { StatusBar } from "./components/StatusBar.js";
import { Dashboard } from "./components/Dashboard.js";
import { ChatView } from "./components/ChatView.js";
import { CommandBar } from "./components/CommandBar.js";
import { InvoiceList } from "./components/InvoiceList.js";
import { ReportView } from "./components/ReportView.js";
import { LHDNSettingsView } from "./components/LHDNSettingsView.js";
import { getSetting } from "../db/index.js";

export type View = "dashboard" | "chat" | "invoices" | "customers" | "reports" | "help" | "lhdn";

interface AppProps {
  initialView?: View;
}

export function App({ initialView = "dashboard" }: AppProps) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [currentView, setCurrentView] = useState<View>(initialView);
  const [commandMode, setCommandMode] = useState(false);
  const [dimensions, setDimensions] = useState({
    width: stdout?.columns || 80,
    height: stdout?.rows || 24,
  });

  // Handle terminal resize
  useEffect(() => {
    const handleResize = () => {
      if (stdout) {
        setDimensions({
          width: stdout.columns,
          height: stdout.rows,
        });
      }
    };

    stdout?.on("resize", handleResize);
    return () => {
      stdout?.off("resize", handleResize);
    };
  }, [stdout]);

  // Global keyboard shortcuts
  useInput((input, key) => {
    if (commandMode) return;

    // Escape to exit or go back
    if (key.escape) {
      if (currentView !== "dashboard") {
        setCurrentView("dashboard");
      } else {
        exit();
      }
      return;
    }

    // Ctrl+C to exit
    if (input === "c" && key.ctrl) {
      exit();
      return;
    }

    // Colon to enter command mode
    if (input === ":") {
      setCommandMode(true);
      return;
    }

    // Quick navigation shortcuts
    if (input === "d") setCurrentView("dashboard");
    if (input === "c") setCurrentView("chat");
    if (input === "i") setCurrentView("invoices");
    if (input === "r") setCurrentView("reports");
    if (input === "l") setCurrentView("lhdn");
    if (input === "?") setCurrentView("help");
    if (input === "q") exit();
  });

  const handleCommand = (command: string) => {
    setCommandMode(false);

    const parts = command.trim().split(/\s+/);
    const cmd = parts[0]?.toLowerCase();

    switch (cmd) {
      case "q":
      case "quit":
      case "exit":
        exit();
        break;
      case "dashboard":
      case "dash":
      case "d":
        setCurrentView("dashboard");
        break;
      case "chat":
      case "c":
        setCurrentView("chat");
        break;
      case "invoices":
      case "inv":
      case "i":
        setCurrentView("invoices");
        break;
      case "reports":
      case "rep":
      case "r":
        setCurrentView("reports");
        break;
      case "help":
      case "?":
        setCurrentView("help");
        break;
      case "lhdn":
      case "einvoice":
      case "l":
        setCurrentView("lhdn");
        break;
    }
  };

  const businessName = getSetting("business_name") || "OpenAccounting";

  // Calculate content height (total - status bar - command bar)
  const contentHeight = dimensions.height - 3;

  return (
    <Box
      flexDirection="column"
      width={dimensions.width}
      height={dimensions.height}
    >
      {/* Status Bar */}
      <StatusBar
        businessName={businessName}
        currentView={currentView}
        width={dimensions.width}
      />

      {/* Main Content */}
      <Box flexGrow={1} height={contentHeight}>
        {currentView === "dashboard" && (
          <Dashboard width={dimensions.width} height={contentHeight} />
        )}
        {currentView === "chat" && (
          <ChatView width={dimensions.width} height={contentHeight} />
        )}
        {currentView === "invoices" && (
          <InvoiceList width={dimensions.width} height={contentHeight} />
        )}
        {currentView === "reports" && (
          <ReportView width={dimensions.width} height={contentHeight} />
        )}
        {currentView === "lhdn" && (
          <LHDNSettingsView width={dimensions.width} height={contentHeight} />
        )}
        {currentView === "help" && (
          <HelpView width={dimensions.width} height={contentHeight} />
        )}
      </Box>

      {/* Command Bar */}
      <CommandBar
        active={commandMode}
        onSubmit={handleCommand}
        onCancel={() => setCommandMode(false)}
        width={dimensions.width}
      />
    </Box>
  );
}

// Help view component
function HelpView({ width, height }: { width: number; height: number }) {
  return (
    <Box
      flexDirection="column"
      padding={1}
      width={width}
      height={height}
    >
      <Text bold color="cyan">Keyboard Shortcuts</Text>
      <Text> </Text>
      <Text><Text bold>d</Text> - Dashboard</Text>
      <Text><Text bold>c</Text> - Chat with AI</Text>
      <Text><Text bold>i</Text> - Invoices</Text>
      <Text><Text bold>r</Text> - Reports</Text>
      <Text><Text bold>l</Text> - LHDN e-Invoice Settings</Text>
      <Text><Text bold>?</Text> - Help</Text>
      <Text><Text bold>:</Text> - Command mode</Text>
      <Text><Text bold>q</Text> - Quit</Text>
      <Text><Text bold>Esc</Text> - Back to dashboard</Text>
      <Text> </Text>
      <Text bold color="cyan">Commands</Text>
      <Text> </Text>
      <Text dimColor>:dashboard, :chat, :invoices, :reports, :lhdn, :quit</Text>
    </Box>
  );
}
