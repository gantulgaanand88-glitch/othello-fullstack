//! Authoritative Othello rules and deterministic bot search.
//!
//! The board is represented by two `u64` bitboards. Bit zero is A8 (top-left
//! from Black's perspective), rows increase downward, and columns increase to
//! the right. The engine has no clock, network, or persistence dependencies.

use serde::{Deserialize, Serialize};
use thiserror::Error;

const BOARD_CELLS: u8 = 64;
const DIRECTIONS: [(i8, i8); 8] = [
    (-1, -1),
    (-1, 0),
    (-1, 1),
    (0, -1),
    (0, 1),
    (1, -1),
    (1, 0),
    (1, 1),
];

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Player {
    Black,
    White,
}

impl Player {
    #[must_use]
    pub const fn opponent(self) -> Self {
        match self {
            Self::Black => Self::White,
            Self::White => Self::Black,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Winner {
    Black,
    White,
    Draw,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Error)]
pub enum MoveError {
    #[error("square index must be between 0 and 63")]
    OutOfBounds,
    #[error("the square is occupied or captures no opponent discs")]
    IllegalMove,
    #[error("the game is already complete")]
    GameComplete,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct MoveOutcome {
    pub player: Player,
    pub square: u8,
    pub flipped: u64,
    pub passed: Option<Player>,
    pub winner: Option<Winner>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct Position {
    black: u64,
    white: u64,
    turn: Player,
    ply: u8,
}

impl Default for Position {
    fn default() -> Self {
        Self::new()
    }
}

impl Position {
    #[must_use]
    pub const fn new() -> Self {
        Self {
            black: (1_u64 << 28) | (1_u64 << 35),
            white: (1_u64 << 27) | (1_u64 << 36),
            turn: Player::Black,
            ply: 0,
        }
    }

    /// Construct a position for fixtures, migrations, and replay validation.
    pub fn from_bitboards(
        black: u64,
        white: u64,
        turn: Player,
        ply: u8,
    ) -> Result<Self, &'static str> {
        if black & white != 0 {
            return Err("black and white bitboards overlap");
        }
        Ok(Self {
            black,
            white,
            turn,
            ply,
        })
    }

    #[must_use]
    pub const fn black(self) -> u64 {
        self.black
    }

    #[must_use]
    pub const fn white(self) -> u64 {
        self.white
    }

    #[must_use]
    pub const fn turn(self) -> Player {
        self.turn
    }

    #[must_use]
    pub const fn ply(self) -> u8 {
        self.ply
    }

    #[must_use]
    pub const fn occupied(self) -> u64 {
        self.black | self.white
    }

    #[must_use]
    pub const fn pieces(self, player: Player) -> u64 {
        match player {
            Player::Black => self.black,
            Player::White => self.white,
        }
    }

    #[must_use]
    pub fn score(self) -> (u8, u8) {
        (self.black.count_ones() as u8, self.white.count_ones() as u8)
    }

    #[must_use]
    pub fn piece_at(self, square: u8) -> Option<Player> {
        if square >= BOARD_CELLS {
            return None;
        }
        let bit = 1_u64 << square;
        if self.black & bit != 0 {
            Some(Player::Black)
        } else if self.white & bit != 0 {
            Some(Player::White)
        } else {
            None
        }
    }

    #[must_use]
    pub fn flips_for(self, square: u8, player: Player) -> u64 {
        if square >= BOARD_CELLS || self.occupied() & (1_u64 << square) != 0 {
            return 0;
        }

        let own = self.pieces(player);
        let opponent = self.pieces(player.opponent());
        let row = (square / 8) as i8;
        let col = (square % 8) as i8;
        let mut flips = 0_u64;

        for (row_delta, col_delta) in DIRECTIONS {
            let mut next_row = row + row_delta;
            let mut next_col = col + col_delta;
            let mut captured = 0_u64;

            while (0..8).contains(&next_row) && (0..8).contains(&next_col) {
                let next_square = (next_row * 8 + next_col) as u8;
                let bit = 1_u64 << next_square;

                if opponent & bit != 0 {
                    captured |= bit;
                } else {
                    if own & bit != 0 && captured != 0 {
                        flips |= captured;
                    }
                    break;
                }

                next_row += row_delta;
                next_col += col_delta;
            }
        }

        flips
    }

    #[must_use]
    pub fn legal_moves_for(self, player: Player) -> u64 {
        let mut empty = !self.occupied();
        let mut legal = 0_u64;

        while empty != 0 {
            let square = empty.trailing_zeros() as u8;
            let bit = 1_u64 << square;
            if self.flips_for(square, player) != 0 {
                legal |= bit;
            }
            empty &= !bit;
        }

        legal
    }

    #[must_use]
    pub fn legal_moves(self) -> u64 {
        self.legal_moves_for(self.turn)
    }

    #[must_use]
    pub fn legal_move_list_for(self, player: Player) -> Vec<u8> {
        bit_indices(self.legal_moves_for(player))
    }

    #[must_use]
    pub fn legal_move_list(self) -> Vec<u8> {
        bit_indices(self.legal_moves())
    }

    #[must_use]
    pub fn is_complete(self) -> bool {
        self.occupied() == u64::MAX
            || (self.legal_moves_for(Player::Black) == 0
                && self.legal_moves_for(Player::White) == 0)
    }

    #[must_use]
    pub fn winner(self) -> Option<Winner> {
        if !self.is_complete() {
            return None;
        }
        let (black, white) = self.score();
        Some(match black.cmp(&white) {
            std::cmp::Ordering::Greater => Winner::Black,
            std::cmp::Ordering::Less => Winner::White,
            std::cmp::Ordering::Equal => Winner::Draw,
        })
    }

    pub fn play(&mut self, square: u8) -> Result<MoveOutcome, MoveError> {
        if square >= BOARD_CELLS {
            return Err(MoveError::OutOfBounds);
        }
        if self.is_complete() {
            return Err(MoveError::GameComplete);
        }

        let player = self.turn;
        let flips = self.flips_for(square, player);
        if flips == 0 {
            return Err(MoveError::IllegalMove);
        }

        let placed = 1_u64 << square;
        match player {
            Player::Black => {
                self.black |= placed | flips;
                self.white &= !flips;
            }
            Player::White => {
                self.white |= placed | flips;
                self.black &= !flips;
            }
        }
        self.ply = self.ply.saturating_add(1);

        let opponent = player.opponent();
        let passed = if self.legal_moves_for(opponent) != 0 {
            self.turn = opponent;
            None
        } else if self.legal_moves_for(player) != 0 {
            self.turn = player;
            Some(opponent)
        } else {
            self.turn = opponent;
            None
        };

        Ok(MoveOutcome {
            player,
            square,
            flipped: flips,
            passed,
            winner: self.winner(),
        })
    }

    #[must_use]
    pub fn cells(self) -> [Option<Player>; 64] {
        std::array::from_fn(|index| self.piece_at(index as u8))
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct BotChoice {
    pub square: u8,
    pub score: i32,
    pub searched_nodes: u32,
    pub depth: u8,
}

#[derive(Debug, Clone, Copy)]
struct SearchBudget {
    remaining: u32,
    searched: u32,
}

impl SearchBudget {
    fn visit(&mut self) -> bool {
        if self.remaining == 0 {
            return false;
        }
        self.remaining -= 1;
        self.searched += 1;
        true
    }
}

/// Choose a legal move for levels 1-10. The seed makes low-level random play
/// reproducible in tests, replays, and distributed workers.
pub fn choose_bot_move(position: Position, level: u8, seed: u64) -> Option<BotChoice> {
    let moves = position.legal_move_list();
    if moves.is_empty() {
        return None;
    }

    let level = level.clamp(1, 10);
    if level <= 2 {
        let random_index = (xorshift64(seed ^ u64::from(position.ply())) as usize) % moves.len();
        if level == 1 || xorshift64(seed.wrapping_add(17)) & 1 == 0 {
            return Some(BotChoice {
                square: moves[random_index],
                score: 0,
                searched_nodes: 0,
                depth: 0,
            });
        }
    }

    if level <= 3 {
        let square = moves
            .into_iter()
            .max_by_key(|candidate| position.flips_for(*candidate, position.turn()).count_ones())?;
        return Some(BotChoice {
            square,
            score: position.flips_for(square, position.turn()).count_ones() as i32,
            searched_nodes: 0,
            depth: 0,
        });
    }

    let depth = match level {
        4 => 2,
        5 => 3,
        6 => 4,
        7 => 5,
        8 => 6,
        9 => 7,
        _ => 8,
    };
    let node_limit = match level {
        4 => 2_000,
        5 => 8_000,
        6 => 25_000,
        7 => 75_000,
        8 => 180_000,
        9 => 420_000,
        _ => 850_000,
    };
    let bot = position.turn();
    let mut budget = SearchBudget {
        remaining: node_limit,
        searched: 0,
    };
    let mut ordered = moves;
    order_moves(position, &mut ordered, bot);

    let mut best_square = ordered[0];
    let mut best_score = i32::MIN;
    for square in ordered {
        if budget.remaining == 0 {
            break;
        }
        let mut next = position;
        if next.play(square).is_err() {
            continue;
        }
        let score = minimax(next, depth - 1, i32::MIN + 1, i32::MAX, bot, &mut budget);
        if score > best_score {
            best_score = score;
            best_square = square;
        }
    }

    Some(BotChoice {
        square: best_square,
        score: best_score,
        searched_nodes: budget.searched,
        depth,
    })
}

fn minimax(
    position: Position,
    depth: u8,
    mut alpha: i32,
    mut beta: i32,
    bot: Player,
    budget: &mut SearchBudget,
) -> i32 {
    if !budget.visit() || depth == 0 || position.is_complete() {
        return evaluate(position, bot);
    }

    let maximizing = position.turn() == bot;
    let mut moves = position.legal_move_list();
    if moves.is_empty() {
        return evaluate(position, bot);
    }
    order_moves(position, &mut moves, position.turn());

    if maximizing {
        let mut value = i32::MIN;
        for square in moves {
            let mut next = position;
            if next.play(square).is_ok() {
                value = value.max(minimax(next, depth - 1, alpha, beta, bot, budget));
                alpha = alpha.max(value);
                if alpha >= beta || budget.remaining == 0 {
                    break;
                }
            }
        }
        value
    } else {
        let mut value = i32::MAX;
        for square in moves {
            let mut next = position;
            if next.play(square).is_ok() {
                value = value.min(minimax(next, depth - 1, alpha, beta, bot, budget));
                beta = beta.min(value);
                if beta <= alpha || budget.remaining == 0 {
                    break;
                }
            }
        }
        value
    }
}

fn evaluate(position: Position, bot: Player) -> i32 {
    if let Some(winner) = position.winner() {
        return match (winner, bot) {
            (Winner::Draw, _) => 0,
            (Winner::Black, Player::Black) | (Winner::White, Player::White) => 100_000,
            _ => -100_000,
        };
    }

    const WEIGHTS: [i16; 64] = [
        120, -25, 20, 5, 5, 20, -25, 120, -25, -45, -5, -5, -5, -5, -45, -25, 20, -5, 15, 3, 3, 15,
        -5, 20, 5, -5, 3, 3, 3, 3, -5, 5, 5, -5, 3, 3, 3, 3, -5, 5, 20, -5, 15, 3, 3, 15, -5, 20,
        -25, -45, -5, -5, -5, -5, -45, -25, 120, -25, 20, 5, 5, 20, -25, 120,
    ];

    let own = position.pieces(bot);
    let opponent = position.pieces(bot.opponent());
    let mut positional = 0_i32;
    for (square, weight) in WEIGHTS.into_iter().enumerate() {
        let bit = 1_u64 << square;
        if own & bit != 0 {
            positional += i32::from(weight);
        } else if opponent & bit != 0 {
            positional -= i32::from(weight);
        }
    }

    let mobility = position.legal_moves_for(bot).count_ones() as i32
        - position.legal_moves_for(bot.opponent()).count_ones() as i32;
    let disc_difference = own.count_ones() as i32 - opponent.count_ones() as i32;
    let occupied = position.occupied().count_ones();
    let disc_weight = if occupied > 52 {
        8
    } else if occupied > 40 {
        2
    } else {
        -1
    };

    positional * 4 + mobility * 18 + disc_difference * disc_weight
}

fn order_moves(position: Position, moves: &mut [u8], player: Player) {
    moves.sort_unstable_by_key(|square| {
        let corner_bonus = if matches!(*square, 0 | 7 | 56 | 63) {
            10_000
        } else {
            0
        };
        let edge_bonus = if *square < 8 || *square >= 56 || *square % 8 == 0 || *square % 8 == 7 {
            500
        } else {
            0
        };
        let flips = position.flips_for(*square, player).count_ones() as i32;
        std::cmp::Reverse(corner_bonus + edge_bonus + flips)
    });
}

fn bit_indices(mut bits: u64) -> Vec<u8> {
    let mut indices = Vec::with_capacity(bits.count_ones() as usize);
    while bits != 0 {
        let square = bits.trailing_zeros() as u8;
        indices.push(square);
        bits &= bits - 1;
    }
    indices
}

const fn xorshift64(mut value: u64) -> u64 {
    if value == 0 {
        value = 0x9e37_79b9_7f4a_7c15;
    }
    value ^= value << 13;
    value ^= value >> 7;
    value ^ (value << 17)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn opening_position_is_canonical() {
        let position = Position::new();
        assert_eq!(position.score(), (2, 2));
        assert_eq!(position.turn(), Player::Black);
        assert_eq!(position.legal_move_list(), vec![19, 26, 37, 44]);
    }

    #[test]
    fn opening_move_flips_the_bracketed_disc() {
        let mut position = Position::new();
        let outcome = position.play(19).expect("D6 is legal");

        assert_eq!(outcome.player, Player::Black);
        assert_eq!(outcome.flipped, 1_u64 << 27);
        assert_eq!(position.score(), (4, 1));
        assert_eq!(position.turn(), Player::White);
        assert_eq!(position.piece_at(27), Some(Player::Black));
    }

    #[test]
    fn illegal_moves_do_not_mutate_the_position() {
        let mut position = Position::new();
        let before = position;
        assert_eq!(position.play(0), Err(MoveError::IllegalMove));
        assert_eq!(position, before);
        assert_eq!(position.play(64), Err(MoveError::OutOfBounds));
        assert_eq!(position, before);
    }

    #[test]
    fn deterministic_games_preserve_all_board_invariants() {
        for seed in 1_u64..=128 {
            let mut position = Position::new();
            let mut random = seed;
            let mut turns = 0;

            while !position.is_complete() {
                let legal = position.legal_move_list();
                assert!(!legal.is_empty(), "turn owner must have a legal move");
                random = xorshift64(random);
                let square = legal[(random as usize) % legal.len()];
                let occupied_before = position.occupied().count_ones();
                position.play(square).expect("selected move is legal");

                assert_eq!(position.black() & position.white(), 0);
                assert_eq!(position.occupied().count_ones(), occupied_before + 1);
                turns += 1;
                assert!(turns <= 60);
            }

            let (black, white) = position.score();
            assert_eq!(
                u16::from(black) + u16::from(white),
                u16::from(position.ply()) + 4
            );
            assert!(position.winner().is_some());
        }
    }

    #[test]
    fn every_bot_level_returns_a_legal_move() {
        let position = Position::new();
        let legal = position.legal_moves();

        for level in 1..=10 {
            let choice = choose_bot_move(position, level, 42).expect("opening has legal moves");
            assert_ne!(legal & (1_u64 << choice.square), 0, "level {level}");
        }
    }

    #[test]
    fn overlapping_fixture_bitboards_are_rejected() {
        assert_eq!(
            Position::from_bitboards(1, 1, Player::Black, 0),
            Err("black and white bitboards overlap")
        );
    }
}
