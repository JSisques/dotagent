# dotagent

Portable, configurable AI agent setup (skills, MCPs, etc.) installable via `npx @jsisques/dotagent`.

## Status

Early scaffold. The CLI is a stub: `dotagent-cli` does nothing yet. Catalog, `init` and `undo` land in follow-up changes.

## Development

```sh
npm install
npm run typecheck
npm test
npm run build
```

Tests never touch the real home directory; see `test/setup.ts`.
