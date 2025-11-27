# OpenAccounting API Implementation Guide

This document describes the Open API infrastructure implemented for OpenAccounting, enabling programmatic access to accounting data.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Setup Instructions](#setup-instructions)
4. [File Structure](#file-structure)
5. [Authentication](#authentication)
6. [API Endpoints](#api-endpoints)
7. [Error Handling](#error-handling)
8. [Database Schema](#database-schema)
9. [Remaining Work](#remaining-work)

---

## Overview

The API layer transforms OpenAccounting from a CLI/TUI application into a production-ready API platform with:

- **Fastify** HTTP server (high performance, TypeScript-native)
- **Convex** cloud backend for data persistence
- **Multi-tenant** architecture with organization isolation
- **Dual authentication**: API keys + JWT tokens
- **OpenAPI/Swagger** documentation
- **RFC 7807** standardized error responses
- **Rate limiting** (100 requests/minute)

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    API Consumers                        │
│            (Internal Apps, Partners, Public)            │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│                  Fastify API Layer                      │
│  ┌─────────┐ ┌──────────┐ ┌────────┐ ┌──────────────┐  │
│  │  Auth   │ │  Routes  │ │ Zod    │ │ Rate Limit   │  │
│  │ Plugin  │ │ /api/v1  │ │ Valid. │ │  Plugin      │  │
│  └─────────┘ └──────────┘ └────────┘ └──────────────┘  │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│                 Convex Backend                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │   Schema    │  │  Mutations  │  │   Queries   │     │
│  │  (Tables)   │  │   (CRUD)    │  │   (Read)    │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
└─────────────────────────────────────────────────────────┘
```

---

## Setup Instructions

### 1. Environment Configuration

Copy the example environment file and configure:

```bash
cp .env.example .env
```

Edit `.env` with your values:

```env
# Required
OPENAI_API_KEY=sk-your-key-here
CONVEX_URL=https://your-deployment.convex.cloud

# For API server
JWT_SECRET=your-32-char-minimum-secret-here
JWT_REFRESH_SECRET=another-32-char-minimum-secret

# Optional
NODE_ENV=development
API_PORT=3000
API_RATE_LIMIT=100
```

Generate secure secrets:
```bash
# Generate JWT secrets
openssl rand -base64 32
```

### 2. Deploy Convex Schema

```bash
# Start Convex development server (deploys schema)
npx convex dev
```

This will:
- Deploy the schema defined in `convex/schema.ts`
- Generate TypeScript types in `convex/_generated/`
- Start watching for changes

### 3. Build the Project

```bash
npm run build
```

### 4. Start the API Server

```bash
node dist/api/server.js
```

You should see:
```
╔═══════════════════════════════════════════════════╗
║         OpenAccounting API Server                 ║
╠═══════════════════════════════════════════════════╣
║  Server:     http://0.0.0.0:3000                  ║
║  Docs:       http://0.0.0.0:3000/docs             ║
║  Health:     http://0.0.0.0:3000/health           ║
║  Environment: development                         ║
╚═══════════════════════════════════════════════════╝
```

### 5. Access API Documentation

Open http://localhost:3000/docs in your browser for interactive Swagger UI.

---

## File Structure

```
src/
├── api/
│   ├── server.ts              # Fastify app setup & configuration
│   ├── plugins/
│   │   └── auth.ts            # Authentication plugin (API keys + JWT)
│   ├── routes/
│   │   └── v1/
│   │       └── invoices.ts    # Invoice CRUD endpoints
│   ├── schemas/
│   │   └── invoice.ts         # Zod validation schemas
│   ├── middleware/            # (Future: audit, org-context)
│   └── utils/
│       ├── errors.ts          # RFC 7807 error classes
│       └── convex.ts          # Convex client wrapper
├── config/
│   └── env.ts                 # Validated environment config

convex/
├── schema.ts                  # Database schema (12 tables)
├── apiKeys.ts                 # API key management
├── audit.ts                   # Audit logging
├── invoices.ts                # Invoice CRUD mutations
├── agent.ts                   # AI actions (existing)
└── _generated/                # Auto-generated types
```

---

## Authentication

The API supports two authentication methods:

### API Key Authentication

Include in request header:
```
X-API-Key: oa_your_api_key_here
```

API keys are:
- Prefixed with `oa_` for identification
- Hashed with bcrypt before storage
- Scoped to specific permissions
- Organization-bound

### JWT Bearer Token

Include in request header:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

JWTs are:
- Short-lived (15 minutes)
- Paired with refresh tokens (7 days)
- Contain org and user context

### Scopes

API endpoints require specific scopes:

| Scope | Description |
|-------|-------------|
| `invoices:read` | Read invoice data |
| `invoices:write` | Create/update invoices |
| `invoices:delete` | Delete draft invoices |
| `customers:read` | Read customer data |
| `customers:write` | Create/update customers |
| `*` | Full access (admin) |

### Development Mode

In development, API keys starting with `dev_` are accepted without Convex validation:
```
X-API-Key: dev_test_key
```

---

## API Endpoints

### Health Check

```
GET /health
GET /ready
```

No authentication required.

### Invoices

All endpoints require authentication and `invoices:*` scopes.

#### List Invoices
```
GET /api/v1/invoices
```

Query parameters:
- `status` - Filter by status (draft, sent, paid, etc.)
- `customerId` - Filter by customer
- `limit` - Max results (1-100, default 50)
- `cursor` - Pagination cursor

#### Get Invoice
```
GET /api/v1/invoices/:id
```

Returns invoice with line items and customer details.

#### Create Invoice
```
POST /api/v1/invoices
```

Request body:
```json
{
  "customerId": "customer_id_here",
  "number": "INV-001",
  "date": "2024-01-15",
  "dueDate": "2024-02-15",
  "items": [
    {
      "description": "Consulting services",
      "quantity": 10,
      "unitPrice": 15000
    }
  ],
  "taxRate": 8.25,
  "notes": "Thank you for your business"
}
```

Note: Amounts are in cents (e.g., 15000 = $150.00)

#### Update Invoice
```
PATCH /api/v1/invoices/:id
```

Only draft invoices can be updated.

#### Update Status
```
PUT /api/v1/invoices/:id/status
```

Request body:
```json
{
  "status": "sent"
}
```

#### Record Payment
```
POST /api/v1/invoices/:id/payments
```

Request body:
```json
{
  "amount": 50000
}
```

Automatically updates invoice status to `partial` or `paid`.

#### Delete Invoice
```
DELETE /api/v1/invoices/:id
```

Only draft invoices can be deleted.

---

## Error Handling

All errors follow [RFC 7807 Problem Details](https://tools.ietf.org/html/rfc7807):

```json
{
  "type": "https://api.openaccounting.dev/errors/not-found",
  "title": "Resource Not Found",
  "status": 404,
  "detail": "Invoice with ID 'xyz' was not found",
  "instance": "/api/v1/invoices/xyz"
}
```

### Error Types

| Status | Type | Description |
|--------|------|-------------|
| 400 | `validation-error` | Request validation failed |
| 401 | `unauthorized` | Missing authentication |
| 401 | `invalid-api-key` | Invalid or expired API key |
| 401 | `invalid-token` | Invalid or expired JWT |
| 403 | `forbidden` | Access denied |
| 403 | `insufficient-scope` | Missing required scope |
| 404 | `not-found` | Resource not found |
| 409 | `duplicate-entry` | Duplicate unique value |
| 422 | `business-rule-violation` | Business logic error |
| 429 | `rate-limit-exceeded` | Too many requests |
| 500 | `internal-error` | Server error |

---

## Database Schema

### Multi-Tenancy Tables

| Table | Description |
|-------|-------------|
| `organizations` | Top-level tenant with settings |
| `apiKeys` | API keys with scopes and expiration |
| `users` | Organization members with roles |

### Accounting Tables

| Table | Description |
|-------|-------------|
| `accounts` | Chart of accounts (asset, liability, etc.) |
| `customers` | People/companies you sell to |
| `vendors` | People/companies you buy from |
| `invoices` | Sales invoices |
| `invoiceItems` | Line items on invoices |
| `expenses` | Outgoing money |
| `payments` | Money received or sent |
| `journalEntries` | Double-entry bookkeeping entries |
| `journalLines` | Debit/credit lines |

### System Tables

| Table | Description |
|-------|-------------|
| `documents` | Uploaded files (receipts, etc.) |
| `auditLog` | All changes for compliance |

---

## Remaining Work

### High Priority

1. **Create organization setup flow**
   - Admin endpoint to create organizations
   - Initial API key generation

2. **Add remaining routes**
   - `src/api/routes/v1/customers.ts`
   - `src/api/routes/v1/expenses.ts`
   - `src/api/routes/v1/payments.ts`
   - `src/api/routes/v1/accounts.ts`

3. **Implement Convex mutations**
   - `convex/customers.ts`
   - `convex/expenses.ts`
   - `convex/payments.ts`
   - `convex/accounts.ts`
   - `convex/organizations.ts`

### Medium Priority

4. **Add JWT refresh endpoint**
   - `POST /api/v1/auth/refresh`

5. **Implement audit middleware**
   - Auto-log all mutations
   - Track user/API key context

6. **Add reports endpoints**
   - `GET /api/v1/reports/profit-loss`
   - `GET /api/v1/reports/balance-sheet`
   - `GET /api/v1/reports/trial-balance`

### Lower Priority

7. **OAuth integration** (if needed)

8. **Webhook support**
   - Notify external systems of changes

9. **Batch operations**
   - Bulk create/update endpoints

---

## Security Checklist

- [x] `.env` excluded from git
- [x] API keys hashed with bcrypt
- [x] Rate limiting enabled
- [x] CORS configured
- [x] Input validation with Zod
- [ ] **CRITICAL: Rotate exposed OpenAI API key**
- [ ] Remove `.env` from git history (if committed)
- [ ] Set up HTTPS in production
- [ ] Configure production CORS origins

---

## Quick Reference

### Start Development
```bash
# Terminal 1: Convex
npx convex dev

# Terminal 2: Build & watch
npm run dev

# Terminal 3: Run API (after build)
node dist/api/server.js
```

### Test API
```bash
# Health check
curl http://localhost:3000/health

# List invoices (dev mode)
curl -H "X-API-Key: dev_test" http://localhost:3000/api/v1/invoices

# Create invoice
curl -X POST http://localhost:3000/api/v1/invoices \
  -H "X-API-Key: dev_test" \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "customer_123",
    "number": "INV-001",
    "date": "2024-01-15",
    "dueDate": "2024-02-15",
    "items": [{"description": "Service", "quantity": 1, "unitPrice": 10000}]
  }'
```

### View Logs
```bash
# Pretty logs in development
LOG_LEVEL=debug node dist/api/server.js
```
