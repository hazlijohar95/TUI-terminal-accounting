# Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Interface                          │
├──────────────────┬──────────────────┬───────────────────────────┤
│   TUI Dashboard  │       CLI        │        REST API           │
│   (Ink/React)    │   (Commander)    │       (Fastify)           │
└────────┬─────────┴────────┬─────────┴─────────────┬─────────────┘
         │                  │                       │
         └──────────────────┼───────────────────────┘
                            │
┌───────────────────────────┴───────────────────────────────────┐
│                        Core Layer                              │
├───────────────┬───────────────┬───────────────┬───────────────┤
│   Invoicing   │   Expenses    │   Contacts    │   Reports     │
│               │               │               │               │
├───────────────┴───────────────┴───────────────┴───────────────┤
│                     Accounting Engine                          │
│              (Double-entry, Chart of Accounts)                 │
└───────────────────────────────┬───────────────────────────────┘
                                │
┌───────────────────────────────┴───────────────────────────────┐
│                        Data Layer                              │
├──────────────────────┬────────────────────────────────────────┤
│      SQLite DB       │           Document Storage             │
│   (better-sqlite3)   │        (~/.openaccounting/)            │
└──────────────────────┴────────────────────────────────────────┘
                                │
┌───────────────────────────────┴───────────────────────────────┐
│                    External Services                           │
├──────────────────┬────────────────────┬───────────────────────┤
│     OpenAI       │       Convex       │     Email (Resend)    │
│   (AI Agent)     │   (Cloud Sync)     │   (Invoice Sending)   │
└──────────────────┴────────────────────┴───────────────────────┘
```

## Directory Structure

```
src/
├── api/                    # REST API
│   ├── plugins/            # Fastify plugins (auth, rate limit)
│   ├── routes/             # API endpoints
│   ├── schemas/            # Zod validation schemas
│   └── server.ts           # Server setup
│
├── agent/                  # AI Agent
│   ├── engine/             # Multi-step reasoning engine
│   ├── memory/             # Semantic memory (embeddings)
│   ├── prompts/            # System prompts
│   ├── tools/              # Agent tool definitions
│   └── config.ts           # Agent configuration
│
├── cli/                    # Command-line interface
│   ├── commands/           # CLI commands (init, add, report)
│   └── index.ts            # CLI entry point
│
├── config/                 # Configuration
│   └── env.ts              # Environment validation (Zod)
│
├── core/                   # Business logic
│   ├── accounts.ts         # Chart of accounts
│   ├── coa-templates.ts    # Country-specific COA templates
│   ├── localization.ts     # Currency/date formatting
│   ├── workspace.ts        # Workspace management
│   └── logger.ts           # Logging (Pino)
│
├── db/                     # Database
│   ├── index.ts            # Database connection
│   ├── encryption.ts       # Field-level encryption
│   └── schema.ts           # Table definitions
│
├── domain/                 # Domain models
│   ├── invoices.ts         # Invoice CRUD
│   ├── expenses.ts         # Expense CRUD
│   ├── contacts.ts         # Contact management
│   ├── documents.ts        # Document vault
│   └── reports.ts          # Financial reports
│
├── services/               # External integrations
│   ├── myinvois/           # Malaysia e-invoicing
│   └── pdf/                # PDF generation (PDFKit)
│
├── spreadsheet/            # Spreadsheet engine
│   ├── components/         # React components
│   ├── core/               # Spreadsheet logic
│   └── persistence/        # Import/export
│
└── tui/                    # Terminal UI
    ├── components/         # React/Ink components
    ├── views/              # Screen views
    └── DashboardApp.tsx    # Main app component
```

## Core Components

### TUI Dashboard (`src/tui/`)

The terminal interface uses [Ink](https://github.com/vadimdemedes/ink), a React renderer for the terminal. Key features:

- **Alternate screen mode**: Like vim or htop, uses a separate screen buffer
- **Vim-style navigation**: `j/k` for movement, single-key shortcuts
- **Component-based**: Each view (Invoices, Expenses, etc.) is a React component

```typescript
// Entry point: src/tui/dashboard-entry.tsx
const { waitUntilExit } = render(<DashboardApp />);
await waitUntilExit();
```

### Database (`src/db/`)

SQLite via [better-sqlite3](https://github.com/WiseLibs/better-sqlite3). Synchronous API for simplicity.

**Key tables:**
| Table | Purpose |
|-------|---------|
| `accounts` | Chart of accounts |
| `journal_entries` | Double-entry transactions |
| `invoices` | Invoice headers |
| `invoice_items` | Invoice line items |
| `expenses` | Expense records |
| `contacts` | Customers and vendors |
| `documents` | Document metadata |
| `settings` | Application configuration |

**Encryption:**
Sensitive fields (API keys, passwords) are encrypted with AES-256-GCM before storage:

```typescript
import { encrypt, decrypt } from "../db/encryption.js";
const encrypted = encrypt(apiKey);
const decrypted = decrypt(encrypted);
```

### AI Agent (`src/agent/`)

Multi-step reasoning agent built on OpenAI's function calling:

```
User Query → Context Builder → Reasoning Engine → Tool Execution → Response
                   ↑                    ↓
              Memory Manager ←──────────┘
```

**Components:**
- **Context Builder**: Gathers relevant financial data for the prompt
- **Reasoning Engine**: ReAct-style loop with tool calls
- **Memory Manager**: Stores conversation history and learned facts
- **Tools**: Functions the agent can call (query invoices, create expenses, etc.)

### Accounting Engine (`src/core/`)

Double-entry bookkeeping implementation:

- **Chart of Accounts**: Hierarchical account structure
- **Journal Entries**: Debits and credits must balance
- **Localization**: Country-specific COA templates and formatting

```typescript
// Example: Creating a journal entry
createJournalEntry({
  date: "2025-01-15",
  description: "Client payment received",
  entries: [
    { account: "1100", debit: 1000 },  // Cash
    { account: "1200", credit: 1000 }, // Accounts Receivable
  ],
});
```

### REST API (`src/api/`)

Optional REST API built with [Fastify](https://fastify.dev/):

- **Authentication**: JWT with refresh tokens
- **Rate limiting**: Configurable per-route limits
- **Validation**: Zod schemas for request/response
- **OpenAPI**: Auto-generated documentation

## Data Flow

### Invoice Creation

```
User Input (TUI/CLI/API)
        ↓
    Validation (Zod)
        ↓
    Create Invoice Record
        ↓
    Create Journal Entry
    ├── Debit: Accounts Receivable
    └── Credit: Revenue
        ↓
    Generate PDF (optional)
        ↓
    Send Email (optional)
```

### AI Query Processing

```
User: "What am I owed this month?"
        ↓
    Load Context
    ├── Recent invoices
    ├── Account balances
    └── Memory (previous queries)
        ↓
    Send to OpenAI
        ↓
    Tool Calls (if needed)
    ├── query_invoices
    ├── get_account_balance
    └── ...
        ↓
    Generate Response
        ↓
    Store in Memory
```

## Technology Stack

| Category | Technology |
|----------|------------|
| Runtime | Node.js 18+ |
| Language | TypeScript 5 |
| TUI | Ink (React for terminal) |
| API | Fastify |
| Database | SQLite (better-sqlite3) |
| AI | OpenAI GPT-4 |
| PDF | PDFKit |
| Excel | ExcelJS |
| Validation | Zod |
| Logging | Pino |

## Configuration

Environment variables (validated by Zod in `src/config/env.ts`):

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | No | Enables AI features |
| `CONVEX_URL` | No | Cloud sync backend |
| `JWT_SECRET` | For API | JWT signing key |
| `JWT_REFRESH_SECRET` | For API | Refresh token key |
| `DB_ENCRYPTION_KEY` | No | Field encryption key |
| `NODE_ENV` | No | development/production |
| `LOG_LEVEL` | No | error/warn/info/debug |

## Extension Points

### Adding a New Command

1. Create handler in `src/cli/commands/`
2. Register in `src/cli/index.ts`

### Adding a New TUI View

1. Create component in `src/tui/components/`
2. Add keyboard shortcut in `DashboardApp.tsx`

### Adding a New Agent Tool

1. Define tool in `src/agent/tools/`
2. Register in `src/agent/tools/index.ts`

### Adding a New API Endpoint

1. Create route in `src/api/routes/`
2. Define schema in `src/api/schemas/`
3. Register in `src/api/server.ts`
