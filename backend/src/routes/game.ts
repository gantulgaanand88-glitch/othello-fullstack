import { Router } from 'express';
import { isValidObjectId } from 'mongoose';

import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { Game } from '../models/Game';

const router = Router();

router.get('/:id', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      res.status(400).json({ message: 'Invalid game ID.' });
      return;
    }

    const game = await Game.findById(req.params.id)
      .populate('blackPlayer', 'username rating wins losses draws gamesPlayed')
      .populate('whitePlayer', 'username rating wins losses draws gamesPlayed')
      .lean();

    if (!game) {
      res.status(404).json({ message: 'Game not found.' });
      return;
    }

    const blackId = String((game.blackPlayer as unknown as { _id?: unknown })._id ?? game.blackPlayer);
    const whiteId = String((game.whitePlayer as unknown as { _id?: unknown })._id ?? game.whitePlayer);
    if (req.userId !== blackId && req.userId !== whiteId) {
      res.status(403).json({ message: 'You do not have access to this game.' });
      return;
    }

    res.json(game);
  } catch (error) {
    console.error('Load game error:', error);
    res.status(500).json({ message: 'Failed to load game.' });
  }
});

export default router;
