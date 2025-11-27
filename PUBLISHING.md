# Publishing OpenAccounting

## Prerequisites

- [ ] npm account (https://npmjs.com)
- [ ] GitHub account
- [ ] Homebrew installed (for tap setup)

---

## 1. NPM Publication

### First-time setup

```bash
# Login to npm
npm login

# Verify you're logged in
npm whoami
```

### Publish

```bash
# Build the project
npm run build

# Run tests
npm test

# Publish (dry run first)
npm publish --dry-run

# Actual publish
npm publish --access public
```

### Version bumping

```bash
# Patch (0.2.0 → 0.2.1)
npm version patch

# Minor (0.2.0 → 0.3.0)
npm version minor

# Major (0.2.0 → 1.0.0)
npm version major
```

---

## 2. GitHub Repository

### Initial setup

```bash
# Initialize git (if not already)
git init
git add .
git commit -m "Initial commit"

# Create GitHub repo
gh repo create openaccounting/openaccounting --public --source=. --push

# Or manually:
git remote add origin git@github.com:openaccounting/openaccounting.git
git push -u origin main
```

### CI/CD Secrets

1. Go to GitHub repo → Settings → Secrets and variables → Actions
2. Add secret: `NPM_TOKEN`
   - Get token from: https://npmjs.com → Access Tokens → Generate New Token (Automation)

---

## 3. Homebrew Tap

### Create tap repository

```bash
# Create the tap repo
gh repo create openaccounting/homebrew-tap --public

# Clone it
git clone git@github.com:openaccounting/homebrew-tap.git
cd homebrew-tap
```

### Add formula

```bash
# Get SHA256 of published package
curl -sL https://registry.npmjs.org/openaccounting/-/openaccounting-0.2.0.tgz | shasum -a 256

# Copy formula and update SHA256
cp /path/to/openaccounting/homebrew/openaccounting.rb .
# Edit openaccounting.rb - replace PLACEHOLDER_SHA256 with actual hash

git add openaccounting.rb
git commit -m "Add openaccounting formula"
git push
```

### Users can then install via

```bash
brew tap openaccounting/tap
brew install openaccounting
```

---

## 4. Release Checklist

Before each release:

- [ ] Update version in `package.json`
- [ ] Update version in `src/cli/index.ts` (--version output)
- [ ] Run `npm run build`
- [ ] Run `npm test`
- [ ] Test manually: `npm link && oa --version`
- [ ] Commit changes
- [ ] Tag release: `git tag v0.2.0`
- [ ] Push: `git push && git push --tags`
- [ ] Publish: `npm publish`
- [ ] Update Homebrew formula SHA256

---

## 5. Testing Before Publish

### Local testing

```bash
# Build and link globally
npm run build
npm link

# Test as new user
cd /tmp
rm -rf test-oa && mkdir test-oa && cd test-oa
oa
```

### Package contents check

```bash
# See what will be published
npm pack --dry-run

# Create tarball and inspect
npm pack
tar -tzf openaccounting-0.2.0.tgz
```

---

## Quick Reference

| Task | Command |
|------|---------|
| Build | `npm run build` |
| Test | `npm test` |
| Link locally | `npm link` |
| Publish | `npm publish` |
| Bump patch | `npm version patch` |
| Create tag | `git tag v0.2.0` |
