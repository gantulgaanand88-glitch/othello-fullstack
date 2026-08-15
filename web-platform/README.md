# Othello Arena web platform

This is the replacement web stack. It does not modify or serve the Kotlin Android client.

Production: [othello-arena-edge.othello-arena-platform.workers.dev](https://othello-arena-edge.othello-arena-platform.workers.dev)

## Local checks

```powershell
npm install
npm --prefix web install
npm run typecheck
npm run build
npm run test:visual
```

Rust tests require the `wasm32-unknown-unknown` target. On Windows without the MSVC linker, the repository can be tested with the official Rust Docker image:

```powershell
docker run --rm --init -v "${PWD}:/workspace" -w /workspace rust:1.97 cargo test -p othello-engine -p arena-protocol
```

The Cloudflare bundle is produced with `npm run worker:build`. It uses a native `worker-build` installation when available and otherwise runs the pinned Rust toolchain through Docker. `workers-rs` 0.8.5's reset-state wrapper currently rejects this Worker's otherwise valid Wasm module because it does not contain an extern-reference table. The supported legacy shim keeps panic-abort semantics and produces a deployable bundle; remove the opt-out after the upstream wrapper accepts modules without that table.

## Cloudflare resources

Provision separate preview and production resources, then place their IDs in Wrangler environment blocks:

```powershell
npx wrangler d1 create othello-arena-prod
npx wrangler kv namespace create SESSION_CACHE
npx wrangler queues create othello-game-events
npx wrangler d1 migrations apply othello-arena-prod --remote --config workers/arena/wrangler.jsonc
```

R2 is reserved for finished-game archives and can be enabled when that consumer is introduced; it is not required by the live game path.

Never put tokens in `wrangler.jsonc`. Use `wrangler secret put` or the Cloudflare dashboard. Deploy previews first, run the health/WebSocket smoke tests, and promote the same tested commit.

For a production verification against the deployed service:

```powershell
$env:OTHELLO_BASE_URL='https://othello-arena-edge.othello-arena-platform.workers.dev'
npm run test:live
```

See [docs/architecture.md](docs/architecture.md) for the data ownership and scaling decisions.
