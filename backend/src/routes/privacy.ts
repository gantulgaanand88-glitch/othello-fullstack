import { Router } from 'express';

import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { User } from '../models/User';
import { Game } from '../models/Game';
import { ConsentLog } from '../models/ConsentLog';

const router = Router();

// GET /data-export — Return user data + game history as JSON
router.get('/data-export', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId!;

    const user = await User.findById(userId)
      .select('-passwordHash')
      .lean();

    if (!user) {
      res.status(404).json({ message: 'User not found.' });
      return;
    }

    const games = await Game.find({
      $or: [{ blackPlayer: userId }, { whitePlayer: userId }],
    })
      .sort({ createdAt: -1 })
      .lean();

    const consents = await ConsentLog.find({ userId })
      .sort({ timestamp: -1 })
      .lean();

    res.json({
      user,
      games,
      consents,
      exportedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Data export error:', error);
    res.status(500).json({ message: 'Failed to export data.' });
  }
});

// DELETE /delete-account — Delete user, anonymize their games, revoke all sessions
router.delete('/delete-account', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId!;

    const user = await User.findById(userId);

    if (!user) {
      res.status(404).json({ message: 'User not found.' });
      return;
    }

    // Anonymize games where this user was a player (keep game data for opponent's history)
    await Game.updateMany(
      { blackPlayer: userId },
      { $set: { blackPlayer: null } },
    );
    await Game.updateMany(
      { whitePlayer: userId },
      { $set: { whitePlayer: null } },
    );

    // Delete consent logs
    await ConsentLog.deleteMany({ userId });

    // Delete the user account
    await User.findByIdAndDelete(userId);

    res.json({ message: 'Account deleted successfully.' });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ message: 'Failed to delete account.' });
  }
});

export default router;
