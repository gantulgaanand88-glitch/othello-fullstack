use arena_protocol::{
    ChatMessage, ClientMessage, ClockSnapshot, FinishReason, GameSnapshot, MoveSnapshot,
    PROTOCOL_VERSION, PlayerSummary, QueueMode, ServerMessage,
};
use othello_engine::{Player, Position, Winner, choose_bot_move};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use worker::*;

#[derive(Debug, Serialize)]
struct HealthResponse {
    status: &'static str,
    service: &'static str,
    protocol: u16,
}

#[derive(Debug, Serialize, Deserialize)]
struct RankingRow {
    user_id: String,
    handle: String,
    display_name: String,
    country_code: Option<String>,
    title: Option<String>,
    rating: f64,
    games_played: i64,
}

#[derive(Debug, Serialize, Deserialize)]
struct PublicGameRow {
    id: String,
    status: String,
    #[serde(deserialize_with = "deserialize_sqlite_bool")]
    rated: bool,
    pool: String,
    black_handle: Option<String>,
    white_handle: Option<String>,
    result: Option<String>,
    finish_reason: Option<String>,
    final_black_score: Option<i64>,
    final_white_score: Option<i64>,
    created_at: i64,
    finished_at: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize)]
struct PublicUser {
    id: String,
    handle: String,
    display_name: String,
    country_code: Option<String>,
    title: Option<String>,
}

#[derive(Debug, Serialize)]
struct SessionResponse {
    user: Option<PublicUser>,
}

fn websocket_upgrade_response(req: &Request, websocket: WebSocket) -> Result<Response> {
    let headers = Headers::new();
    let expected_protocol = format!("othello.v{PROTOCOL_VERSION}");
    if req
        .headers()
        .get("Sec-WebSocket-Protocol")?
        .is_some_and(|protocols| {
            protocols
                .split(',')
                .any(|protocol| protocol.trim() == expected_protocol)
        })
    {
        headers.set("Sec-WebSocket-Protocol", &expected_protocol)?;
    }
    Ok(Response::from_websocket(websocket)?.with_headers(headers))
}

#[event(fetch, respond_with_errors)]
pub async fn main(req: Request, env: Env, _ctx: Context) -> Result<Response> {
    let path = req.path();

    if path == "/api/health" {
        return Response::from_json(&HealthResponse {
            status: "ok",
            service: "othello-arena-edge",
            protocol: PROTOCOL_VERSION,
        });
    }

    if path == "/api/engine/opening" {
        return Response::from_json(&GameSnapshot::from_position("preview", 0, Position::new()));
    }

    if path == "/api/auth/guest" {
        if req.method() != Method::Post {
            return Response::error("Method not allowed", 405);
        }
        let now = Date::now().as_millis() as i64;
        let user_id = uuid_from_entropy()?;
        let suffix: String = user_id
            .chars()
            .filter(|character| *character != '-')
            .take(8)
            .collect();
        let handle = format!("Guest{suffix}");
        let session_id = uuid_from_entropy()?;
        let token = format!("{}{}", uuid_from_entropy()?, uuid_from_entropy()?);
        let digest = token_digest(&token);
        let expires_at = now + 30 * 24 * 60 * 60 * 1000;
        let db = env.d1("DB")?;
        db.prepare(
            "INSERT INTO users(id, handle, display_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
        )
        .bind(&[
            user_id.clone().into(),
            handle.clone().into(),
            handle.clone().into(),
            (now as f64).into(),
            (now as f64).into(),
        ])?
        .run()
        .await?;
        db.prepare(
            "INSERT INTO sessions(id, user_id, token_digest, created_at, expires_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(&[
            session_id.into(),
            user_id.clone().into(),
            digest.into(),
            (now as f64).into(),
            (expires_at as f64).into(),
            (now as f64).into(),
        ])?
        .run()
        .await?;
        let mut response = Response::from_json(&SessionResponse {
            user: Some(PublicUser {
                id: user_id,
                handle: handle.clone(),
                display_name: handle,
                country_code: None,
                title: None,
            }),
        })?;
        response.headers_mut().set(
            "Set-Cookie",
            &format!(
                "arena_session={token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000"
            ),
        )?;
        return Ok(response);
    }

    if path == "/api/me" {
        if req.method() != Method::Get {
            return Response::error("Method not allowed", 405);
        }
        let Some(token) = session_cookie(&req)? else {
            return Response::from_json(&SessionResponse { user: None });
        };
        let now = Date::now().as_millis() as i64;
        let db = env.d1("DB")?;
        let query = db.prepare(
            "SELECT u.id, u.handle, u.display_name, u.country_code, u.title \
             FROM sessions s JOIN users u ON u.id = s.user_id \
             WHERE s.token_digest = ? AND s.revoked_at IS NULL AND s.expires_at > ? \
             AND u.status = 'active' LIMIT 1",
        );
        return match query
            .bind(&[token_digest(&token).into(), (now as f64).into()])?
            .first::<PublicUser>(None)
            .await?
        {
            Some(user) => Response::from_json(&SessionResponse { user: Some(user) }),
            None => Response::from_json(&SessionResponse { user: None }),
        };
    }

    if path == "/api/auth/logout" {
        if req.method() != Method::Post {
            return Response::error("Method not allowed", 405);
        }
        if let Some(token) = session_cookie(&req)? {
            env.d1("DB")?
                .prepare("UPDATE sessions SET revoked_at = ? WHERE token_digest = ?")
                .bind(&[
                    (Date::now().as_millis() as f64).into(),
                    token_digest(&token).into(),
                ])?
                .run()
                .await?;
        }
        let mut response = Response::empty()?;
        response.headers_mut().set(
            "Set-Cookie",
            "arena_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0",
        )?;
        return Ok(response);
    }

    if path == "/api/rankings" {
        let pool = req
            .url()?
            .query_pairs()
            .find(|(key, _)| key == "pool")
            .map(|(_, value)| value.into_owned())
            .unwrap_or_else(|| "rapid".into());
        if !matches!(
            pool.as_str(),
            "bullet" | "blitz" | "rapid" | "classical" | "correspondence"
        ) {
            return Response::error("Unknown rating pool", 400);
        }
        let db = env.d1("DB")?;
        let query = db.prepare(
            "SELECT r.user_id, u.handle, u.display_name, u.country_code, u.title, \
                    r.rating, r.games_played \
             FROM ratings r JOIN users u ON u.id = r.user_id \
             WHERE r.pool = ? AND u.status = 'active' \
             ORDER BY r.rating DESC, r.games_played DESC LIMIT 100",
        );
        let rows = query
            .bind(&[pool.into()])?
            .all()
            .await?
            .results::<RankingRow>()?;
        return Response::from_json(&rows);
    }

    if let Some(game_id) = path.strip_prefix("/api/games/") {
        if game_id.is_empty() || game_id.len() > 80 {
            return Response::error("Invalid game id", 400);
        }
        let db = env.d1("DB")?;
        let query = db.prepare(
            "SELECT g.id, g.status, g.rated, g.pool, black.handle AS black_handle, \
                    white.handle AS white_handle, g.result, g.finish_reason, \
                    g.final_black_score, g.final_white_score, g.created_at, g.finished_at \
             FROM games g \
             LEFT JOIN users black ON black.id = g.black_user_id \
             LEFT JOIN users white ON white.id = g.white_user_id \
             WHERE g.id = ? LIMIT 1",
        );
        return match query
            .bind(&[game_id.into()])?
            .first::<PublicGameRow>(None)
            .await?
        {
            Some(game) => Response::from_json(&game),
            None => Response::error("Game not found", 404),
        };
    }

    if let Some(game_id) = path.strip_prefix("/ws/game/") {
        if game_id.is_empty() {
            return Response::error("Missing game id", 400);
        }
        let namespace = env.durable_object("GAME_ROOM")?;
        let stub = namespace.id_from_name(game_id)?.get_stub()?;
        return stub.fetch_with_request(req).await;
    }

    if path == "/ws/lobby" {
        let namespace = env.durable_object("LOBBY")?;
        let stub = namespace.id_from_name("global-v1")?.get_stub()?;
        return stub.fetch_with_request(req).await;
    }

    Response::error("Not found", 404)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct SocketAttachment {
    connection_id: String,
    role: String,
}

#[derive(Debug, Deserialize)]
struct StoredGame {
    position_json: String,
    revision: i64,
}

#[derive(Debug, Deserialize)]
struct StoredMove {
    ply: i64,
    player: String,
    square: i64,
    flipped_json: String,
    played_at: i64,
}

#[derive(Debug, Deserialize)]
struct StoredFinish {
    winner: String,
}

#[derive(Debug, Deserialize)]
struct StoredClock {
    black_ms: i64,
    white_ms: i64,
    running: String,
    last_started_at: i64,
}

#[derive(Debug, Deserialize)]
struct StoredIdentity {
    public_game_id: String,
}

#[durable_object]
pub struct GameRoom {
    state: State,
    sql: SqlStorage,
    env: Env,
}

impl GameRoom {
    fn load(&self) -> Result<(Position, u64)> {
        let rows: Vec<StoredGame> = self
            .sql
            .exec(
                "SELECT position_json, revision FROM game_state WHERE singleton = 1 LIMIT 1",
                None,
            )?
            .to_array()?;
        let row = rows
            .first()
            .ok_or_else(|| Error::RustError("missing game state".into()))?;
        let position = serde_json::from_str(&row.position_json)
            .map_err(|error| Error::RustError(format!("invalid stored game: {error}")))?;
        Ok((position, row.revision.max(0) as u64))
    }

    fn save(&self, position: Position, revision: u64) -> Result<()> {
        let payload = serde_json::to_string(&position)
            .map_err(|error| Error::RustError(format!("serialize game: {error}")))?;
        self.sql.exec(
            "UPDATE game_state SET position_json = ?, revision = ? WHERE singleton = 1",
            Some(vec![payload.into(), (revision as i64).into()]),
        )?;
        Ok(())
    }

    fn snapshot(&self) -> Result<GameSnapshot> {
        let (position, revision) = self.load()?;
        let mut snapshot = GameSnapshot::from_position(self.public_game_id()?, revision, position);
        let moves: Vec<StoredMove> = self.sql.exec(
            "SELECT ply, player, square, flipped_json, played_at FROM game_moves ORDER BY ply DESC LIMIT 1",
            None,
        )?.to_array()?;
        if let Some(last) = moves.first() {
            snapshot.last_move = Some(MoveSnapshot {
                ply: last.ply.clamp(0, u8::MAX as i64) as u8,
                player: parse_player(&last.player)?,
                square: last.square.clamp(0, 63) as u8,
                flipped: serde_json::from_str(&last.flipped_json)
                    .map_err(|error| Error::RustError(format!("invalid stored flips: {error}")))?,
                played_at: last.played_at.max(0) as u64,
            });
        }
        if let Some(finish) = self.finish()? {
            snapshot.winner = Some(parse_winner(&finish.winner)?);
            snapshot.clock.running = None;
        } else {
            snapshot.clock = self.clock_snapshot()?;
        }
        Ok(snapshot)
    }

    fn public_game_id(&self) -> Result<String> {
        let rows: Vec<StoredIdentity> = self
            .sql
            .exec(
                "SELECT public_game_id FROM game_identity WHERE singleton = 1 LIMIT 1",
                None,
            )?
            .to_array()?;
        Ok(rows
            .first()
            .map(|identity| identity.public_game_id.clone())
            .unwrap_or_else(|| self.state.id().to_string()))
    }

    fn stored_clock(&self) -> Result<StoredClock> {
        let rows: Vec<StoredClock> = self
            .sql
            .exec(
                "SELECT black_ms, white_ms, running, last_started_at FROM game_clock WHERE singleton = 1 LIMIT 1",
                None,
            )?
            .to_array()?;
        rows.into_iter()
            .next()
            .ok_or_else(|| Error::RustError("missing game clock".into()))
    }

    fn clock_snapshot(&self) -> Result<ClockSnapshot> {
        let clock = self.stored_clock()?;
        let now = Date::now().as_millis();
        let elapsed = now.saturating_sub(clock.last_started_at.max(0) as u64);
        let running = parse_player(&clock.running)?;
        let mut black_ms = clock.black_ms.max(0) as u64;
        let mut white_ms = clock.white_ms.max(0) as u64;
        match running {
            Player::Black => black_ms = black_ms.saturating_sub(elapsed),
            Player::White => white_ms = white_ms.saturating_sub(elapsed),
        }
        Ok(ClockSnapshot {
            black_ms,
            white_ms,
            running: Some(running),
            server_now: now,
        })
    }

    fn advance_clock(&self, mover: Player, next: Option<Player>) -> Result<bool> {
        let clock = self.stored_clock()?;
        let now = Date::now().as_millis();
        let elapsed = now.saturating_sub(clock.last_started_at.max(0) as u64);
        let mut black_ms = clock.black_ms.max(0) as u64;
        let mut white_ms = clock.white_ms.max(0) as u64;
        let remaining = match mover {
            Player::Black => {
                black_ms = black_ms.saturating_sub(elapsed);
                black_ms
            }
            Player::White => {
                white_ms = white_ms.saturating_sub(elapsed);
                white_ms
            }
        };
        let running = next.unwrap_or(mover);
        self.sql.exec(
            "UPDATE game_clock SET black_ms = ?, white_ms = ?, running = ?, last_started_at = ? WHERE singleton = 1",
            Some(vec![
                (black_ms as i64).into(),
                (white_ms as i64).into(),
                player_name(running).into(),
                (now as i64).into(),
            ]),
        )?;
        if remaining == 0 {
            let winner = match mover {
                Player::Black => Winner::White,
                Player::White => Winner::Black,
            };
            self.save_finish(winner, FinishReason::Timeout)?;
            return Ok(true);
        }
        Ok(false)
    }

    async fn schedule_alarm(&self) -> Result<()> {
        if self.finish()?.is_some() {
            return Ok(());
        }
        let clock = self.clock_snapshot()?;
        let remaining = match clock.running {
            Some(Player::Black) => clock.black_ms,
            Some(Player::White) => clock.white_ms,
            None => return Ok(()),
        };
        self.state
            .storage()
            .set_alarm(std::time::Duration::from_millis(remaining.max(1)))
            .await
    }

    fn finish(&self) -> Result<Option<StoredFinish>> {
        let rows: Vec<StoredFinish> = self
            .sql
            .exec(
                "SELECT winner FROM game_finish WHERE singleton = 1 LIMIT 1",
                None,
            )?
            .to_array()?;
        Ok(rows.into_iter().next())
    }

    fn save_finish(&self, winner: Winner, reason: FinishReason) -> Result<()> {
        self.sql.exec(
            "INSERT OR REPLACE INTO game_finish(singleton, winner, reason) VALUES (1, ?, ?)",
            Some(vec![
                winner_name(winner).into(),
                finish_reason_name(reason).into(),
            ]),
        )?;
        Ok(())
    }

    async fn persist_finished(&self, reason: FinishReason) -> Result<()> {
        let snapshot = self.snapshot()?;
        let Some(winner) = snapshot.winner else {
            return Ok(());
        };
        self.env
            .d1("DB")?
            .prepare(
                "UPDATE games SET status = 'finished', result = ?, finish_reason = ?, \
                 final_black_score = ?, final_white_score = ?, finished_at = ? WHERE id = ?",
            )
            .bind(&[
                winner_name(winner).into(),
                finish_reason_name(reason).into(),
                (f64::from(snapshot.black_score)).into(),
                (f64::from(snapshot.white_score)).into(),
                (Date::now().as_millis() as f64).into(),
                snapshot.game_id.into(),
            ])?
            .run()
            .await?;
        Ok(())
    }

    fn player_for_socket(ws: &WebSocket) -> Result<Option<Player>> {
        let attachment = ws.deserialize_attachment::<SocketAttachment>()?;
        Ok(
            attachment.and_then(|attachment| match attachment.role.as_str() {
                "black" => Some(Player::Black),
                "white" => Some(Player::White),
                _ => None,
            }),
        )
    }

    fn connection_id(ws: &WebSocket) -> Result<String> {
        ws.deserialize_attachment::<SocketAttachment>()?
            .map(|attachment| attachment.connection_id)
            .ok_or_else(|| Error::RustError("missing websocket attachment".into()))
    }

    fn available_role(&self) -> &'static str {
        let mut black = false;
        let mut white = false;
        for socket in self.state.get_websockets() {
            if let Ok(Some(attachment)) = socket.deserialize_attachment::<SocketAttachment>() {
                black |= attachment.role == "black";
                white |= attachment.role == "white";
            }
        }
        if !black {
            "black"
        } else if !white {
            "white"
        } else {
            "spectator"
        }
    }

    fn record_move(&self, outcome: othello_engine::MoveOutcome, revision: u64) -> Result<()> {
        let flipped: Vec<u8> = (0..64)
            .filter(|square| outcome.flipped & (1_u64 << square) != 0)
            .collect();
        let flipped_json = serde_json::to_string(&flipped)
            .map_err(|error| Error::RustError(format!("serialize flips: {error}")))?;
        self.sql.exec(
            "INSERT INTO game_moves(ply, player, square, flipped_json, played_at) VALUES (?, ?, ?, ?, ?)",
            Some(vec![
                (revision as i64).into(),
                player_name(outcome.player).into(),
                (outcome.square as i64).into(),
                flipped_json.into(),
                (Date::now().as_millis() as i64).into(),
            ]),
        )?;
        Ok(())
    }

    fn bot_level(&self) -> Result<Option<u8>> {
        #[derive(Deserialize)]
        struct BotConfig {
            level: i64,
        }
        let rows: Vec<BotConfig> = self
            .sql
            .exec(
                "SELECT level FROM bot_config WHERE singleton = 1 LIMIT 1",
                None,
            )?
            .to_array()?;
        Ok(rows.first().map(|config| config.level.clamp(1, 10) as u8))
    }

    fn send(ws: &WebSocket, message: &ServerMessage) {
        if let Err(error) = ws.send(message) {
            console_warn!("websocket send failed: {error}");
        }
    }

    fn broadcast(&self, message: &ServerMessage) {
        for socket in self.state.get_websockets() {
            Self::send(&socket, message);
        }
    }
}

impl DurableObject for GameRoom {
    fn new(state: State, env: Env) -> Self {
        let sql = state.storage().sql();
        sql.exec(
            "CREATE TABLE IF NOT EXISTS game_state (\
                singleton INTEGER PRIMARY KEY CHECK (singleton = 1),\
                position_json TEXT NOT NULL,\
                revision INTEGER NOT NULL DEFAULT 0\
            )",
            None,
        )
        .expect("create game_state table");
        let opening = serde_json::to_string(&Position::new()).expect("serialize opening");
        sql.exec(
            "INSERT OR IGNORE INTO game_state(singleton, position_json, revision) VALUES (1, ?, 0)",
            Some(vec![opening.into()]),
        )
        .expect("initialize game state");
        sql.exec(
            "CREATE TABLE IF NOT EXISTS game_moves (\
                ply INTEGER PRIMARY KEY,\
                player TEXT NOT NULL,\
                square INTEGER NOT NULL,\
                flipped_json TEXT NOT NULL,\
                played_at INTEGER NOT NULL\
            )",
            None,
        )
        .expect("create game_moves table");
        sql.exec(
            "CREATE TABLE IF NOT EXISTS game_finish (\
                singleton INTEGER PRIMARY KEY CHECK (singleton = 1),\
                winner TEXT NOT NULL,\
                reason TEXT NOT NULL\
            )",
            None,
        )
        .expect("create game_finish table");
        sql.exec(
            "CREATE TABLE IF NOT EXISTS bot_config (\
                singleton INTEGER PRIMARY KEY CHECK (singleton = 1),\
                level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 10)\
            )",
            None,
        )
        .expect("create bot_config table");
        sql.exec(
            "CREATE TABLE IF NOT EXISTS game_clock (\
                singleton INTEGER PRIMARY KEY CHECK (singleton = 1),\
                black_ms INTEGER NOT NULL,\
                white_ms INTEGER NOT NULL,\
                running TEXT NOT NULL,\
                last_started_at INTEGER NOT NULL\
            )",
            None,
        )
        .expect("create game_clock table");
        sql.exec(
            "INSERT OR IGNORE INTO game_clock(singleton, black_ms, white_ms, running, last_started_at) VALUES (1, 300000, 300000, 'black', ?)",
            Some(vec![(Date::now().as_millis() as i64).into()]),
        )
        .expect("initialize game clock");
        sql.exec(
            "CREATE TABLE IF NOT EXISTS game_identity (\
                singleton INTEGER PRIMARY KEY CHECK (singleton = 1),\
                public_game_id TEXT NOT NULL\
            )",
            None,
        )
        .expect("create game_identity table");
        Self { state, sql, env }
    }

    async fn fetch(&self, req: Request) -> Result<Response> {
        if req.headers().get("Upgrade")?.as_deref() != Some("websocket") {
            return Response::error("Expected a WebSocket upgrade", 426);
        }

        if let Some(public_game_id) = req.path().strip_prefix("/ws/game/") {
            if !public_game_id.is_empty() && public_game_id.len() <= 80 {
                self.sql.exec(
                    "INSERT OR IGNORE INTO game_identity(singleton, public_game_id) VALUES (1, ?)",
                    Some(vec![public_game_id.into()]),
                )?;
            }
        }

        if let Some(bot_game) = req.path().strip_prefix("/ws/game/bot-") {
            if let Some(level) = bot_game
                .split('-')
                .next()
                .and_then(|level| level.parse::<u8>().ok())
            {
                if (1..=10).contains(&level) {
                    self.sql.exec(
                        "INSERT OR IGNORE INTO bot_config(singleton, level) VALUES (1, ?)",
                        Some(vec![(i64::from(level)).into()]),
                    )?;
                }
            }
        }

        let pair = WebSocketPair::new()?;
        let connection_id = uuid_from_entropy()?;
        let role = self.available_role();
        pair.server.serialize_attachment(SocketAttachment {
            connection_id: connection_id.clone(),
            role: role.into(),
        })?;
        self.state.accept_web_socket(&pair.server);
        Self::send(
            &pair.server,
            &ServerMessage::Connected {
                protocol: PROTOCOL_VERSION,
                connection_id,
            },
        );
        Self::send(&pair.server, &ServerMessage::Snapshot(self.snapshot()?));
        self.schedule_alarm().await?;

        websocket_upgrade_response(&req, pair.client)
    }

    async fn websocket_message(
        &self,
        ws: WebSocket,
        message: WebSocketIncomingMessage,
    ) -> Result<()> {
        let WebSocketIncomingMessage::String(text) = message else {
            Self::send(
                &ws,
                &ServerMessage::Error {
                    code: "binary_not_supported".into(),
                    message: "Send UTF-8 JSON messages.".into(),
                    command_id: None,
                },
            );
            return Ok(());
        };

        let message: ClientMessage = match serde_json::from_str(&text) {
            Ok(message) => message,
            Err(error) => {
                Self::send(
                    &ws,
                    &ServerMessage::Error {
                        code: "invalid_message".into(),
                        message: format!(
                            "Message did not match protocol v{PROTOCOL_VERSION}: {error}"
                        ),
                        command_id: None,
                    },
                );
                return Ok(());
            }
        };

        match message {
            ClientMessage::Ping { sent_at } => {
                Self::send(&ws, &ServerMessage::Pong { sent_at });
            }
            ClientMessage::Move { square, command_id } => {
                let (mut position, revision) = self.load()?;
                let socket_player = Self::player_for_socket(&ws)?;
                if socket_player != Some(position.turn()) {
                    Self::send(
                        &ws,
                        &ServerMessage::Error {
                            code: "not_your_turn".into(),
                            message: "Only the assigned player may move on this turn.".into(),
                            command_id: Some(command_id),
                        },
                    );
                    return Ok(());
                }
                if self.finish()?.is_some() {
                    Self::send(
                        &ws,
                        &ServerMessage::Error {
                            code: "game_finished".into(),
                            message: "This game is already complete.".into(),
                            command_id: Some(command_id),
                        },
                    );
                    return Ok(());
                }
                match position.play(square) {
                    Ok(outcome) => {
                        if self.advance_clock(
                            outcome.player,
                            outcome.winner.is_none().then_some(position.turn()),
                        )? {
                            self.persist_finished(FinishReason::Timeout).await?;
                            self.broadcast(&ServerMessage::GameFinished {
                                snapshot: self.snapshot()?,
                                reason: FinishReason::Timeout,
                            });
                            return Ok(());
                        }
                        let mut revision = revision + 1;
                        self.save(position, revision)?;
                        self.record_move(outcome, revision)?;
                        if let Some(winner) = outcome.winner {
                            self.save_finish(winner, FinishReason::BoardComplete)?;
                            self.persist_finished(FinishReason::BoardComplete).await?;
                            self.broadcast(&ServerMessage::GameFinished {
                                snapshot: self.snapshot()?,
                                reason: FinishReason::BoardComplete,
                            });
                        } else {
                            if let Some(level) = self.bot_level()? {
                                if position.turn() == Player::White {
                                    self.broadcast(&ServerMessage::Snapshot(self.snapshot()?));
                                    if let Some(choice) = choose_bot_move(position, level, revision)
                                    {
                                        let bot_outcome =
                                            position.play(choice.square).map_err(|error| {
                                                Error::RustError(format!(
                                                    "bot produced an illegal move: {error}"
                                                ))
                                            })?;
                                        if self.advance_clock(
                                            bot_outcome.player,
                                            bot_outcome.winner.is_none().then_some(position.turn()),
                                        )? {
                                            self.persist_finished(FinishReason::Timeout).await?;
                                            self.broadcast(&ServerMessage::GameFinished {
                                                snapshot: self.snapshot()?,
                                                reason: FinishReason::Timeout,
                                            });
                                            return Ok(());
                                        }
                                        revision += 1;
                                        self.save(position, revision)?;
                                        self.record_move(bot_outcome, revision)?;
                                        if let Some(winner) = bot_outcome.winner {
                                            self.save_finish(winner, FinishReason::BoardComplete)?;
                                            self.persist_finished(FinishReason::BoardComplete)
                                                .await?;
                                            self.broadcast(&ServerMessage::GameFinished {
                                                snapshot: self.snapshot()?,
                                                reason: FinishReason::BoardComplete,
                                            });
                                            return Ok(());
                                        }
                                    }
                                }
                            }
                            self.broadcast(&ServerMessage::Snapshot(self.snapshot()?));
                        }
                        self.schedule_alarm().await?;
                    }
                    Err(error) => Self::send(
                        &ws,
                        &ServerMessage::Error {
                            code: "illegal_move".into(),
                            message: error.to_string(),
                            command_id: Some(command_id),
                        },
                    ),
                }
            }
            ClientMessage::GameResume {
                game_id: _,
                last_revision: _,
            } => {
                Self::send(&ws, &ServerMessage::Snapshot(self.snapshot()?));
            }
            ClientMessage::Resign { command_id } => {
                let Some(player) = Self::player_for_socket(&ws)? else {
                    Self::send(
                        &ws,
                        &ServerMessage::Error {
                            code: "spectator_command".into(),
                            message: "Spectators cannot resign a game.".into(),
                            command_id: Some(command_id),
                        },
                    );
                    return Ok(());
                };
                if self.finish()?.is_none() {
                    let winner = match player {
                        Player::Black => Winner::White,
                        Player::White => Winner::Black,
                    };
                    self.save_finish(winner, FinishReason::Resignation)?;
                    self.persist_finished(FinishReason::Resignation).await?;
                    self.broadcast(&ServerMessage::GameFinished {
                        snapshot: self.snapshot()?,
                        reason: FinishReason::Resignation,
                    });
                }
            }
            ClientMessage::Chat { body, command_id } => {
                let body: String = body.trim().chars().take(500).collect();
                if body.is_empty() {
                    Self::send(
                        &ws,
                        &ServerMessage::Error {
                            code: "empty_chat".into(),
                            message: "Chat messages cannot be empty.".into(),
                            command_id: Some(command_id),
                        },
                    );
                    return Ok(());
                }
                let sender_id = Self::connection_id(&ws)?;
                let sender_name = ws
                    .deserialize_attachment::<SocketAttachment>()?
                    .map(|attachment| attachment.role)
                    .unwrap_or_else(|| "spectator".into());
                self.broadcast(&ServerMessage::Chat(ChatMessage {
                    id: uuid_from_entropy()?,
                    sender_id,
                    sender_name,
                    body,
                    sent_at: Date::now().as_millis(),
                }));
            }
            ClientMessage::DrawOffer { command_id: _ } => {
                let Some(player) = Self::player_for_socket(&ws)? else {
                    Self::send(
                        &ws,
                        &ServerMessage::Error {
                            code: "spectator_command".into(),
                            message: "Spectators cannot offer a draw.".into(),
                            command_id: None,
                        },
                    );
                    return Ok(());
                };
                self.broadcast(&ServerMessage::DrawOffered { by: player });
            }
            _ => Self::send(
                &ws,
                &ServerMessage::Error {
                    code: "not_available_in_vertical_slice".into(),
                    message: "This command belongs to the next implementation milestone.".into(),
                    command_id: None,
                },
            ),
        }

        Ok(())
    }

    async fn websocket_close(
        &self,
        _ws: WebSocket,
        _code: usize,
        _reason: String,
        _was_clean: bool,
    ) -> Result<()> {
        Ok(())
    }

    async fn alarm(&self) -> Result<Response> {
        if self.finish()?.is_some() {
            return Response::empty();
        }
        let running = parse_player(&self.stored_clock()?.running)?;
        if self.advance_clock(running, Some(running))? {
            self.persist_finished(FinishReason::Timeout).await?;
            self.broadcast(&ServerMessage::GameFinished {
                snapshot: self.snapshot()?,
                reason: FinishReason::Timeout,
            });
        } else {
            self.schedule_alarm().await?;
        }
        Response::empty()
    }
}

#[durable_object]
pub struct Lobby {
    state: State,
    sql: SqlStorage,
    env: Env,
}

#[derive(Debug, Deserialize)]
struct QueuedConnection {
    connection_id: String,
}

#[derive(Debug, Deserialize)]
struct PrivateRoom {
    owner_connection_id: String,
}

impl Lobby {
    fn attachment(ws: &WebSocket) -> Result<SocketAttachment> {
        ws.deserialize_attachment::<SocketAttachment>()?
            .ok_or_else(|| Error::RustError("missing lobby attachment".into()))
    }

    fn socket_by_id(&self, connection_id: &str) -> Option<WebSocket> {
        self.state.get_websockets().into_iter().find(|socket| {
            socket
                .deserialize_attachment::<SocketAttachment>()
                .ok()
                .flatten()
                .is_some_and(|attachment| attachment.connection_id == connection_id)
        })
    }

    fn guest(connection_id: &str) -> PlayerSummary {
        let suffix: String = connection_id
            .chars()
            .filter(|character| *character != '-')
            .take(6)
            .collect();
        PlayerSummary {
            id: connection_id.into(),
            username: format!("Guest-{suffix}"),
            rating: 1500,
            title: None,
        }
    }

    async fn pair(&self, first: &WebSocket, second: &WebSocket, rated: bool) -> Result<()> {
        let first_id = Self::attachment(first)?.connection_id;
        let second_id = Self::attachment(second)?.connection_id;
        let game_id = uuid_from_entropy()?;
        self.persist_game(&game_id, rated).await?;
        let snapshot = GameSnapshot::from_position(game_id.clone(), 0, Position::new());
        GameRoom::send(
            first,
            &ServerMessage::MatchFound {
                game_id: game_id.clone(),
                color: Player::Black,
                opponent: Self::guest(&second_id),
                snapshot: snapshot.clone(),
            },
        );
        GameRoom::send(
            second,
            &ServerMessage::MatchFound {
                game_id,
                color: Player::White,
                opponent: Self::guest(&first_id),
                snapshot,
            },
        );
        Ok(())
    }

    async fn persist_game(&self, game_id: &str, rated: bool) -> Result<()> {
        let now = Date::now().as_millis() as f64;
        self.env
            .d1("DB")?
            .prepare(
                "INSERT OR IGNORE INTO games(\
                    id, status, rated, pool, initial_ms, increment_ms, created_at, started_at, durable_object_id, protocol_version\
                 ) VALUES (?, 'playing', ?, 'rapid', 300000, 0, ?, ?, ?, ?)",
            )
            .bind(&[
                game_id.into(),
                rated.into(),
                now.into(),
                now.into(),
                game_id.into(),
                (f64::from(PROTOCOL_VERSION)).into(),
            ])?
            .run()
            .await?;
        Ok(())
    }

    fn remove_connection(&self, connection_id: &str) -> Result<()> {
        self.sql.exec(
            "DELETE FROM match_queue WHERE connection_id = ?",
            Some(vec![connection_id.into()]),
        )?;
        self.sql.exec(
            "DELETE FROM private_rooms WHERE owner_connection_id = ?",
            Some(vec![connection_id.into()]),
        )?;
        Ok(())
    }
}

impl DurableObject for Lobby {
    fn new(state: State, env: Env) -> Self {
        let sql = state.storage().sql();
        sql.exec(
            "CREATE TABLE IF NOT EXISTS match_queue (\
                connection_id TEXT PRIMARY KEY,\
                mode TEXT NOT NULL,\
                joined_at INTEGER NOT NULL\
            )",
            None,
        )
        .expect("create match queue");
        sql.exec(
            "CREATE INDEX IF NOT EXISTS match_queue_order ON match_queue(mode, joined_at)",
            None,
        )
        .expect("create match queue index");
        sql.exec(
            "CREATE TABLE IF NOT EXISTS private_rooms (\
                code TEXT PRIMARY KEY,\
                owner_connection_id TEXT NOT NULL UNIQUE,\
                created_at INTEGER NOT NULL\
            )",
            None,
        )
        .expect("create private rooms");
        Self { state, sql, env }
    }

    async fn fetch(&self, req: Request) -> Result<Response> {
        if req.headers().get("Upgrade")?.as_deref() != Some("websocket") {
            return Response::error("Expected a WebSocket upgrade", 426);
        }
        let pair = WebSocketPair::new()?;
        let connection_id = uuid_from_entropy()?;
        self.state.accept_web_socket(&pair.server);
        pair.server.serialize_attachment(SocketAttachment {
            connection_id: connection_id.clone(),
            role: "lobby".into(),
        })?;
        GameRoom::send(
            &pair.server,
            &ServerMessage::Connected {
                protocol: PROTOCOL_VERSION,
                connection_id,
            },
        );
        websocket_upgrade_response(&req, pair.client)
    }

    async fn websocket_message(
        &self,
        ws: WebSocket,
        message: WebSocketIncomingMessage,
    ) -> Result<()> {
        let WebSocketIncomingMessage::String(text) = message else {
            GameRoom::send(
                &ws,
                &ServerMessage::Error {
                    code: "binary_not_supported".into(),
                    message: "Send UTF-8 JSON messages.".into(),
                    command_id: None,
                },
            );
            return Ok(());
        };
        let message: ClientMessage = match serde_json::from_str(&text) {
            Ok(message) => message,
            Err(error) => {
                GameRoom::send(
                    &ws,
                    &ServerMessage::Error {
                        code: "invalid_message".into(),
                        message: format!(
                            "Message did not match protocol v{PROTOCOL_VERSION}: {error}"
                        ),
                        command_id: None,
                    },
                );
                return Ok(());
            }
        };
        let connection_id = Self::attachment(&ws)?.connection_id;
        match message {
            ClientMessage::Ping { sent_at } => {
                GameRoom::send(&ws, &ServerMessage::Pong { sent_at })
            }
            ClientMessage::QueueJoin { mode } => {
                self.remove_connection(&connection_id)?;
                let mode_name = queue_mode_name(mode);
                let waiting: Vec<QueuedConnection> = self.sql.exec(
                    "SELECT connection_id FROM match_queue WHERE mode = ? AND connection_id != ? ORDER BY joined_at LIMIT 1",
                    Some(vec![mode_name.into(), connection_id.clone().into()]),
                )?.to_array()?;
                if let Some(waiting) = waiting.first() {
                    self.sql.exec(
                        "DELETE FROM match_queue WHERE connection_id = ?",
                        Some(vec![waiting.connection_id.clone().into()]),
                    )?;
                    if let Some(opponent) = self.socket_by_id(&waiting.connection_id) {
                        self.pair(&ws, &opponent, mode == QueueMode::Ranked).await?;
                    } else {
                        let joined_at = Date::now().as_millis();
                        self.sql.exec(
                            "INSERT INTO match_queue(connection_id, mode, joined_at) VALUES (?, ?, ?)",
                            Some(vec![connection_id.into(), mode_name.into(), (joined_at as i64).into()]),
                        )?;
                        GameRoom::send(&ws, &ServerMessage::QueueJoined { joined_at, mode });
                    }
                } else {
                    let joined_at = Date::now().as_millis();
                    self.sql.exec(
                        "INSERT INTO match_queue(connection_id, mode, joined_at) VALUES (?, ?, ?)",
                        Some(vec![
                            connection_id.into(),
                            mode_name.into(),
                            (joined_at as i64).into(),
                        ]),
                    )?;
                    GameRoom::send(&ws, &ServerMessage::QueueJoined { joined_at, mode });
                }
            }
            ClientMessage::QueueLeave => {
                self.remove_connection(&connection_id)?;
                GameRoom::send(&ws, &ServerMessage::QueueLeft);
            }
            ClientMessage::RoomCreate => {
                self.remove_connection(&connection_id)?;
                let code: String = uuid_from_entropy()?
                    .chars()
                    .filter(|character| *character != '-')
                    .take(6)
                    .collect::<String>()
                    .to_uppercase();
                self.sql.exec(
                    "INSERT INTO private_rooms(code, owner_connection_id, created_at) VALUES (?, ?, ?)",
                    Some(vec![code.clone().into(), connection_id.into(), (Date::now().as_millis() as i64).into()]),
                )?;
                GameRoom::send(&ws, &ServerMessage::RoomCreated { code });
            }
            ClientMessage::RoomJoin { code } => {
                let code: String = code
                    .chars()
                    .filter(|character| character.is_ascii_alphanumeric())
                    .take(8)
                    .collect::<String>()
                    .to_uppercase();
                let rooms: Vec<PrivateRoom> = self
                    .sql
                    .exec(
                        "SELECT owner_connection_id FROM private_rooms WHERE code = ? LIMIT 1",
                        Some(vec![code.clone().into()]),
                    )?
                    .to_array()?;
                let Some(room) = rooms.first() else {
                    GameRoom::send(
                        &ws,
                        &ServerMessage::Error {
                            code: "room_not_found".into(),
                            message: "That private room is unavailable.".into(),
                            command_id: None,
                        },
                    );
                    return Ok(());
                };
                if room.owner_connection_id == connection_id {
                    GameRoom::send(
                        &ws,
                        &ServerMessage::Error {
                            code: "room_owner_join".into(),
                            message: "Share the code with another player.".into(),
                            command_id: None,
                        },
                    );
                    return Ok(());
                }
                self.sql.exec(
                    "DELETE FROM private_rooms WHERE code = ?",
                    Some(vec![code.into()]),
                )?;
                match self.socket_by_id(&room.owner_connection_id) {
                    Some(owner) => self.pair(&owner, &ws, false).await?,
                    None => GameRoom::send(
                        &ws,
                        &ServerMessage::Error {
                            code: "room_expired".into(),
                            message: "The room owner disconnected.".into(),
                            command_id: None,
                        },
                    ),
                }
            }
            ClientMessage::BotStart { level, color: _ } => {
                if !(1..=10).contains(&level) {
                    GameRoom::send(
                        &ws,
                        &ServerMessage::Error {
                            code: "invalid_bot_level".into(),
                            message: "Bot level must be between 1 and 10.".into(),
                            command_id: None,
                        },
                    );
                    return Ok(());
                }
                let game_id = format!("bot-{level}-{}", uuid_from_entropy()?);
                self.persist_game(&game_id, false).await?;
                GameRoom::send(
                    &ws,
                    &ServerMessage::MatchFound {
                        game_id: game_id.clone(),
                        color: Player::Black,
                        opponent: PlayerSummary {
                            id: format!("bot-{level}"),
                            username: format!("Arena Bot {level}"),
                            rating: 900 + i32::from(level) * 150,
                            title: Some("BOT".into()),
                        },
                        snapshot: GameSnapshot::from_position(game_id, 0, Position::new()),
                    },
                );
            }
            ClientMessage::ListLiveGames => {
                GameRoom::send(&ws, &ServerMessage::LiveGames { games: vec![] })
            }
            _ => GameRoom::send(
                &ws,
                &ServerMessage::Error {
                    code: "lobby_command_only".into(),
                    message: "That command belongs on a game connection.".into(),
                    command_id: None,
                },
            ),
        }
        Ok(())
    }

    async fn websocket_close(
        &self,
        ws: WebSocket,
        _code: usize,
        _reason: String,
        _was_clean: bool,
    ) -> Result<()> {
        if let Ok(attachment) = Self::attachment(&ws) {
            self.remove_connection(&attachment.connection_id)?;
        }
        Ok(())
    }
}

fn uuid_from_entropy() -> Result<String> {
    Ok(uuid::Uuid::new_v4().to_string())
}

fn token_digest(token: &str) -> String {
    let digest = Sha256::digest(token.as_bytes());
    digest.iter().map(|byte| format!("{byte:02x}")).collect()
}

fn deserialize_sqlite_bool<'de, D>(deserializer: D) -> std::result::Result<bool, D::Error>
where
    D: serde::Deserializer<'de>,
{
    #[derive(Deserialize)]
    #[serde(untagged)]
    enum BoolOrInteger {
        Bool(bool),
        Integer(i64),
    }
    Ok(match BoolOrInteger::deserialize(deserializer)? {
        BoolOrInteger::Bool(value) => value,
        BoolOrInteger::Integer(value) => value != 0,
    })
}

fn session_cookie(req: &Request) -> Result<Option<String>> {
    let cookie = req.headers().get("Cookie")?.unwrap_or_default();
    Ok(cookie.split(';').find_map(|part| {
        let (name, value) = part.trim().split_once('=')?;
        (name == "arena_session" && !value.is_empty()).then(|| value.to_string())
    }))
}

fn player_name(player: Player) -> &'static str {
    match player {
        Player::Black => "black",
        Player::White => "white",
    }
}

fn parse_player(player: &str) -> Result<Player> {
    match player {
        "black" => Ok(Player::Black),
        "white" => Ok(Player::White),
        _ => Err(Error::RustError("invalid stored player".into())),
    }
}

fn winner_name(winner: Winner) -> &'static str {
    match winner {
        Winner::Black => "black",
        Winner::White => "white",
        Winner::Draw => "draw",
    }
}

fn parse_winner(winner: &str) -> Result<Winner> {
    match winner {
        "black" => Ok(Winner::Black),
        "white" => Ok(Winner::White),
        "draw" => Ok(Winner::Draw),
        _ => Err(Error::RustError("invalid stored winner".into())),
    }
}

fn finish_reason_name(reason: FinishReason) -> &'static str {
    match reason {
        FinishReason::BoardComplete => "board_complete",
        FinishReason::Resignation => "resignation",
        FinishReason::Timeout => "timeout",
        FinishReason::Disconnect => "disconnect",
        FinishReason::DrawAgreement => "draw_agreement",
    }
}

fn queue_mode_name(mode: QueueMode) -> &'static str {
    match mode {
        QueueMode::Casual => "casual",
        QueueMode::Ranked => "ranked",
    }
}
