# Release checklist

LoopKit release flow:

1. Merge feature PRs into `main`.
2. Run local checks if needed:
   ```bash
   npm test
   npm run pack:dry
   ```
3. Bump the package version:
   ```bash
   npm version patch
   ```
4. Push the commit and tag:
   ```bash
   git push
   git push --tags
   ```
5. The `Publish npm package` workflow publishes tags matching `v*`.

Before automated publishing works, configure npm Trusted Publisher for:

```text
Owner: Rrock-k
Repository: loopkit
Workflow filename: publish.yml
```
