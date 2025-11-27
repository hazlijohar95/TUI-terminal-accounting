# Homebrew Tap for OpenAccounting

## Setup

To publish this formula:

1. Create a tap repository: `openaccounting/homebrew-tap`
2. Copy `openaccounting.rb` to the tap
3. Update the SHA256 hash after publishing to npm:
   ```bash
   curl -sL https://registry.npmjs.org/openaccounting/-/openaccounting-0.2.0.tgz | shasum -a 256
   ```
4. Users can then install via:
   ```bash
   brew tap openaccounting/tap
   brew install oa
   ```

## Updating

When publishing a new version:
1. Update version in formula URL
2. Regenerate SHA256 hash
3. Push to tap repository
