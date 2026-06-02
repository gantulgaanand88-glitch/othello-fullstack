import {
  Board,
  Player,
  getLegalMoves,
  applyMove,
  getFlippedPieces,
  checkGameOver,
  calculateScore,
} from './othello';

export type BotDifficulty = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10';

function getOpponent(player: Player): Player {
  return player === 'black' ? 'white' : 'black';
}

function evaluateBoardExtended(board: Board, player: Player): number {
  const opponent = getOpponent(player);
  let score = 0;

  // Count scores
  const stats = calculateScore(board);
  const totalDiscs = stats.black + stats.white;
  const discDiff = player === 'black' ? (stats.black - stats.white) : (stats.white - stats.black);

  // 1. Corners occupancy & adjacent squares (X & C squares penalty adjusted by corner occupancy)
  const corners = [
    { r: 0, c: 0, adj: [{ r: 0, c: 1 }, { r: 1, c: 0 }, { r: 1, c: 1 }] },
    { r: 0, c: 7, adj: [{ r: 0, c: 6 }, { r: 1, c: 7 }, { r: 1, c: 6 }] },
    { r: 7, c: 0, adj: [{ r: 7, c: 1 }, { r: 6, c: 0 }, { r: 6, c: 1 }] },
    { r: 7, c: 7, adj: [{ r: 7, c: 6 }, { r: 6, c: 7 }, { r: 6, c: 6 }] }
  ];

  for (const corner of corners) {
    const owner = board[corner.r][corner.c];
    if (owner === player) {
      score += 150;
      // Adjust adjacent squares positively since corner is owned
      for (const adj of corner.adj) {
        if (board[adj.r][adj.c] === player) score += 20;
        else if (board[adj.r][adj.c] === opponent) score -= 20;
      }
    } else if (owner === opponent) {
      score -= 150;
      for (const adj of corner.adj) {
        if (board[adj.r][adj.c] === opponent) score -= 20;
        else if (board[adj.r][adj.c] === player) score += 20;
      }
    } else {
      // Corner is empty. Penalize occupying adjacent squares
      for (const adj of corner.adj) {
        const isXSquare = adj.r === corner.r + (corner.r === 0 ? 1 : -1) && adj.c === corner.c + (corner.c === 0 ? 1 : -1);
        const penalty = isXSquare ? 45 : 20;

        if (board[adj.r][adj.c] === player) score -= penalty;
        else if (board[adj.r][adj.c] === opponent) score += penalty;
      }
    }
  }

  // 2. Positional weight evaluation (excluding corners and corner-adjacent squares)
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const isCornerOrAdjacent = corners.some(corner => 
        (corner.r === r && corner.c === c) || 
        corner.adj.some(adj => adj.r === r && adj.c === c)
      );
      if (isCornerOrAdjacent) continue;

      const isEdge = r === 0 || r === 7 || c === 0 || c === 7;
      const squareWeight = isEdge ? 15 : 5;

      if (board[r][c] === player) {
        score += squareWeight;
      } else if (board[r][c] === opponent) {
        score -= squareWeight;
      }
    }
  }

  // 3. Mobility difference
  const playerMoves = getLegalMoves(board, player).length;
  const opponentMoves = getLegalMoves(board, opponent).length;
  const mobilityWeight = totalDiscs < 30 ? 25 : (totalDiscs < 50 ? 15 : 5);
  score += (playerMoves - opponentMoves) * mobilityWeight;

  // 4. Disc count weight
  if (totalDiscs > 48) {
    score += discDiff * 15;
  } else if (totalDiscs > 30) {
    score += discDiff * 2;
  } else {
    score -= discDiff * 3;
  }

  return score;
}

function orderMoves(board: Board, moves: [number, number][], player: Player): [number, number][] {
  const corners = [[0, 0], [0, 7], [7, 0], [7, 7]];
  const badAdjacents = [
    [0, 1], [1, 0], [1, 1],
    [0, 6], [1, 7], [1, 6],
    [7, 1], [6, 0], [6, 1],
    [7, 6], [6, 7], [6, 6]
  ];

  return [...moves].sort((a, b) => {
    const aIsCorner = corners.some(([r, c]) => r === a[0] && c === a[1]);
    const bIsCorner = corners.some(([r, c]) => r === b[0] && c === b[1]);
    if (aIsCorner && !bIsCorner) return -1;
    if (!aIsCorner && bIsCorner) return 1;

    const aIsBad = badAdjacents.some(([r, c]) => r === a[0] && c === a[1]);
    const bIsBad = badAdjacents.some(([r, c]) => r === b[0] && c === b[1]);
    if (aIsBad && !bIsBad) return 1;
    if (!aIsBad && bIsBad) return -1;

    const aIsEdge = a[0] === 0 || a[0] === 7 || a[1] === 0 || a[1] === 7;
    const bIsEdge = b[0] === 0 || b[0] === 7 || b[1] === 0 || b[1] === 7;
    if (aIsEdge && !bIsEdge) return -1;
    if (!aIsEdge && bIsEdge) return 1;

    const aFlipped = getFlippedPieces(board, a[0], a[1], player).length;
    const bFlipped = getFlippedPieces(board, b[0], b[1], player).length;
    return bFlipped - aFlipped;
  });
}

function minimax(
  board: Board,
  depth: number,
  alpha: number,
  beta: number,
  isMaximizing: boolean,
  botColor: Player,
): number {
  const currentPlayer = isMaximizing ? botColor : getOpponent(botColor);
  const legalMoves = getLegalMoves(board, currentPlayer);

  const gameOver = checkGameOver(board);
  if (gameOver.isOver) {
    if (gameOver.winner === botColor) return 20000 + depth;
    if (gameOver.winner === 'draw') return 0;
    if (gameOver.winner !== null) return -20000 - depth;
  }

  if (depth === 0) {
    return evaluateBoardExtended(board, botColor);
  }

  if (legalMoves.length === 0) {
    return minimax(board, depth - 1, alpha, beta, !isMaximizing, botColor);
  }

  const orderedMoves = orderMoves(board, legalMoves, currentPlayer);

  if (isMaximizing) {
    let maxEval = -Infinity;
    for (const [r, c] of orderedMoves) {
      const nextBoard = applyMove(board, r, c, botColor);
      const evaluation = minimax(nextBoard, depth - 1, alpha, beta, false, botColor);
      maxEval = Math.max(maxEval, evaluation);
      alpha = Math.max(alpha, evaluation);
      if (beta <= alpha) {
        break;
      }
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    const opponentColor = getOpponent(botColor);
    for (const [r, c] of orderedMoves) {
      const nextBoard = applyMove(board, r, c, opponentColor);
      const evaluation = minimax(nextBoard, depth - 1, alpha, beta, true, botColor);
      minEval = Math.min(minEval, evaluation);
      beta = Math.min(beta, evaluation);
      if (beta <= alpha) {
        break;
      }
    }
    return minEval;
  }
}

export function computeBotMove(
  board: Board,
  player: Player,
  difficulty: BotDifficulty,
): [number, number] {
  const legalMoves = getLegalMoves(board, player);

  if (legalMoves.length === 0) {
    throw new Error('No legal moves available for the bot.');
  }

  // Level 1: Novice Nebula (85% random, 15% greedy)
  if (difficulty === '1') {
    if (Math.random() < 0.85) {
      const randomIndex = Math.floor(Math.random() * legalMoves.length);
      return legalMoves[randomIndex];
    }
  }

  // Level 2: Comet Cadet (50% random, 50% greedy)
  if (difficulty === '2') {
    if (Math.random() < 0.50) {
      const randomIndex = Math.floor(Math.random() * legalMoves.length);
      return legalMoves[randomIndex];
    }
  }

  // Level 1 & 2 greedy fallbacks & Level 3: Meteor Scout (100% greedy)
  if (difficulty === '1' || difficulty === '2' || difficulty === '3') {
    let bestMove = legalMoves[0];
    let maxFlips = -1;

    for (const move of legalMoves) {
      const flips = getFlippedPieces(board, move[0], move[1], player).length;
      if (flips > maxFlips) {
        maxFlips = flips;
        bestMove = move;
      }
    }

    return bestMove;
  }

  // Determine search depth based on difficulty
  let depth = 1;
  if (difficulty === '4') depth = 1;
  else if (difficulty === '5') depth = 2;
  else if (difficulty === '6') depth = 3;
  else if (difficulty === '7') depth = 4;
  else if (difficulty === '8') depth = 5;
  else if (difficulty === '9') depth = 6;
  else if (difficulty === '10') depth = 6; // Cap depth at 6 to ensure <50ms response time and no event-loop block

  let bestMove = legalMoves[0];
  let bestScore = -Infinity;

  const orderedMoves = orderMoves(board, legalMoves, player);

  for (const move of orderedMoves) {
    const nextBoard = applyMove(board, move[0], move[1], player);
    const score = minimax(nextBoard, depth - 1, -Infinity, Infinity, false, player);

    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }

  return bestMove;
}
