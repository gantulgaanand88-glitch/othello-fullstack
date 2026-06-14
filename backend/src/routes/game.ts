import { Router } from 'express';

import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { Game } from '../models/Game';

const router = Router();

router.get('/:id', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const game = await Game.findById(req.params.id)
      .populate('blackPlayer', 'username rating wins losses draws gamesPlayed')
      .populate('whitePlayer', 'username rating wins losses draws gamesPlayed')
      .lean();

    if (!game) {
      res.status(404).json({ message: 'Game not found.' });
      return;
    }

    res.json(game);
  } catch (error) {
    console.error('Load game error:', error);
    res.status(500).json({ message: 'Failed to load game.' });
  }
});

export default router;
