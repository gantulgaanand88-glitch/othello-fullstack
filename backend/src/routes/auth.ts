import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

import { signAuthToken } from '../middleware/auth';
import { User } from '../models/User';
import { getPlayerRank } from '../utils/elo';

const router = Router();

router.post('/guest', (_req, res) => {
  const guestId = `guest_${crypto.randomBytes(8).toString('hex')}`;
  const guestNumber = Math.floor(1000 + Math.random() * 9000);
  const username = `Guest_${guestNumber}`;

  const token = signAuthToken(guestId);

  res.json({
    token,
    user: {
      id: guestId,
      username,
      email: '',
      rating: 1200,
      rank: 'Intermediate',
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      isGuest: true,
    },
  });
});

router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body as {
      username?: string;
      email?: string;
      password?: string;
    };

    if (!username || !email || !password) {
      res.status(400).json({ message: 'Username, email, and password are required.' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ message: 'Password must be at least 6 characters long.' });
      return;
    }

    const existingUser = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { username }],
    }).lean();

    if (existingUser) {
      res.status(409).json({ message: 'A user with that email or username already exists.' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({
      username,
      email: email.toLowerCase(),
      passwordHash,
    });

    const token = signAuthToken(user.id);

    res.status(201).json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        rating: user.rating,
        rank: getPlayerRank(user.rating),
        gamesPlayed: user.gamesPlayed,
        wins: user.wins,
        losses: user.losses,
        draws: user.draws,
      },
    });
  } catch (error) {
    res.status(500).json({
      message: 'Failed to register user.',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body as {
      email?: string;
      password?: string;
    };

    if (!email || !password) {
      res.status(400).json({ message: 'Email and password are required.' });
      return;
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      res.status(401).json({ message: 'Invalid email or password.' });
      return;
    }

    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      res.status(401).json({ message: 'Invalid email or password.' });
      return;
    }

    const token = signAuthToken(user.id);

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        rating: user.rating,
        rank: getPlayerRank(user.rating),
        gamesPlayed: user.gamesPlayed,
        wins: user.wins,
        losses: user.losses,
        draws: user.draws,
      },
    });
  } catch (error) {
    res.status(500).json({
      message: 'Failed to log in.',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
