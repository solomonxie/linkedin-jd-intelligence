# Repo Instructions

## Git workflow

- Work directly on `master` — no feature branches.
- Bump the `version` in `package.json` on every change that touches `dist/` output (source, manifest,
  or anything packaged). Manifest version is derived from it automatically.
- After every change or fix (however small), in this order: build (`npm run build`), run tests
  (`npm test`), then commit. Don't batch unrelated fixes into one commit — split into small,
  single-purpose commits as you go.
- Push to `origin/master` after committing.
