# ◆ OpenAccounting

**Terminal-native accounting for freelancers and small businesses.**

Your books, your machine. No cloud required.

[![npm](https://img.shields.io/npm/v/openaccounting)](https://www.npmjs.com/package/openaccounting)
[![license](https://img.shields.io/npm/l/openaccounting)](LICENSE)
[![node](https://img.shields.io/node/v/openaccounting)](package.json)

---

## Install

```bash
npm install -g openaccounting
```

<details>
<summary>Other methods</summary>

```bash
# Homebrew (macOS)
brew tap openaccounting/tap && brew install oa

# From source
git clone https://github.com/openaccounting/openaccounting.git
cd openaccounting && npm install && npm run build && npm link
```

</details>

---

## Commands

```
oa                  Open your books
oa fresh            Start fresh (clears all data)
oa help             Show help
oa version          Show version
```

---

## Quick Start

```bash
oa
```

First launch guides you through a quick setup:

```
    ██████╗ ██████╗ ███████╗███╗   ██╗
   ██╔═══██╗██╔══██╗██╔════╝████╗  ██║
   ██║   ██║██████╔╝█████╗  ██╔██╗ ██║
   ...

   Quick Setup (4 questions)

   What should we call your business?
   › Business name [My Business]: _
```

Then you're in the dashboard.

---

## Keyboard Shortcuts

### Navigation

| Key | Where it takes you |
|-----|-------------------|
| `d` | Dashboard |
| `i` | Invoices |
| `e` | Expenses |
| `p` | People (contacts) |
| `v` | Vault (documents) |
| `r` | Reports |
| `c` | Chat (AI) |
| `?` | Help |
| `q` | Quit |

### Inside Lists

| Key | What it does |
|-----|--------------|
| `j` / `k` | Move up/down |
| `n` | New item |
| `a` | Attach file |
| `Tab` | Switch panel |
| `Esc` | Go back |

### Inside Forms

| Key | What it does |
|-----|--------------|
| `↑` / `↓` | Move between fields |
| `←` / `→` | Cycle options |
| `Ctrl+S` | Save |

---

## Features

| | |
|---|---|
| **Invoicing** | Create, PDF export, email, track payments |
| **Expenses** | Categorize, attach receipts, import bank statements |
| **Documents** | Store contracts, receipts, statements |
| **Contacts** | Customers and vendors |
| **Reports** | Balance sheet, P&L, receivables aging |
| **AI Chat** | Ask questions in plain English (optional) |

---

## AI Assistant

Optional. Works without it — just skip if you don't need it.

```bash
# Add to your shell
export OPENAI_API_KEY=sk-...

# Or create .env file
echo "OPENAI_API_KEY=sk-..." > .env
```

Then press `c` in the app to chat:

- *"What am I owed this month?"*
- *"Show expenses over $500"*
- *"Create invoice for Acme Corp, $5000"*

---

## Data

Everything stays on your machine:

```
./oa.db                          Your database
./oa-workspace.json              Workspace config
~/.openaccounting/documents/     Attached files
```

To start over: `oa fresh`

---

## Requirements

- Node.js 18+
- macOS, Linux, or Windows (WSL)

---

## Development

```bash
npm install          # Install dependencies
npm run build        # Compile TypeScript
npm run fresh        # Build + reset + launch
npm run dev          # Watch mode
npm test             # Run tests
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## Links

| | |
|---|---|
| Docs | [openaccounting.dev/docs](https://openaccounting.dev/docs) |
| GitHub | [github.com/openaccounting/openaccounting](https://github.com/openaccounting/openaccounting) |
| Issues | [Report a bug](https://github.com/openaccounting/openaccounting/issues) |
| Changelog | [CHANGELOG.md](CHANGELOG.md) |
| Security | [SECURITY.md](SECURITY.md) |

---

## License

[MIT](LICENSE) — use it however you want.

---

<p align="center">
  <sub>Built with Ink, React, SQLite, and OpenAI</sub>
</p>
