# Othello Arena web architecture

The web rewrite is intentionally separate from the legacy Express service. The Android application keeps using the old API until an explicit Android migration is planned and tested.

## Runtime split

| Concern | Technology | Reason |
| --- | --- | --- |
| Browser UI | React + TypeScript + Vite | Excellent iteration speed, accessibility ecosystem, small cached static assets |
| Rules and bots | Rust `othello-engine` | One authoritative, deterministic, allocation-light implementation |
| Edge API | Rust `workers-rs` on Cloudflare Workers | Globally distributed validation and API execution |
| Live game state | One SQLite Durable Object per game | Single-writer ordering, alarms, reconnectable hibernating WebSockets |
| Matchmaking | Sharded SQLite Durable Objects | Serialized queue mutations without process-local state |
| Relational records | Cloudflare D1 | Accounts, ratings, games, tournaments, moderation, immutable ledgers |
| Session/rate-limit cache | Workers KV | Globally readable, short-lived derived state only |
| Durable archives | R2 | Compressed finished-game exports and future analysis artifacts |
| Retryable work | Cloudflare Queues | Rating updates, archival, notifications, anti-abuse signals |
| Static delivery | Workers Static Assets | Versioned immutable assets and SPA fallback on the same edge deployment |

## Invariants

1. The server is authoritative. A browser submits an intent with a unique command ID; it never submits a resulting board.
2. Every game has one writer: its Durable Object. Revision numbers totally order accepted commands.
3. Finished games are copied to D1 through an idempotent outbox/queue path. Rating changes are immutable ledger entries.
4. Durable Object storage is hot operational state, not the public historical database.
5. KV and browser caches may be deleted at any time without losing canonical data.
6. Every external command is bounded, validated, rate-limited, and safe to retry.
7. The browser can reconnect using `game_id` and `last_revision`; a fresh snapshot resolves any divergence.

## Matchmaking growth path

The first lobby object is global for local development. Production routes queue keys to deterministic shards such as `rapid:1400-1599:eu:3`. A coordinator only broadens rating/region windows over time; the game Durable Object remains the authority after pairing. This avoids turning a single global room into a scaling bottleneck.

## Security boundaries

- Session cookies are `Secure`, `HttpOnly`, `SameSite=Lax`, rotated, and stored only as digests in D1.
- WebSocket upgrades require a short-lived, audience-bound game ticket; connection attachments carry the verified user ID and assigned color.
- Move, chat, draw, resign, and rematch commands are authorized against that attachment before mutation.
- Origins, body sizes, message rates, handle/chat normalization, and command IDs are validated at the edge.
- Admin actions append an audit event. Moderation records and fair-play signals are never sent to public clients.

## Deployment topology

One Worker deployment serves the Vite build and `/api/*` and `/ws/*`. Preview and production use separate D1/KV/R2/Queue resources and Durable Object namespaces. Migrations run before traffic promotion. The legacy web and Android backend remain independently deployable during the migration window.
