# Security baseline

This document records controls that exist today and gaps that must be closed before a large public or commercial launch. It is not a guarantee that the service cannot be compromised.

## Implemented

- The Rust game engine is authoritative for legal moves, flips, turns, clocks, results, and bot replies.
- Browser sessions use a random token in a `Secure`, `HttpOnly`, `SameSite=Strict`, `__Host-` cookie. Only a SHA-256 digest is stored in D1 and guest sessions expire after seven days.
- Authentication responses are marked `no-store`.
- WebSocket handshakes require an exact same-origin `Origin` value. State-changing authentication requests reject a mismatched origin.
- WebSocket messages are JSON-only and limited to 16 KiB server-side. Browser clients also reject oversized responses.
- Static responses apply a restrictive Content Security Policy, clickjacking protection, MIME sniffing protection, a permissions policy, and conservative referrer behavior.
- Durable Objects serialize game state, enforce seat ownership, and persist revisions and clocks in SQLite storage.
- Matchmaking issues high-entropy, game-scoped seat credentials. A game ID alone creates a spectator connection and cannot claim a player color; the browser keeps the credential out of the navigation request by carrying it in the URL fragment.

## Pre-commercial blockers

- Add explicit seat-credential expiry, single-active-player-connection enforcement, revocation, and recovery after a controlled reconnect.
- Add per-account, per-IP, and per-connection rate limits for authentication, lobby commands, games, chat, and API reads.
- Add registered accounts with verified recovery, secure account linking, session management, and step-up protection for sensitive changes.
- Add report, block, mute, moderation, appeals, audit logging, and abuse-retention workflows.
- Add dependency and secret scanning in CI, security regression tests, SAST, a responsible-disclosure address, incident runbooks, backup/restore drills, and access reviews.
- Commission an independent penetration test after the architecture stabilizes and before handling money, prizes, or a large user base.
- Configure a custom production domain, Cloudflare WAF/rate-limit rules, bot controls, log redaction, alerts, and budget limits.

## Threats explicitly considered

- Illegal moves, turn spoofing, clock manipulation, replayed commands, reconnect abuse, and spectator moves.
- Cross-site WebSocket hijacking, cross-site request forgery, script injection, clickjacking, oversized messages, and reconnect floods.
- Session token theft, database leakage, account enumeration, abusive chat, automated scraping, and denial of service.

Any security report should identify the affected route or game, expected impact, and reproducible steps without accessing other users' data.
