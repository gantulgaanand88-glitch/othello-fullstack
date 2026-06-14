import { Router } from 'express';

import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { User } from '../models/User';
import { Game } from '../models/Game';
import { getPlayerRank } from '../utils/elo';

const router = Router();

async function getRecentGamesForUser(userId: string) {
  const games = await Game.find({
    $or: [{ blackPlayer: userId }, { whitePlayer: userId }],
  })
    .sort({ createdAt: -1 })
    .limit(10)
    .populate('blackPlayer', 'username')
    .populate('whitePlayer', 'username')
    .lean();

  return games.map((game) => {
    const isBlack = String(game.blackPlayer?._id ?? game.blackPlayer) === userId;
    const opponent = isBlack ? game.whitePlayer : game.blackPlayer;
    const opponentUsername = opponent && typeof opponent === 'object' && 'username' in opponent
      ? (opponent as { username: string }).username
      : 'Deleted User';
    const ratingChange = isBlack ? game.blackRatingChange : game.whiteRatingChange;

    let result: 'win' | 'loss' | 'draw';
    if (game.result === 'draw') {
      result = 'draw';
    } else if (
      (isBlack && game.result === 'black') ||
      (!isBlack && game.result === 'white')
    ) {
      result = 'win';
    } else {
      result = 'loss';
    }

    return {
      gameId: String(game._id),
      opponent: opponentUsername,
      result,
      ratingChange,
      date: game.createdAt,
    };
  });
}

// GET /me — Full profile including email and recent games (auth required)
router.get('/me', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId!;

    const user = await User.findById(userId)
      .select('-passwordHash')
      .lean();

    if (!user) {
      res.status(404).json({ message: 'User not found.' });
      return;
    }

    const recentGames = await getRecentGamesForUser(userId);

    res.json({
      id: String(user._id),
      username: user.username,
      email: user.email,
      rating: user.rating,
      rank: getPlayerRank(user.rating),
      gamesPlayed: user.gamesPlayed,
      wins: user.wins,
      losses: user.losses,
      draws: user.draws,
      memberSince: user.createdAt,
      lastLogin: user.lastLogin,
      recentGames,
    });
  } catch (error) {
    console.error('Profile me error:', error);
    res.status(500).json({ message: 'Failed to load profile.' });
  }
});

// GET /:username — Public profile with recent games (no auth required)
router.get('/:username', async (req, res) => {
  try {
    const { username } = req.params;

    const user = await User.findOne({ username })
      .select('username rating gamesPlayed wins losses draws createdAt')
      .lean();

    if (!user) {
      res.status(404).json({ message: 'User not found.' });
      return;
    }

    const recentGames = await getRecentGamesForUser(String(user._id));

    res.json({
      id: String(user._id),
      username: user.username,
      rating: user.rating,
      rank: getPlayerRank(user.rating),
      gamesPlayed: user.gamesPlayed,
      wins: user.wins,
      losses: user.losses,
      draws: user.draws,
      memberSince: user.createdAt,
      recentGames,
    });
  } catch (error) {
    console.error('Public profile error:', error);
    res.status(500).json({ message: 'Failed to load profile.' });
  }
});

export default router;
