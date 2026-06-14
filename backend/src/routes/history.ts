import { Router } from 'express';

import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { Game } from '../models/Game';

const router = Router();

// GET / — Return paginated game history for authenticated user
router.get('/', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId!;
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
    const skip = (page - 1) * limit;

    const filter = {
      $or: [{ blackPlayer: userId }, { whitePlayer: userId }],
    };

    const [games, total] = await Promise.all([
      Game.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('blackPlayer', 'username')
        .populate('whitePlayer', 'username')
        .lean(),
      Game.countDocuments(filter),
    ]);

    const history = games.map((game) => {
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
        status: game.status,
      };
    });

    res.json({
      games: history,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Game history error:', error);
    res.status(500).json({ message: 'Failed to load game history.' });
  }
});

export default router;
