# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- CONTRIBUTING.md with development guidelines
- CODE_OF_CONDUCT.md (Contributor Covenant v2.1)
- SECURITY.md with vulnerability reporting process
- Architecture documentation
- GitHub issue and PR templates

### Changed
- Replaced xlsx package with exceljs for better security
- Made OPENAI_API_KEY optional (AI features gracefully disabled without it)
- Improved dotenv loading for global npm installs

### Security
- Fixed node-forge ASN.1 vulnerabilities via npm audit fix
- Removed xlsx package (unfixed Prototype Pollution and ReDoS vulnerabilities)

## [0.2.0] - 2025-01-15

### Added
- Full-screen TUI dashboard with vim-style navigation
- AI-powered chat assistant for natural language queries
- Invoice creation and PDF export
- Expense tracking with receipt attachment
- Document vault for storing financial documents
- Balance sheet and P&L reports
- Receivables aging report
- Contact management for customers and vendors
- Multi-currency support
- Fiscal year configuration
- SQLite database with encrypted sensitive fields
- REST API with JWT authentication
- Spreadsheet view with formula support

### Changed
- Migrated from CLI-only to full TUI experience
- Improved onboarding flow with guided setup

## [0.1.0] - 2024-12-01

### Added
- Initial CLI release
- Basic double-entry accounting
- Invoice generation
- Expense recording
- SQLite storage
- OpenAI integration for queries

[Unreleased]: https://github.com/openaccounting/openaccounting/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/openaccounting/openaccounting/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/openaccounting/openaccounting/releases/tag/v0.1.0
