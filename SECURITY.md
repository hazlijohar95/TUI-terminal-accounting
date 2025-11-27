# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.2.x   | :white_check_mark: |
| < 0.2   | :x:                |

We recommend always running the latest version.

## Reporting a Vulnerability

**Do not report security vulnerabilities through public GitHub issues.**

Instead, please report them via email to **security@openaccounting.dev**.

Include:

1. Description of the vulnerability
2. Steps to reproduce
3. Potential impact
4. Any suggested fixes (optional)

### What to Expect

| Timeframe | Action |
|-----------|--------|
| 24 hours | Acknowledgment of your report |
| 72 hours | Initial assessment and severity classification |
| 7 days | Status update with remediation plan |
| 30 days | Target for fix release (critical issues faster) |

We'll keep you informed throughout the process and credit you in the release notes (unless you prefer to remain anonymous).

## Security Practices

### Data Storage

- All data is stored locally in SQLite by default
- Sensitive fields (API keys, passwords) are encrypted with AES-256-GCM
- Database files are created with restricted permissions (0600)

### API Security

When running the optional REST API:

- JWT-based authentication with refresh tokens
- Rate limiting enabled by default
- CORS restrictions in production
- HTTPS enforcement available via `REQUIRE_HTTPS=true`

### Dependencies

- We run `npm audit` in CI and address high/critical vulnerabilities promptly
- Native dependencies are pinned to tested versions
- We minimize dependency footprint where possible

### What We Don't Do

- We never collect telemetry or usage data
- We never transmit your financial data to external servers (except when you explicitly use AI features with OpenAI)
- We never store API keys in plaintext

## Security Checklist for Deployment

If running the API server in production:

- [ ] Set strong `JWT_SECRET` (32+ characters)
- [ ] Set strong `JWT_REFRESH_SECRET` (different from JWT_SECRET)
- [ ] Set `DB_ENCRYPTION_KEY` for field-level encryption
- [ ] Enable `REQUIRE_HTTPS=true` with proper reverse proxy
- [ ] Configure `ALLOWED_ORIGINS` for CORS
- [ ] Set `NODE_ENV=production`
- [ ] Keep `LOG_LEVEL=error` or `warn` in production

## Scope

This security policy covers:

- The OpenAccounting npm package
- The official Docker images (when available)
- The documentation and examples

Third-party integrations, forks, and self-hosted modifications are not covered.
