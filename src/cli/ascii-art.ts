/**
 * ASCII Art Module
 *
 * Premium ASCII art for OpenAccounting welcome screen.
 * Uses bold block letters with gradient colors.
 */

import pc from "picocolors";

// Bold block letter ASCII art for "OPEN ACCT"
const ASCII_LOGO_LINES = [
  "    ██████╗ ██████╗ ███████╗███╗   ██╗",
  "   ██╔═══██╗██╔══██╗██╔════╝████╗  ██║",
  "   ██║   ██║██████╔╝█████╗  ██╔██╗ ██║",
  "   ██║   ██║██╔═══╝ ██╔══╝  ██║╚██╗██║",
  "   ╚██████╔╝██║     ███████╗██║ ╚████║",
  "    ╚═════╝ ╚═╝     ╚══════╝╚═╝  ╚═══╝",
  "    █████╗  ██████╗ ██████╗████████╗",
  "   ██╔══██╗██╔════╝██╔════╝╚══██╔══╝",
  "   ███████║██║     ██║        ██║   ",
  "   ██╔══██║██║     ██║        ██║   ",
  "   ██║  ██║╚██████╗╚██████╗   ██║   ",
  "   ╚═╝  ╚═╝ ╚═════╝ ╚═════╝   ╚═╝   ",
];

/**
 * Render the premium welcome screen with ASCII art
 * Uses gradient colors: cyan → blue → magenta
 */
export function renderWelcome(): void {
  console.clear();
  console.log();

  // Render with gradient colors (cyan → blue → magenta)
  ASCII_LOGO_LINES.forEach((line, i) => {
    if (i < 4) {
      console.log(pc.cyan(line));
    } else if (i < 8) {
      console.log(pc.blue(line));
    } else {
      console.log(pc.magenta(line));
    }
  });

  console.log();
  console.log(pc.bold(pc.white("         ◆ OpenAccounting.dev ◆")));
  console.log(pc.dim("     Your AI-Powered Financial Assistant"));
  console.log();
}

/**
 * Render welcome screen and wait for user to continue
 */
export async function renderWelcomeAndWait(): Promise<void> {
  renderWelcome();

  // Brief pause to appreciate the art
  await new Promise(resolve => setTimeout(resolve, 500));

  console.log(pc.dim("     Press Enter to begin setup..."));
  console.log();

  // Wait for Enter key
  await new Promise<void>(resolve => {
    const stdin = process.stdin;
    stdin.setRawMode?.(true);
    stdin.resume();
    stdin.once("data", () => {
      stdin.setRawMode?.(false);
      resolve();
    });
  });
}

// Compact version for narrow terminals or headers
export const logoCompact = `${pc.bold(pc.cyan("◆"))} ${pc.bold(pc.white("OpenAccounting"))}`;

// Full ASCII art as a string (for export if needed)
export const ASCII_LOGO = ASCII_LOGO_LINES.join("\n");
