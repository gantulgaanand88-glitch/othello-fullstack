import { Types } from 'mongoose';
import { Server, Socket } from 'socket.io';
import crypto from 'crypto';

import {
  GameState,
  Player,
  createInitialGameState,
  processMove,
} from '../gameEngine/othello';
import { verifyAuthToken } from '../middleware/auth';
import { Game } from '../models/Game';
import { User } from '../models/User';
import { calculateElo } from '../utils/elo';

interface AuthenticatedSocketData {
  userId: string;
  username: string;
  rating: number;
  isGuest?: boolean;
}

interface QueueEntry extends AuthenticatedSocketData {
  socketId: string;
  joinedAt: number;
}

interface GamePlayer extends AuthenticatedSocketData {
  socketId: string;
  color: Player;
}

interface ActiveGame {
  gameId: string;
  dbGameId: string;
  blackPlayer: GamePlayer;
  whitePlayer: GamePlayer;
  state: GameState;
  rematchVotes: Set<string>;
  status: 'active' | 'finished' | 'abandoned';
  isCustomRoom: boolean;
}

interface CustomRoom {
  roomCode: string;
  host: QueueEntry;
  createdAt: number;
}

interface SocketWithUser extends Socket {
  data: {
    user?: AuthenticatedSocketData;
  };
}

const MATCH_RANGE_INITIAL = 150;
const MATCH_RANGE_EXPANDED = 300;
const RANGE_EXPAND_AFTER_MS = 10_000;
const STALE_GAME_CLEANUP_MS = 30 * 60_000; // 30 minutes
const STALE_ROOM_CLEANUP_MS = 15 * 60_000; // 15 minutes
const CLEANUP_INTERVAL_MS = 60_000; // Run cleanup every minute

export const matchmakingQueue: QueueEntry[] = [];
export const activeGames = new Map<string, ActiveGame>();
export const socketToGame = new Map<string, string>();
export const customRooms = new Map<string, CustomRoom>();

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

function allowedRatingRange(entry: QueueEntry): number {
  return Date.now() - entry.joinedAt >= RANGE_EXPAND_AFTER_MS
    ? MATCH_RANGE_EXPANDED
    : MATCH_RANGE_INITIAL;
}

function removeFromQueue(socketId: string): void {
  const index = matchmakingQueue.findIndex((entry) => entry.socketId === socketId);

  if (index >= 0) {
    matchmakingQueue.splice(index, 1);
  }
}

function getGamePlayer(activeGame: ActiveGame, userId: string): GamePlayer | null {
  if (activeGame.blackPlayer.userId === userId) {
    return activeGame.blackPlayer;
  }

  if (activeGame.whitePlayer.userId === userId) {
    return activeGame.whitePlayer;
  }

  return null;
}

async function authenticateSocket(socket: SocketWithUser, token: string): Promise<AuthenticatedSocketData | null> {
  try {
    const payload = verifyAuthToken(token);

    // Guest user - no DB lookup needed
    if (payload.userId.startsWith('guest_')) {
      const guestUser: AuthenticatedSocketData = {
        userId: payload.userId,
        username: `Guest_${payload.userId.slice(-4)}`,
        rating: 1200,
        isGuest: true,
      };
      socket.data.user = guestUser;
      return guestUser;
    }

    const user = await User.findById(payload.userId).select('username rating').lean();

    if (!user) {
      socket.emit('error', { message: 'Authentication failed.' });
      return null;
    }

    const authenticatedUser: AuthenticatedSocketData = {
      userId: String(user._id),
      username: user.username,
      rating: user.rating,
      isGuest: false,
    };

    socket.data.user = authenticatedUser;
    return authenticatedUser;
  } catch {
    socket.emit('error', { message: 'Authentication failed.' });
    return null;
  }
}

function emitGameFound(io: Server, activeGame: ActiveGame): void {
  const blackSocket = io.sockets.sockets.get(activeGame.blackPlayer.socketId);
  const whiteSocket = io.sockets.sockets.get(activeGame.whitePlayer.socketId);

  if (blackSocket) {
    blackSocket.join(activeGame.gameId);
    blackSocket.emit('gameFound', {
      gameId: activeGame.gameId,
      yourColor: 'black',
      opponent: {
        id: activeGame.whitePlayer.userId,
        username: activeGame.whitePlayer.username,
        rating: activeGame.whitePlayer.rating,
      },
      state: activeGame.state,
    });
  }

  if (whiteSocket) {
    whiteSocket.join(activeGame.gameId);
    whiteSocket.emit('gameFound', {
      gameId: activeGame.gameId,
      yourColor: 'white',
      opponent: {
        id: activeGame.blackPlayer.userId,
        username: activeGame.blackPlayer.username,
        rating: activeGame.blackPlayer.rating,
      },
      state: activeGame.state,
    });
  }
}

async function createActiveGame(io: Server, first: QueueEntry, second: QueueEntry, isCustomRoom = false): Promise<void> {
  const blackEntry = first.joinedAt <= second.joinedAt ? first : second;
  const whiteEntry = blackEntry.socketId === first.socketId ? second : first;

  const hasGuest = !!(blackEntry.isGuest || whiteEntry.isGuest);
  let dbGameId = '';

  if (!hasGuest) {
    const gameDocument = await Game.create({
      _id: new Types.ObjectId(),
      blackPlayer: new Types.ObjectId(blackEntry.userId),
      whitePlayer: new Types.ObjectId(whiteEntry.userId),
      moves: [],
      result: null,
      status: 'active',
      startTime: new Date(),
      endTime: null,
      blackRatingChange: 0,
      whiteRatingChange: 0,
    });
    dbGameId = gameDocument.id;
  } else {
    dbGameId = new Types.ObjectId().toHexString();
  }

  const activeGame: ActiveGame = {
    gameId: dbGameId,
    dbGameId,
    blackPlayer: {
      ...blackEntry,
      color: 'black',
    },
    whitePlayer: {
      ...whiteEntry,
      color: 'white',
    },
    state: createInitialGameState(),
    rematchVotes: new Set<string>(),
    status: 'active',
    isCustomRoom,
  };

  activeGames.set(activeGame.gameId, activeGame);
  socketToGame.set(blackEntry.socketId, activeGame.gameId);
  socketToGame.set(whiteEntry.socketId, activeGame.gameId);

  emitGameFound(io, activeGame);
}

async function tryMatchmake(io: Server): Promise<void> {
  matchmakingQueue.sort((a, b) => a.joinedAt - b.joinedAt);

  for (let index = 0; index < matchmakingQueue.length; index += 1) {
    const entry = matchmakingQueue[index];

    for (let candidateIndex = index + 1; candidateIndex < matchmakingQueue.length; candidateIndex += 1) {
      const candidate = matchmakingQueue[candidateIndex];
      const ratingDifference = Math.abs(entry.rating - candidate.rating);

      if (
        ratingDifference <= allowedRatingRange(entry) &&
        ratingDifference <= allowedRatingRange(candidate)
      ) {
        matchmakingQueue.splice(candidateIndex, 1);
        matchmakingQueue.splice(index, 1);
        await createActiveGame(io, entry, candidate);
        await tryMatchmake(io);
        return;
      }
    }
  }
}

async function persistMoves(activeGame: ActiveGame): Promise<void> {
  const hasGuest = !!(activeGame.blackPlayer.isGuest || activeGame.whitePlayer.isGuest);
  if (hasGuest) return;

  await Game.findByIdAndUpdate(activeGame.dbGameId, {
    $set: {
      moves: activeGame.state.moveHistory.map((move) => ({
        player: move.player,
        row: move.row,
        col: move.col,
        flipped: move.flipped,
        blackScore: move.blackScore,
        whiteScore: move.whiteScore,
        timestamp: new Date(move.timestamp),
      })),
      status: activeGame.status,
    },
  });
}

function getResultForBlack(winner: Player | 'draw' | null): 'win' | 'loss' | 'draw' {
  if (winner === 'black') {
    return 'win';
  }

  if (winner === 'white') {
    return 'loss';
  }

  return 'draw';
}

async function finishGame(
  io: Server,
  activeGame: ActiveGame,
  winner: Player | 'draw' | null,
  reason: string,
  status: 'finished' | 'abandoned',
): Promise<void> {
  if (activeGame.status !== 'active') {
    return;
  }

  activeGame.status = status;
  activeGame.state = {
    ...activeGame.state,
    gameStatus: 'finished',
    winner,
    legalMoves: [],
  };

  const hasGuest = !!(activeGame.blackPlayer.isGuest || activeGame.whitePlayer.isGuest);

  let eloChangeA = 0;
  let eloChangeB = 0;
  let newRatingA = activeGame.blackPlayer.rating;
  let newRatingB = activeGame.whitePlayer.rating;

  if (!hasGuest) {
    const [blackUser, whiteUser] = await Promise.all([
      User.findById(activeGame.blackPlayer.userId),
      User.findById(activeGame.whitePlayer.userId),
    ]);

    if (blackUser && whiteUser) {
      const elo = calculateElo(
        blackUser.rating,
        whiteUser.rating,
        blackUser.gamesPlayed,
        whiteUser.gamesPlayed,
        getResultForBlack(winner),
      );

      blackUser.rating = elo.newRatingA;
      whiteUser.rating = elo.newRatingB;
      blackUser.gamesPlayed += 1;
      whiteUser.gamesPlayed += 1;

      if (winner === 'black') {
        blackUser.wins += 1;
        whiteUser.losses += 1;
      } else if (winner === 'white') {
        blackUser.losses += 1;
        whiteUser.wins += 1;
      } else {
        blackUser.draws += 1;
        whiteUser.draws += 1;
      }

      await Promise.all([
        blackUser.save(),
        whiteUser.save(),
        Game.findByIdAndUpdate(activeGame.dbGameId, {
          $set: {
            moves: activeGame.state.moveHistory.map((move) => ({
              player: move.player,
              row: move.row,
              col: move.col,
              flipped: move.flipped,
              blackScore: move.blackScore,
              whiteScore: move.whiteScore,
              timestamp: new Date(move.timestamp),
            })),
            result: winner,
            status,
            endTime: new Date(),
            blackRatingChange: elo.changeA,
            whiteRatingChange: elo.changeB,
          },
        }),
      ]);

      eloChangeA = elo.changeA;
      eloChangeB = elo.changeB;
      newRatingA = elo.newRatingA;
      newRatingB = elo.newRatingB;
    }
  }

  const recipients: Array<{ player: GamePlayer; result: 'win' | 'loss' | 'draw'; ratingChange: number; newRating: number }> = [
    {
      player: activeGame.blackPlayer,
      result: winner === 'black' ? 'win' : winner === 'white' ? 'loss' : 'draw',
      ratingChange: eloChangeA,
      newRating: newRatingA,
    },
    {
      player: activeGame.whitePlayer,
      result: winner === 'white' ? 'win' : winner === 'black' ? 'loss' : 'draw',
      ratingChange: eloChangeB,
      newRating: newRatingB,
    },
  ];

  socketToGame.delete(activeGame.blackPlayer.socketId);
  socketToGame.delete(activeGame.whitePlayer.socketId);

  for (const recipient of recipients) {
    const socket = io.sockets.sockets.get(recipient.player.socketId);

    if (!socket) {
      continue;
    }

    socket.emit('gameOver', {
      result: recipient.result,
      reason,
      winner,
      finalState: activeGame.state,
    });

    if (!hasGuest) {
      socket.emit('ratingUpdate', {
        newRating: recipient.newRating,
        ratingChange: recipient.ratingChange,
      });
    }
  }
}

export function initializeGameSocket(io: Server): void {
  // Periodic cleanup of stale finished games and abandoned rooms
  setInterval(() => {
    const now = Date.now();

    // Remove finished/abandoned games older than 30 minutes
    for (const [gameId, game] of activeGames) {
      if (game.status !== 'active') {
        activeGames.delete(gameId);
      }
    }

    // Remove stale custom rooms older than 15 minutes
    for (const [code, room] of customRooms) {
      if (now - room.createdAt > STALE_ROOM_CLEANUP_MS) {
        customRooms.delete(code);
        const hostSocket = io.sockets.sockets.get(room.host.socketId);
        hostSocket?.emit('roomCancelled');
      }
    }
  }, CLEANUP_INTERVAL_MS);

  io.on('connection', (socket: Socket) => {
    const typedSocket = socket as SocketWithUser;

    socket.on('authenticate', async ({ token }: { token: string }) => {
      await authenticateSocket(typedSocket, token);
    });

    socket.on('joinQueue', async ({ token }: { token?: string; rating?: number }) => {
      const authenticatedUser = typedSocket.data.user ?? (token ? await authenticateSocket(typedSocket, token) : null);

      if (!authenticatedUser) {
        socket.emit('error', { message: 'You must authenticate before joining the queue.' });
        return;
      }

      if (socketToGame.has(socket.id)) {
        socket.emit('error', { message: 'You are already in an active game.' });
        return;
      }

      removeFromQueue(socket.id);
      matchmakingQueue.push({
        ...authenticatedUser,
        socketId: socket.id,
        joinedAt: Date.now(),
      });

      socket.emit('queueJoined', { joinedAt: Date.now() });
      await tryMatchmake(io);
    });

    socket.on('leaveQueue', () => {
      removeFromQueue(socket.id);
      socket.emit('queueLeft');
    });

    socket.on('createRoom', async ({ token }: { token?: string }) => {
      const authenticatedUser = typedSocket.data.user ?? (token ? await authenticateSocket(typedSocket, token) : null);

      if (!authenticatedUser) {
        socket.emit('error', { message: 'You must authenticate before creating a room.' });
        return;
      }

      if (socketToGame.has(socket.id)) {
        socket.emit('error', { message: 'You are already in an active game.' });
        return;
      }

      // Remove from any existing room
      for (const [code, room] of customRooms) {
        if (room.host.socketId === socket.id) {
          customRooms.delete(code);
        }
      }

      const roomCode = generateRoomCode();
      customRooms.set(roomCode, {
        roomCode,
        host: {
          ...authenticatedUser,
          socketId: socket.id,
          joinedAt: Date.now(),
        },
        createdAt: Date.now(),
      });

      socket.emit('roomCreated', { roomCode });
    });

    socket.on('joinRoom', async ({ token, roomCode }: { token?: string; roomCode: string }) => {
      const authenticatedUser = typedSocket.data.user ?? (token ? await authenticateSocket(typedSocket, token) : null);

      if (!authenticatedUser) {
        socket.emit('error', { message: 'You must authenticate before joining a room.' });
        return;
      }

      if (socketToGame.has(socket.id)) {
        socket.emit('error', { message: 'You are already in an active game.' });
        return;
      }

      const code = roomCode.toUpperCase().trim();
      const room = customRooms.get(code);

      if (!room) {
        socket.emit('roomError', { message: 'Room not found. Check the code and try again.' });
        return;
      }

      if (room.host.socketId === socket.id) {
        socket.emit('roomError', { message: 'You cannot join your own room.' });
        return;
      }

      customRooms.delete(code);

      const joiner: QueueEntry = {
        ...authenticatedUser,
        socketId: socket.id,
        joinedAt: Date.now(),
      };

      await createActiveGame(io, room.host, joiner, true);
    });

    socket.on('cancelRoom', () => {
      for (const [code, room] of customRooms) {
        if (room.host.socketId === socket.id) {
          customRooms.delete(code);
          socket.emit('roomCancelled');
          return;
        }
      }
    });

    socket.on('makeMove', async ({ gameId, row, col }: { gameId: string; row: number; col: number }) => {
      const authenticatedUser = typedSocket.data.user;
      const activeGame = activeGames.get(gameId);

      if (!authenticatedUser || !activeGame) {
        socket.emit('invalidMove', { reason: 'Game not found or authentication missing.' });
        return;
      }

      if (activeGame.status !== 'active') {
        socket.emit('invalidMove', { reason: 'This game is no longer active.' });
        return;
      }

      const player = getGamePlayer(activeGame, authenticatedUser.userId);

      if (!player) {
        socket.emit('invalidMove', { reason: 'You are not a player in this game.' });
        return;
      }

      if (activeGame.state.currentPlayer !== player.color) {
        socket.emit('invalidMove', { reason: 'It is not your turn.' });
        return;
      }

      const { newState, flipped, valid } = processMove(activeGame.state, row, col);

      if (!valid) {
        socket.emit('invalidMove', { reason: 'That move is not legal.' });
        return;
      }

      activeGame.state = newState;
      await persistMoves(activeGame);

      const lastMove = newState.moveHistory[newState.moveHistory.length - 1] ?? null;

      io.to(gameId).emit('gameUpdate', {
        state: newState,
        lastMove,
        flipped,
      });

      if (newState.gameStatus === 'finished') {
        await finishGame(io, activeGame, newState.winner, 'board-complete', 'finished');
      }
    });

    socket.on('resign', async ({ gameId }: { gameId: string }) => {
      const authenticatedUser = typedSocket.data.user;
      const activeGame = activeGames.get(gameId);

      if (!authenticatedUser || !activeGame || activeGame.status !== 'active') {
        return;
      }

      const player = getGamePlayer(activeGame, authenticatedUser.userId);

      if (!player) {
        return;
      }

      const winner: Player = player.color === 'black' ? 'white' : 'black';
      await finishGame(io, activeGame, winner, 'resignation', 'abandoned');
    });

    socket.on('requestRematch', async ({ gameId }: { gameId: string }) => {
      const authenticatedUser = typedSocket.data.user;
      const activeGame = activeGames.get(gameId);

      if (!authenticatedUser || !activeGame || activeGame.status === 'active') {
        return;
      }

      const player = getGamePlayer(activeGame, authenticatedUser.userId);

      if (!player) {
        return;
      }

      activeGame.rematchVotes.add(authenticatedUser.userId);

      const opponent =
        player.userId === activeGame.blackPlayer.userId ? activeGame.whitePlayer : activeGame.blackPlayer;
      const opponentSocket = io.sockets.sockets.get(opponent.socketId);
      opponentSocket?.emit('rematchRequested');

      if (activeGame.rematchVotes.size < 2) {
        return;
      }

      activeGames.delete(activeGame.gameId);
      socketToGame.delete(activeGame.blackPlayer.socketId);
      socketToGame.delete(activeGame.whitePlayer.socketId);

      await createActiveGame(
        io,
        {
          ...activeGame.whitePlayer,
          joinedAt: Date.now(),
          socketId: activeGame.whitePlayer.socketId,
        },
        {
          ...activeGame.blackPlayer,
          joinedAt: Date.now() + 1,
          socketId: activeGame.blackPlayer.socketId,
        },
        activeGame.isCustomRoom,
      );
    });

    socket.on('disconnect', async () => {
      removeFromQueue(socket.id);

      // Clean up custom rooms hosted by this socket
      for (const [code, room] of customRooms) {
        if (room.host.socketId === socket.id) {
          customRooms.delete(code);
        }
      }

      const gameId = socketToGame.get(socket.id);
      if (!gameId) {
        return;
      }

      const activeGame = activeGames.get(gameId);
      socketToGame.delete(socket.id);

      if (!activeGame || activeGame.status !== 'active') {
        return;
      }

      const disconnectedPlayer =
        activeGame.blackPlayer.socketId === socket.id ? activeGame.blackPlayer : activeGame.whitePlayer;
      const winner: Player = disconnectedPlayer.color === 'black' ? 'white' : 'black';

      await finishGame(io, activeGame, winner, 'disconnect-forfeit', 'abandoned');
    });
  });
}



