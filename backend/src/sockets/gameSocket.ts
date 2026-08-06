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
import { computeBotMove } from '../gameEngine/bot';
import { Game } from '../models/Game';
import { User } from '../models/User';
import { getEloUpdateOps } from '../utils/elo';
import { z } from 'zod';

const botDifficultySchema = z.enum(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);
const playerColorSchema = z.enum(['black', 'white', 'random']);

const startBotGameSchema = z.object({
  difficulty: botDifficultySchema,
  playerColor: playerColorSchema,
});

const joinRoomSchema = z.object({
  roomCode: z.string().min(1).max(20),
});

const gameIdSchema = z.object({
  gameId: z.string().min(1),
});

const makeMoveSchema = z.object({
  gameId: z.string().min(1),
  row: z.number().int().min(0).max(7),
  col: z.number().int().min(0).max(7),
});

const chatMessageSchema = z.object({
  gameId: z.string().min(1),
  message: z.string().min(1).max(200),
});

const respondDrawSchema = z.object({
  gameId: z.string().min(1),
  accept: z.boolean(),
});

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
  isBot?: boolean;
  botDifficulty?: '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10';
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
  moveTimer: ReturnType<typeof setTimeout> | null;
  lastMoveAt: number;
  disconnectTimer?: ReturnType<typeof setTimeout> | null;
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
const MOVE_TIMEOUT_MS = 5 * 60_000; // 5 minutes per move
export const matchmakingQueue: QueueEntry[] = [];
export const activeGames = new Map<string, ActiveGame>();
export const socketToGame = new Map<string, string>();
export const customRooms = new Map<string, CustomRoom>();

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  while (true) {
    code = '';
    const bytes = crypto.randomBytes(6);
    for (let i = 0; i < 6; i++) {
      code += chars[bytes[i] % chars.length];
    }
    if (!customRooms.has(code)) {
      break;
    }
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

function removeUserFromQueue(userId: string): void {
  for (let i = matchmakingQueue.length - 1; i >= 0; i--) {
    if (matchmakingQueue[i].userId === userId) {
      matchmakingQueue.splice(i, 1);
    }
  }
}

function userHasActiveGame(userId: string): boolean {
  for (const game of activeGames.values()) {
    if (
      game.status === 'active' &&
      ((!game.blackPlayer.isBot && game.blackPlayer.userId === userId) ||
        (!game.whitePlayer.isBot && game.whitePlayer.userId === userId))
    ) {
      return true;
    }
  }
  return false;
}

function removeUserRooms(userId: string, io: Server): void {
  for (const [code, room] of customRooms) {
    if (room.host.userId === userId) {
      customRooms.delete(code);
      io.sockets.sockets.get(room.host.socketId)?.emit('roomCancelled');
    }
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

/** Start (or restart) the move timer for the current player. */
function startMoveTimer(io: Server, activeGame: ActiveGame): void {
  if (activeGame.moveTimer) {
    clearTimeout(activeGame.moveTimer);
  }

  activeGame.lastMoveAt = Date.now();

  activeGame.moveTimer = setTimeout(async () => {
    if (activeGame.status !== 'active') return;

    // Current player loses on time
    const loser = activeGame.state.currentPlayer;
    const winner: Player = loser === 'black' ? 'white' : 'black';
    await finishGame(io, activeGame, winner, 'move-timeout', 'abandoned');
  }, MOVE_TIMEOUT_MS);
}

function clearMoveTimer(activeGame: ActiveGame): void {
  if (activeGame.moveTimer) {
    clearTimeout(activeGame.moveTimer);
    activeGame.moveTimer = null;
  }
}

function triggerBotMove(io: Server, activeGame: ActiveGame): void {
  if (activeGame.status !== 'active') return;

  const currentPlayerColor = activeGame.state.currentPlayer;
  const botPlayer = currentPlayerColor === 'black' ? activeGame.blackPlayer : activeGame.whitePlayer;

  if (!botPlayer.isBot || !botPlayer.botDifficulty) return;

  // Simulate a thinking delay between 600ms and 1200ms
  const delay = Math.floor(Math.random() * (1200 - 600 + 1)) + 600;

  setTimeout(async () => {
    try {
      const currentActiveGame = activeGames.get(activeGame.gameId);
      if (!currentActiveGame || currentActiveGame.status !== 'active') return;
      if (currentActiveGame.state.currentPlayer !== currentPlayerColor) return;

      const [r, c] = computeBotMove(
        currentActiveGame.state.board,
        currentPlayerColor,
        botPlayer.botDifficulty!
      );

      const moveResult = processMove(currentActiveGame.state, r, c);
      if (!moveResult.valid) {
        console.error('Bot attempted an invalid move:', r, c);
        return;
      }
      const { newState, flipped } = moveResult;

      currentActiveGame.state = newState;
      await persistMoves(currentActiveGame);

      const lastMove = newState.moveHistory[newState.moveHistory.length - 1] ?? null;

      currentActiveGame.lastMoveAt = Date.now();
      io.to(currentActiveGame.gameId).emit('gameUpdate', {
        state: newState,
        lastMove,
        flipped,
        remainingTime: MOVE_TIMEOUT_MS,
      });

      if (newState.gameStatus === 'finished') {
        await finishGame(io, currentActiveGame, newState.winner, 'board-complete', 'finished');
      } else {
        startMoveTimer(io, currentActiveGame);
        
        const nextPlayerColor = newState.currentPlayer;
        const nextPlayerObj = nextPlayerColor === 'black' ? currentActiveGame.blackPlayer : currentActiveGame.whitePlayer;
        if (nextPlayerObj.isBot) {
          triggerBotMove(io, currentActiveGame);
        }
      }
    } catch (err) {
      console.error('Error during bot move execution:', err);
    }
  }, delay);
}

async function createActiveGame(
  io: Server,
  blackEntry: QueueEntry & { isBot?: boolean; botDifficulty?: '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' },
  whiteEntry: QueueEntry & { isBot?: boolean; botDifficulty?: '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' },
  isCustomRoom = false,
): Promise<void> {
  if (blackEntry.userId === whiteEntry.userId && !blackEntry.isBot && !whiteEntry.isBot) {
    throw new Error('A user cannot play against the same account.');
  }
  const hasGuest = !!(blackEntry.isGuest || whiteEntry.isGuest || blackEntry.isBot || whiteEntry.isBot);
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
    moveTimer: null,
    lastMoveAt: Date.now(),
  };

  activeGames.set(activeGame.gameId, activeGame);
  if (blackEntry.socketId !== 'bot_socket') socketToGame.set(blackEntry.socketId, activeGame.gameId);
  if (whiteEntry.socketId !== 'bot_socket') socketToGame.set(whiteEntry.socketId, activeGame.gameId);

  emitGameFound(io, activeGame);
  startMoveTimer(io, activeGame);

  if (activeGame.blackPlayer.isBot) {
    triggerBotMove(io, activeGame);
  }
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
        // First entry gets black, candidate gets white
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

  const latestMove = activeGame.state.moveHistory[activeGame.state.moveHistory.length - 1];
  if (!latestMove) return;

  await Game.findByIdAndUpdate(activeGame.dbGameId, {
    $push: {
      moves: {
        player: latestMove.player,
        row: latestMove.row,
        col: latestMove.col,
        flipped: latestMove.flipped,
        blackScore: latestMove.blackScore,
        whiteScore: latestMove.whiteScore,
        timestamp: new Date(latestMove.timestamp),
      },
    },
    $set: {
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

  clearMoveTimer(activeGame);
  activeGame.status = status;
  activeGame.state = {
    ...activeGame.state,
    gameStatus: 'finished',
    winner,
    legalMoves: [],
  };

  // Notify spectators in the room
  io.to(activeGame.gameId).emit('spectatorGameOver', {
    winner,
    reason,
    finalState: activeGame.state,
  });

  const hasGuest = !!(activeGame.blackPlayer.isGuest || activeGame.whitePlayer.isGuest);

  let eloChangeA = 0;
  let eloChangeB = 0;
  let newRatingA = activeGame.blackPlayer.rating;
  let newRatingB = activeGame.whitePlayer.rating;

  if (!hasGuest) {
    const [blackUser, whiteUser] = await Promise.all([
      User.findById(activeGame.blackPlayer.userId).select('rating gamesPlayed').lean(),
      User.findById(activeGame.whitePlayer.userId).select('rating gamesPlayed').lean(),
    ]);

    if (blackUser && whiteUser) {
      const { opsA, opsB, eloResult } = getEloUpdateOps(
        blackUser.rating,
        whiteUser.rating,
        blackUser.gamesPlayed,
        whiteUser.gamesPlayed,
        getResultForBlack(winner),
      );

      await Promise.all([
        User.findByIdAndUpdate(activeGame.blackPlayer.userId, { $inc: opsA }),
        User.findByIdAndUpdate(activeGame.whitePlayer.userId, { $inc: opsB }),
        Game.findByIdAndUpdate(activeGame.dbGameId, {
          $set: {
            result: winner,
            status,
            endTime: new Date(),
            blackRatingChange: eloResult.changeA,
            whiteRatingChange: eloResult.changeB,
          },
        }),
      ]);

      eloChangeA = eloResult.changeA;
      eloChangeB = eloResult.changeB;
      newRatingA = eloResult.newRatingA;
      newRatingB = eloResult.newRatingB;
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

function filterProfanity(text: string): string {
  const badWords = /\b(shit|fuck|ass|bitch|bastard|cunt|dick|cock|pussy)\b/gi;
  return text.replace(badWords, '****');
}

export function initializeGameSocket(io: Server): void {
  // Authentication middleware
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) {
      return next(new Error('Authentication required'));
    }
    try {
      const payload = verifyAuthToken(token);
      if (payload.userId.startsWith('guest_')) {
        (socket as SocketWithUser).data.user = {
          userId: payload.userId,
          username: `Guest_${payload.userId.slice(-4)}`,
          rating: 1200,
          isGuest: true,
        };
      } else {
        const user = await User.findById(payload.userId).select('username rating').lean();
        if (!user) return next(new Error('User not found'));
        (socket as SocketWithUser).data.user = {
          userId: String(user._id),
          username: user.username,
          rating: user.rating,
          isGuest: false,
        };
      }
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  // Periodic cleanup of stale finished games and abandoned rooms
  const cleanupTimer = setInterval(() => {
    const now = Date.now();

    // Remove finished/abandoned games older than 30 minutes
    for (const [gameId, game] of activeGames) {
      if (game.status !== 'active' && (now - game.lastMoveAt > STALE_GAME_CLEANUP_MS)) {
        clearMoveTimer(game);
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
  cleanupTimer.unref();

  const matchmakingTimer = setInterval(() => {
    void tryMatchmake(io).catch((error) => console.error('matchmaking interval error:', error));
  }, 1_000);
  matchmakingTimer.unref();

  io.on('connection', (socket: Socket) => {
    const typedSocket = socket as SocketWithUser;

    // Rate Limiter: max 10 events per socket per second
    const eventTimes: number[] = [];
    socket.use((packet, next) => {
      const now = Date.now();
      while (eventTimes.length > 0 && eventTimes[0] < now - 1000) {
        eventTimes.shift();
      }
      if (eventTimes.length >= 10) {
        return next(new Error('Rate limit exceeded (max 10 events/sec)'));
      }
      eventTimes.push(now);
      next();
    });

    socket.on('error', (err) => {
      socket.emit('serverError', { message: err.message });
    });

    const handleSocketError = (err: unknown, eventName: string) => {
      if (err instanceof z.ZodError) {
        const zodErr = err as any;
        const msg = zodErr.errors?.[0]?.message || zodErr.issues?.[0]?.message || 'Invalid payload';
        socket.emit('serverError', { message: `Validation error in ${eventName}: ${msg}` });
      } else {
        console.error(`${eventName} error:`, err);
        socket.emit('serverError', { message: `Failed to process ${eventName}.` });
      }
    };

    socket.on('joinQueue', async () => {
      try {
        const authenticatedUser = typedSocket.data.user;

        if (!authenticatedUser) {
          socket.emit('serverError', { message: 'You must authenticate before joining the queue.' });
          return;
        }

        if (socketToGame.has(socket.id) || userHasActiveGame(authenticatedUser.userId)) {
          socket.emit('serverError', { message: 'You are already in an active game.' });
          return;
        }

        removeUserRooms(authenticatedUser.userId, io);
        // Prevent same user from joining queue across multiple tabs
        removeUserFromQueue(authenticatedUser.userId);
        removeFromQueue(socket.id);

        matchmakingQueue.push({
          ...authenticatedUser,
          socketId: socket.id,
          joinedAt: Date.now(),
        });

        socket.emit('queueJoined', { joinedAt: Date.now() });
        await tryMatchmake(io);
      } catch (err) {
        console.error('joinQueue error:', err);
        socket.emit('serverError', { message: 'Failed to join the queue.' });
      }
    });

    socket.on('leaveQueue', () => {
      removeFromQueue(socket.id);
      socket.emit('queueLeft');
    });

    socket.on('startBotGame', async (payload) => {
      try {
        const { difficulty, playerColor } = startBotGameSchema.parse(payload);
        const authenticatedUser = typedSocket.data.user;

        if (!authenticatedUser) {
          socket.emit('serverError', { message: 'You must authenticate before starting a game.' });
          return;
        }

        if (socketToGame.has(socket.id) || userHasActiveGame(authenticatedUser.userId)) {
          socket.emit('serverError', { message: 'You are already in an active game.' });
          return;
        }

        removeUserFromQueue(authenticatedUser.userId);
        removeUserRooms(authenticatedUser.userId, io);

        let humanColor: Player = 'black';
        if (playerColor === 'random') {
          humanColor = Math.random() < 0.5 ? 'black' : 'white';
        } else {
          humanColor = playerColor;
        }

        const botDetails: Record<string, { rating: number; name: string }> = {
          '1': { rating: 200, name: 'Novice Nebula' },
          '2': { rating: 400, name: 'Comet Cadet' },
          '3': { rating: 600, name: 'Meteor Scout' },
          '4': { rating: 900, name: 'Gravity Guard' },
          '5': { rating: 1200, name: 'Orbit Officer' },
          '6': { rating: 1500, name: 'Proton Pilot' },
          '7': { rating: 1700, name: 'Sly Sentinel' },
          '8': { rating: 1900, name: 'Nebula Knight' },
          '9': { rating: 2100, name: 'Galaxy Guardian' },
          '10': { rating: 2400, name: 'Grandmaster Orion' },
        };

        const botInfo = botDetails[difficulty] || { rating: 1200, name: 'Computer' };
        const botRating = botInfo.rating;
        const botUsername = `${botInfo.name} (${botInfo.rating})`;

        const humanPlayerEntry = {
          ...authenticatedUser,
          socketId: socket.id,
          joinedAt: Date.now(),
        };

        const botPlayerEntry = {
          userId: `bot_${difficulty}`,
          username: botUsername,
          rating: botRating,
          isGuest: true,
          socketId: 'bot_socket',
          joinedAt: Date.now(),
        };

        const blackEntry = humanColor === 'black' ? humanPlayerEntry : { ...botPlayerEntry, isBot: true, botDifficulty: difficulty };
        const whiteEntry = humanColor === 'white' ? humanPlayerEntry : { ...botPlayerEntry, isBot: true, botDifficulty: difficulty };

        await createActiveGame(io, blackEntry, whiteEntry);
      } catch (err) {
        handleSocketError(err, 'startBotGame');
      }
    });

    socket.on('createRoom', async () => {
      try {
        const authenticatedUser = typedSocket.data.user;

        if (!authenticatedUser) {
          socket.emit('serverError', { message: 'You must authenticate before creating a room.' });
          return;
        }

        if (socketToGame.has(socket.id) || userHasActiveGame(authenticatedUser.userId)) {
          socket.emit('serverError', { message: 'You are already in an active game.' });
          return;
        }

        removeUserFromQueue(authenticatedUser.userId);

        // Limit custom rooms: check if user already has a custom room
        let userRoomCount = 0;
        for (const room of customRooms.values()) {
          if (room.host.userId === authenticatedUser.userId) {
            userRoomCount++;
          }
        }
        if (userRoomCount >= 1) {
          socket.emit('serverError', { message: 'You can only host one room at a time.' });
          return;
        }

        // Remove from any existing room hosted by this socket
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
      } catch (err) {
        console.error('createRoom error:', err);
        socket.emit('serverError', { message: 'Failed to create room.' });
      }
    });

    socket.on('joinRoom', async (payload) => {
      try {
        const { roomCode } = joinRoomSchema.parse(payload);
        const authenticatedUser = typedSocket.data.user;

        if (!authenticatedUser) {
          socket.emit('serverError', { message: 'You must authenticate before joining a room.' });
          return;
        }

        if (socketToGame.has(socket.id) || userHasActiveGame(authenticatedUser.userId)) {
          socket.emit('serverError', { message: 'You are already in an active game.' });
          return;
        }

        const code = roomCode.toUpperCase().trim();
        const room = customRooms.get(code);

        if (!room) {
          socket.emit('roomError', { message: 'Room not found. Check the code and try again.' });
          return;
        }

        if (room.host.userId === authenticatedUser.userId) {
          socket.emit('roomError', { message: 'You cannot join your own room.' });
          return;
        }

        if (userHasActiveGame(room.host.userId) || !io.sockets.sockets.get(room.host.socketId)?.connected) {
          customRooms.delete(code);
          socket.emit('roomError', { message: 'The host is no longer available.' });
          return;
        }

        customRooms.delete(code);
        removeUserFromQueue(authenticatedUser.userId);
        removeUserRooms(authenticatedUser.userId, io);

        const joiner: QueueEntry = {
          ...authenticatedUser,
          socketId: socket.id,
          joinedAt: Date.now(),
        };

        // Host gets black, joiner gets white
        await createActiveGame(io, room.host, joiner, true);
      } catch (err) {
        handleSocketError(err, 'joinRoom');
      }
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

    socket.on('rejoinGame', async (payload) => {
      try {
        const { gameId } = gameIdSchema.parse(payload);
        const authenticatedUser = typedSocket.data.user;
        if (!authenticatedUser) {
          socket.emit('serverError', { message: 'Authentication required' });
          return;
        }

        const activeGame = activeGames.get(gameId);
        if (!activeGame || activeGame.status !== 'active') {
          socket.emit('serverError', { message: 'Game not found or finished' });
          return;
        }

        const player = getGamePlayer(activeGame, authenticatedUser.userId);
        if (!player) {
          socket.emit('serverError', { message: 'You are not a player in this game' });
          return;
        }

        // Reconnect this player
        player.socketId = socket.id;
        socketToGame.set(socket.id, gameId);
        socket.join(gameId);

        // Clear disconnect timer if it exists
        if (activeGame.disconnectTimer) {
          clearTimeout(activeGame.disconnectTimer);
          activeGame.disconnectTimer = undefined;
        }

        // Notify opponent that player has reconnected
        socket.to(gameId).emit('opponentReconnected', { userId: authenticatedUser.userId });

        // Send current game state and remaining time
        const remainingTime = Math.max(0, MOVE_TIMEOUT_MS - (Date.now() - activeGame.lastMoveAt));
        socket.emit('gameRejoined', {
          gameId,
          yourColor: player.color,
          state: activeGame.state,
          remainingTime,
        });
      } catch (err) {
        handleSocketError(err, 'rejoinGame');
      }
    });

    socket.on('makeMove', async (payload) => {
      try {
        const { gameId, row, col } = makeMoveSchema.parse(payload);

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

        const moveResult = processMove(activeGame.state, row, col);

        if (!moveResult.valid) {
          socket.emit('invalidMove', { reason: 'That move is not legal.' });
          return;
        }

        const { newState, flipped } = moveResult;

        activeGame.state = newState;
        await persistMoves(activeGame);

        const lastMove = newState.moveHistory[newState.moveHistory.length - 1] ?? null;

        // Reset timer and emit game update with remaining time (full turn time since it starts now)
        activeGame.lastMoveAt = Date.now();
        io.to(gameId).emit('gameUpdate', {
          state: newState,
          lastMove,
          flipped,
          remainingTime: MOVE_TIMEOUT_MS,
        });

        if (newState.gameStatus === 'finished') {
          await finishGame(io, activeGame, newState.winner, 'board-complete', 'finished');
        } else {
          startMoveTimer(io, activeGame);
          const nextPlayerColor = newState.currentPlayer;
          const nextPlayerObj = nextPlayerColor === 'black' ? activeGame.blackPlayer : activeGame.whitePlayer;
          if (nextPlayerObj.isBot) {
            triggerBotMove(io, activeGame);
          }
        }
      } catch (err) {
        if (err instanceof z.ZodError) {
          socket.emit('invalidMove', { reason: 'Invalid move parameters.' });
        } else {
          console.error('makeMove error:', err);
          socket.emit('invalidMove', { reason: 'An unexpected error occurred.' });
        }
      }
    });

    socket.on('resign', async (payload) => {
      try {
        const { gameId } = gameIdSchema.parse(payload);
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
      } catch (err) {
        console.error('resign error:', err);
      }
    });

    socket.on('requestRematch', async (payload) => {
      try {
        const { gameId } = gameIdSchema.parse(payload);
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
        
        if (opponent.isBot) {
          activeGame.rematchVotes.add(opponent.userId);
        } else {
          const opponentSocket = io.sockets.sockets.get(opponent.socketId);
          opponentSocket?.emit('rematchRequested');
        }

        if (activeGame.rematchVotes.size < 2) {
          return;
        }

        activeGames.delete(activeGame.gameId);
        if (activeGame.blackPlayer.socketId !== 'bot_socket') socketToGame.delete(activeGame.blackPlayer.socketId);
        if (activeGame.whitePlayer.socketId !== 'bot_socket') socketToGame.delete(activeGame.whitePlayer.socketId);

        // Swap colors for rematch: the previous white player gets black, and the previous black player gets white
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
      } catch (err) {
        console.error('requestRematch error:', err);
      }
    });

    // Chat support
    let lastChatTimestamp = 0;
    socket.on('chatMessage', async (payload) => {
      try {
        const { gameId, message } = chatMessageSchema.parse(payload);
        const now = Date.now();
        if (now - lastChatTimestamp < 1000) {
          socket.emit('serverError', { message: 'Chat rate limit exceeded. Please wait.' });
          return;
        }
        lastChatTimestamp = now;

        if (!message || message.trim().length === 0) return;
        const cleanMessage = filterProfanity(message.slice(0, 200));

        io.to(gameId).emit('chatMessage', {
          sender: typedSocket.data.user?.username ?? 'System',
          message: cleanMessage,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        console.error('chatMessage error:', err);
      }
    });

    // Draw offer events
    socket.on('offerDraw', async (payload) => {
      try {
        const { gameId } = gameIdSchema.parse(payload);
        const activeGame = activeGames.get(gameId);
        if (!activeGame || activeGame.status !== 'active') return;

        const player = getGamePlayer(activeGame, typedSocket.data.user!.userId);
        if (!player) return;

        socket.to(gameId).emit('drawOffered', { offeredBy: player.color });
      } catch (err) {
        console.error('offerDraw error:', err);
      }
    });

    socket.on('respondDraw', async (payload) => {
      try {
        const { gameId, accept } = respondDrawSchema.parse(payload);
        const activeGame = activeGames.get(gameId);
        if (!activeGame || activeGame.status !== 'active') return;

        const player = getGamePlayer(activeGame, typedSocket.data.user!.userId);
        if (!player) return;

        if (accept) {
          await finishGame(io, activeGame, 'draw', 'draw-agreement', 'finished');
        } else {
          socket.to(gameId).emit('drawDeclined');
        }
      } catch (err) {
        console.error('respondDraw error:', err);
      }
    });

    // Spectator support
    socket.on('spectateGame', async (payload) => {
      try {
        const { gameId } = gameIdSchema.parse(payload);
        const activeGame = activeGames.get(gameId);
        if (!activeGame) {
          socket.emit('serverError', { message: 'Game not found.' });
          return;
        }
        if (activeGame.isCustomRoom) {
          socket.emit('serverError', { message: 'Private room games cannot be spectated.' });
          return;
        }
        socket.join(gameId);
        socket.emit('spectateSuccess', {
          gameId,
          state: activeGame.state,
          blackPlayer: {
            username: activeGame.blackPlayer.username,
            rating: activeGame.blackPlayer.rating,
          },
          whitePlayer: {
            username: activeGame.whitePlayer.username,
            rating: activeGame.whitePlayer.rating,
          },
        });
      } catch (err) {
        console.error('spectateGame error:', err);
      }
    });

    socket.on('listActiveGames', () => {
      try {
        const games = Array.from(activeGames.values())
          .filter((g) => g.status === 'active' && !g.isCustomRoom)
          .map((g) => ({
            gameId: g.gameId,
            blackPlayer: {
              username: g.blackPlayer.username,
              rating: g.blackPlayer.rating,
            },
            whitePlayer: {
              username: g.whitePlayer.username,
              rating: g.whitePlayer.rating,
            },
            score: {
              black: g.state.blackScore,
              white: g.state.whiteScore,
            },
            currentPlayer: g.state.currentPlayer,
          }));
        socket.emit('activeGamesList', games);
      } catch (err) {
        console.error('listActiveGames error:', err);
      }
    });

    socket.on('disconnect', async () => {
      try {
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

        const isBotGame = !!(activeGame.blackPlayer.isBot || activeGame.whitePlayer.isBot);
        if (isBotGame) {
          clearMoveTimer(activeGame);
          activeGame.status = 'abandoned';
          activeGames.delete(gameId);
          return;
        }

        const disconnectedPlayer =
          activeGame.blackPlayer.socketId === socket.id ? activeGame.blackPlayer : activeGame.whitePlayer;
        const remainingPlayer =
          activeGame.blackPlayer.socketId === socket.id ? activeGame.whitePlayer : activeGame.blackPlayer;

        // Set a 30-second disconnect timer before forfeiting
        const timer = setTimeout(async () => {
          if (activeGame.status === 'active') {
            const winner: Player = disconnectedPlayer.color === 'black' ? 'white' : 'black';
            await finishGame(io, activeGame, winner, 'disconnect-forfeit', 'abandoned');
          }
        }, 30_000);
        activeGame.disconnectTimer = timer;

        const remainingSocket = io.sockets.sockets.get(remainingPlayer.socketId);
        remainingSocket?.emit('opponentDisconnected', { userId: disconnectedPlayer.userId });
      } catch (err) {
        console.error('disconnect cleanup error:', err);
      }
    });
  });
}
