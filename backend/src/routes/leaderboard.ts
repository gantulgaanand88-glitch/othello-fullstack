import { Router } from 'express';

import { User } from '../models/User';
import { getPlayerRank } from '../utils/elo';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const users = await User.find()
      .sort({ rating: -1, wins: -1, username: 1 })
      .limit(100)
      .select('username rating gamesPlayed wins losses draws')
      .lean();

    res.json(
      users.map((user, index) => ({
        id: String(user._id),
        position: index + 1,
        username: user.username,
        rating: user.rating,
        rank: getPlayerRank(user.rating),
        gamesPlayed: user.gamesPlayed,
        wins: user.wins,
        losses: user.losses,
        draws: user.draws,
      })),
    );
  } catch (error) {
    res.status(500).json({
      message: 'Failed to load leaderboard.',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
