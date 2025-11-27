# Contributing to OpenAccounting

Thanks for your interest in contributing. This document covers everything you need to get started.

## Development Setup

### Prerequisites

- Node.js 18+
- npm 9+
- SQLite (comes with most systems)
- Python 3 + C++ build tools (for native dependencies)

### Getting Started

```bash
# Clone the repository
git clone https://github.com/openaccounting/openaccounting.git
cd openaccounting

# Install dependencies
npm install

# Build the project
npm run build

# Run locally
npm link
oa
```

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Required for AI features:
- `OPENAI_API_KEY` - Get from [OpenAI Platform](https://platform.openai.com/api-keys)

Optional:
- `CONVEX_URL` - For cloud sync features
- `JWT_SECRET` - For API authentication (32+ chars)

## Code Style

We use ESLint and Prettier. Run before committing:

```bash
npm run lint        # Check for issues
npm run lint:fix    # Auto-fix issues
npm run format      # Format with Prettier
```

### TypeScript Guidelines

- Use strict mode (enabled in tsconfig)
- Prefer explicit types over `any`
- Use `interface` for object shapes, `type` for unions/primitives
- Export types alongside their implementations

### File Organization

```
src/
├── api/          # REST API (Fastify)
├── agent/        # AI agent and tools
├── cli/          # Command-line interface
├── core/         # Business logic, data access
├── db/           # Database schema, queries
├── domain/       # Domain models
├── services/     # External service integrations
├── spreadsheet/  # Spreadsheet engine
└── tui/          # Terminal UI (Ink/React)
```

## Pull Request Process

### Before You Start

1. Check [existing issues](https://github.com/openaccounting/openaccounting/issues) for related work
2. For large changes, open an issue first to discuss the approach
3. Fork the repository and create a branch from `main`

### Branch Naming

```
feat/short-description    # New features
fix/issue-number-desc     # Bug fixes
docs/what-changed         # Documentation
refactor/what-changed     # Code refactoring
```

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add invoice PDF export
fix: correct balance calculation for multi-currency
docs: update API authentication guide
refactor: extract validation into separate module
```

### PR Checklist

- [ ] Code compiles (`npm run build`)
- [ ] Tests pass (`npm test`)
- [ ] Linting passes (`npm run lint`)
- [ ] New features have tests
- [ ] Breaking changes are documented

### Review Process

1. Submit PR with clear description of changes
2. Automated checks must pass
3. One maintainer approval required
4. Squash merge to main

## Testing

```bash
# Run all tests
npm test

# Run specific test file
npm test -- tests/invoices.test.ts
```

### Writing Tests

- Place tests in `tests/` directory
- Name files `*.test.ts`
- Use Node's built-in test runner
- Test both happy paths and edge cases

Example:

```typescript
import { test, describe } from "node:test";
import assert from "node:assert";

describe("Invoice", () => {
  test("calculates total with tax", () => {
    const invoice = createInvoice({ subtotal: 100, taxRate: 0.1 });
    assert.strictEqual(invoice.total, 110);
  });
});
```

## Documentation

- Update README.md for user-facing changes
- Update docs/ for architectural changes
- Add JSDoc comments for public APIs
- Include code examples where helpful

## Questions?

- Open a [GitHub Discussion](https://github.com/openaccounting/openaccounting/discussions)
- Check existing issues and PRs
- Read the [Architecture Guide](docs/ARCHITECTURE.md)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
