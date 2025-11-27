/**
 * Animation Utilities for Terminal UI
 *
 * Provides hooks and helpers for terminal-friendly animations:
 * - Blinking cursor
 * - Spinner variants
 * - Fade-in via delayed render
 * - Progress indicators
 */

import { useState, useEffect } from "react";

/**
 * Blinking cursor hook
 * Returns true/false at the specified interval for cursor blinking
 */
export function useBlinkingCursor(interval = 500): boolean {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => {
      setVisible((prev) => !prev);
    }, interval);
    return () => clearInterval(timer);
  }, [interval]);

  return visible;
}

/**
 * Delayed render hook for fade-in effect
 * Returns true after the delay, creating a staggered appearance
 */
export function useDelayedRender(delay: number): boolean {
  const [shouldRender, setShouldRender] = useState(delay === 0);

  useEffect(() => {
    if (delay === 0) return;
    const timer = setTimeout(() => setShouldRender(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return shouldRender;
}

/**
 * Elapsed time hook
 * Returns elapsed time since startTime in seconds
 */
export function useElapsedTime(startTime: number | null): number {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startTime) return;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  return elapsed;
}

/**
 * Spinner frames for custom spinners
 */
export const SPINNERS = {
  dots: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"],
  line: ["-", "\\", "|", "/"],
  circle: ["◐", "◓", "◑", "◒"],
  bounce: ["⠁", "⠂", "⠄", "⠂"],
  pulse: ["○", "◔", "◑", "◕", "●", "◕", "◑", "◔"],
  simple: [".", "..", "..."],
} as const;

/**
 * Custom spinner hook
 * Returns current frame of the spinner animation
 */
export function useSpinner(
  type: keyof typeof SPINNERS = "dots",
  interval = 80
): string {
  const [frame, setFrame] = useState(0);
  const frames = SPINNERS[type];

  useEffect(() => {
    const timer = setInterval(() => {
      setFrame((prev) => (prev + 1) % frames.length);
    }, interval);
    return () => clearInterval(timer);
  }, [frames.length, interval]);

  return frames[frame];
}

/**
 * Progress animation (for loading bars)
 * Returns a value that oscillates between 0 and 1
 */
export function usePulse(interval = 1000): number {
  const [value, setValue] = useState(0);
  const [increasing, setIncreasing] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => {
      setValue((prev) => {
        const step = 0.1;
        if (increasing) {
          const next = prev + step;
          if (next >= 1) {
            setIncreasing(false);
            return 1;
          }
          return next;
        } else {
          const next = prev - step;
          if (next <= 0) {
            setIncreasing(true);
            return 0;
          }
          return next;
        }
      });
    }, interval / 10);
    return () => clearInterval(timer);
  }, [interval, increasing]);

  return value;
}

/**
 * Format elapsed time as human-readable string
 */
export function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}m ${secs}s`;
}

/**
 * Progress bar characters for different styles
 */
export const PROGRESS_CHARS = {
  block: { filled: "█", empty: "░" },
  line: { filled: "━", empty: "─" },
  dot: { filled: "●", empty: "○" },
  arrow: { filled: "▶", empty: "▷" },
} as const;

/**
 * Generate a progress bar string
 */
export function generateProgressBar(
  progress: number,
  width = 20,
  style: keyof typeof PROGRESS_CHARS = "block"
): string {
  const chars = PROGRESS_CHARS[style];
  const filled = Math.round(progress * width);
  const empty = width - filled;
  return chars.filled.repeat(filled) + chars.empty.repeat(empty);
}

/**
 * Staggered fade-in for lists
 * Returns opacity (0 or 1) based on delay
 */
export function useFadeIn(options: { delay?: number; duration?: number } = {}): boolean {
  const { delay = 0, duration = 150 } = options;
  const [visible, setVisible] = useState(delay === 0);

  useEffect(() => {
    if (delay === 0) return;
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return visible;
}

/**
 * Slide-in animation hook
 * Returns an offset that decreases to 0
 */
export function useSlideIn(options: {
  direction?: "left" | "right" | "up" | "down";
  duration?: number;
  distance?: number;
} = {}): number {
  const { direction = "left", duration = 200, distance = 5 } = options;
  const [offset, setOffset] = useState(distance);

  useEffect(() => {
    const steps = 10;
    const stepDuration = duration / steps;
    const stepSize = distance / steps;

    let currentStep = 0;
    const timer = setInterval(() => {
      currentStep++;
      if (currentStep >= steps) {
        setOffset(0);
        clearInterval(timer);
      } else {
        setOffset(distance - (stepSize * currentStep));
      }
    }, stepDuration);

    return () => clearInterval(timer);
  }, [duration, distance]);

  // Apply direction
  switch (direction) {
    case "right":
      return -offset;
    case "up":
    case "down":
      return offset;
    default:
      return offset;
  }
}

/**
 * Typewriter effect hook
 * Returns progressively more characters of the text
 */
export function useTypewriter(
  text: string,
  options: { speed?: number; startDelay?: number } = {}
): string {
  const { speed = 30, startDelay = 0 } = options;
  const [displayText, setDisplayText] = useState("");

  useEffect(() => {
    let currentIndex = 0;
    let startTimer: NodeJS.Timeout;
    let typeTimer: NodeJS.Timeout;

    const startTyping = () => {
      typeTimer = setInterval(() => {
        if (currentIndex < text.length) {
          setDisplayText(text.slice(0, currentIndex + 1));
          currentIndex++;
        } else {
          clearInterval(typeTimer);
        }
      }, speed);
    };

    if (startDelay > 0) {
      startTimer = setTimeout(startTyping, startDelay);
    } else {
      startTyping();
    }

    return () => {
      clearTimeout(startTimer);
      clearInterval(typeTimer);
    };
  }, [text, speed, startDelay]);

  return displayText;
}

/**
 * Countdown timer hook
 * Returns remaining seconds
 */
export function useCountdown(
  initialSeconds: number,
  options: { autoStart?: boolean; onComplete?: () => void } = {}
): { seconds: number; isRunning: boolean; start: () => void; pause: () => void; reset: () => void } {
  const { autoStart = true, onComplete } = options;
  const [seconds, setSeconds] = useState(initialSeconds);
  const [isRunning, setIsRunning] = useState(autoStart);

  useEffect(() => {
    if (!isRunning || seconds <= 0) return;

    const timer = setInterval(() => {
      setSeconds((prev) => {
        if (prev <= 1) {
          setIsRunning(false);
          onComplete?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isRunning, seconds, onComplete]);

  return {
    seconds,
    isRunning,
    start: () => setIsRunning(true),
    pause: () => setIsRunning(false),
    reset: () => {
      setSeconds(initialSeconds);
      setIsRunning(false);
    },
  };
}

/**
 * Animation frame ticker (for custom animations)
 * Returns a value that increments each frame
 */
export function useAnimationFrame(fps = 30): number {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const interval = 1000 / fps;
    const timer = setInterval(() => {
      setFrame((prev) => prev + 1);
    }, interval);

    return () => clearInterval(timer);
  }, [fps]);

  return frame;
}
