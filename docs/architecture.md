# Architecture and reliability notes

The React client renders state received from Socket.IO. The backend owns the board, legal moves, timers, result, and rating calculation; clients only submit coordinates and user actions.

## Real-time lifecycle

- Queue, private-room, and active-game membership are mutually exclusive per user.
- Matchmaking reevaluates queued players every second, allowing the rating range to expand without requiring a third player to join.
- Moves are appended to MongoDB instead of replacing the full history after every turn.
- Disconnected players retain their seat for 30 seconds. Reauthentication followed by `resumeGame` restores authoritative state.
- Finished games remain in memory for up to 30 minutes so both players can request a rematch.

## Production boundary

Active games and timers are process-local. A restart loses active sessions, and multiple replicas cannot coordinate without shared state. Before horizontal scaling, add Redis for presence/queues, the Socket.IO Redis adapter, distributed locks, and recoverable game snapshots. MongoDB game finalization should also be moved into replica-set transactions for fully atomic user and game updates.
