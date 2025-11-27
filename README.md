# ◆ OpenAccounting

**Terminal-native accounting for freelancers and small businesses.**

Your books, your machine. No cloud required.

[![npm](https://img.shields.io/npm/v/openaccounting)](https://www.npmjs.com/package/openaccounting)
[![license](https://img.shields.io/npm/l/openaccounting)](LICENSE)
[![node](https://img.shields.io/node/v/openaccounting)](package.json)

---

## Why OpenAccounting?

Most accounting software stores your financial data on their servers. You pay monthly fees, need internet to access your own books, and if they shut down — your data goes with them.

**OpenAccounting is different.**

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   📁 Your data lives HERE → on YOUR computer                    │
│                                                                 │
│   Not on someone else's server. Not in "the cloud".             │
│   Just a simple file you can backup, move, or delete.           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### The Difference

|   | OpenAccounting | Cloud Software (QuickBooks, Xero, etc.) |
|---|----------------|----------------------------------------|
| 💰 **Cost** | Free forever | $15-50/month ($180-600/year) |
| 🌐 **Internet** | Works offline | Requires connection |
| 🔒 **Privacy** | 100% private | They can access your data |
| 📍 **Data location** | Your computer | Their servers |
| 🏢 **If company shuts down** | Still works | Data at risk |
| 💳 **Payment info required** | No | Yes |
| 📧 **Account required** | No | Yes |

### How It Works

Your financial data is stored in a single file called `oa.db` — a [SQLite](https://sqlite.org) database. SQLite is the most widely deployed database in the world, used by every smartphone, browser, and operating system.

```
Your project folder:
├── oa.db                 ← All your data (invoices, expenses, contacts)
├── oa-workspace.json     ← Your settings
└── ~/.openaccounting/
    └── documents/        ← Attached receipts & files
```

**Want to backup?** Copy the file.
**Want to move computers?** Copy the file.
**Want to delete everything?** Delete the file.

No export wizards. No vendor lock-in. No begging for your own data.

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
