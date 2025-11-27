import { useState, useCallback } from "react";

type UseInputHistoryOptions = {
  maxHistory?: number;
};

type UseInputHistoryReturn = {
  history: string[];
  historyIndex: number;
  addToHistory: (input: string) => void;
  navigateUp: () => string | null;
  navigateDown: () => string | null;
  resetNavigation: () => void;
  clearHistory: () => void;
};

export function useInputHistory(options: UseInputHistoryOptions = {}): UseInputHistoryReturn {
  const maxHistory = options.maxHistory || 50;

  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [tempInput, setTempInput] = useState("");

  const addToHistory = useCallback((input: string) => {
    const trimmed = input.trim();
    if (!trimmed) return;

    // Don't add duplicates of the most recent entry
    setHistory(prev => {
      if (prev[0] === trimmed) return prev;

      const newHistory = [trimmed, ...prev].slice(0, maxHistory);
      return newHistory;
    });

    setHistoryIndex(-1);
    setTempInput("");
  }, [maxHistory]);

  const navigateUp = useCallback(() => {
    if (history.length === 0) return null;

    const newIndex = Math.min(historyIndex + 1, history.length - 1);
    setHistoryIndex(newIndex);

    return history[newIndex] || null;
  }, [history, historyIndex]);

  const navigateDown = useCallback(() => {
    if (historyIndex <= 0) {
      setHistoryIndex(-1);
      return tempInput || "";
    }

    const newIndex = historyIndex - 1;
    setHistoryIndex(newIndex);

    return history[newIndex] || "";
  }, [history, historyIndex, tempInput]);

  const resetNavigation = useCallback(() => {
    setHistoryIndex(-1);
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    setHistoryIndex(-1);
    setTempInput("");
  }, []);

  return {
    history,
    historyIndex,
    addToHistory,
    navigateUp,
    navigateDown,
    resetNavigation,
    clearHistory,
  };
}
