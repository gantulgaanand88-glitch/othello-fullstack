use othello_engine::{Player, Position, Winner};
use serde::{Deserialize, Serialize};

pub const PROTOCOL_VERSION: u16 = 1;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type", content = "payload", rename_all = "snake_case")]
pub enum ClientMessage {
    Ping { sent_at: u64 },
    QueueJoin { mode: QueueMode },
    QueueLeave,
    RoomCreate,
    RoomJoin { code: String },
    BotStart { level: u8, color: ColorChoice },
    GameResume { game_id: String, last_revision: u64 },
    Move { square: u8, command_id: String },
    Resign { command_id: String },
    DrawOffer { command_id: String },
    DrawResponse { accept: bool, command_id: String },
    Rematch { command_id: String },
    Chat { body: String, command_id: String },
    Spectate { game_id: String },
    ListLiveGames,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum QueueMode {
    Casual,
    Ranked,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ColorChoice {
    Black,
    White,
    Random,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type", content = "payload", rename_all = "snake_case")]
pub enum ServerMessage {
    Connected {
        protocol: u16,
        connection_id: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        role: Option<Player>,
    },
    Pong {
        sent_at: u64,
    },
    Error {
        code: String,
        message: String,
        command_id: Option<String>,
    },
    QueueJoined {
        joined_at: u64,
        mode: QueueMode,
    },
    QueueLeft,
    RoomCreated {
        code: String,
    },
    MatchFound {
        game_id: String,
        ticket: String,
        color: Player,
        opponent: PlayerSummary,
        snapshot: GameSnapshot,
    },
    Snapshot(GameSnapshot),
    GameFinished {
        snapshot: GameSnapshot,
        reason: FinishReason,
    },
    Presence {
        user_id: String,
        online: bool,
        reconnect_deadline: Option<u64>,
    },
    Chat(ChatMessage),
    DrawOffered {
        by: Player,
    },
    DrawDeclined,
    RematchRequested {
        by: Player,
    },
    LiveGames {
        games: Vec<LiveGame>,
    },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PlayerSummary {
    pub id: String,
    pub username: String,
    pub rating: i32,
    pub title: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ClockSnapshot {
    pub black_ms: u64,
    pub white_ms: u64,
    pub running: Option<Player>,
    pub server_now: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct MoveSnapshot {
    pub ply: u8,
    pub player: Player,
    pub square: u8,
    pub flipped: Vec<u8>,
    pub played_at: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct GameSnapshot {
    pub game_id: String,
    pub revision: u64,
    pub board: Vec<Option<Player>>,
    pub turn: Player,
    pub legal_moves: Vec<u8>,
    pub black_score: u8,
    pub white_score: u8,
    pub winner: Option<Winner>,
    pub last_move: Option<MoveSnapshot>,
    pub clock: ClockSnapshot,
}

impl GameSnapshot {
    #[must_use]
    pub fn from_position(game_id: impl Into<String>, revision: u64, position: Position) -> Self {
        let (black_score, white_score) = position.score();
        Self {
            game_id: game_id.into(),
            revision,
            board: position.cells().into_iter().collect(),
            turn: position.turn(),
            legal_moves: position.legal_move_list(),
            black_score,
            white_score,
            winner: position.winner(),
            last_move: None,
            clock: ClockSnapshot {
                black_ms: 300_000,
                white_ms: 300_000,
                running: Some(position.turn()),
                server_now: 0,
            },
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FinishReason {
    BoardComplete,
    Resignation,
    Timeout,
    Disconnect,
    DrawAgreement,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ChatMessage {
    pub id: String,
    pub sender_id: String,
    pub sender_name: String,
    pub body: String,
    pub sent_at: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct LiveGame {
    pub game_id: String,
    pub black: PlayerSummary,
    pub white: PlayerSummary,
    pub black_score: u8,
    pub white_score: u8,
    pub spectators: u32,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn protocol_messages_have_stable_tagged_json() {
        let message = ClientMessage::Move {
            square: 19,
            command_id: "cmd_01".into(),
        };
        let json = serde_json::to_string(&message).expect("serialize");
        assert_eq!(
            json,
            r#"{"type":"move","payload":{"square":19,"command_id":"cmd_01"}}"#
        );
    }

    #[test]
    fn snapshots_are_browser_ready() {
        let snapshot = GameSnapshot::from_position("game_01", 0, Position::new());
        assert_eq!(snapshot.board.len(), 64);
        assert_eq!(snapshot.legal_moves, vec![19, 26, 37, 44]);
        assert_eq!((snapshot.black_score, snapshot.white_score), (2, 2));
    }
}
