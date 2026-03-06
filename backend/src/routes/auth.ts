import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

import { signAuthToken } from '../middleware/auth';
import { User } from '../models/User';
import { getPlayerRank } from '../utils/elo';

const router = Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_REGEX = /^[a-zA-Z0-9_-]+$/;

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

    const trimmedUsername = username.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (trimmedUsername.length < 3 || trimmedUsername.length > 20) {
      res.status(400).json({ message: 'Username must be 3–20 characters.' });
      return;
    }

    if (!USERNAME_REGEX.test(trimmedUsername)) {
      res.status(400).json({ message: 'Username may only contain letters, numbers, hyphens, and underscores.' });
      return;
    }

    if (!EMAIL_REGEX.test(trimmedEmail)) {
      res.status(400).json({ message: 'Please provide a valid email address.' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ message: 'Password must be at least 6 characters long.' });
      return;
    }

    if (password.length > 128) {
      res.status(400).json({ message: 'Password must not exceed 128 characters.' });
      return;
    }

    const existingUser = await User.findOne({
      $or: [{ email: trimmedEmail }, { username: trimmedUsername }],
    }).lean();

    if (existingUser) {
      res.status(409).json({ message: 'A user with that email or username already exists.' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({
      username: trimmedUsername,
      email: trimmedEmail,
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
    console.error('Register error:', error);
    res.status(500).json({ message: 'Failed to register user.' });
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
    console.error('Login error:', error);
    res.status(500).json({ message: 'Failed to log in.' });
  }
});

export default router;
