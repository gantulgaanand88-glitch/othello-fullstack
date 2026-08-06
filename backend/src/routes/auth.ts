import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

import { signAuthToken } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { User } from '../models/User';
import { getPlayerRank } from '../utils/elo';
import { z } from 'zod';

const router = Router();

const USERNAME_REGEX = /^[a-zA-Z0-9_-]+$/;

const registerSchema = z.object({
  username: z.string().min(3).max(20).regex(USERNAME_REGEX, 'Username may only contain letters, numbers, hyphens, and underscores.'),
  email: z.string().email('Please provide a valid email address.').max(255),
  password: z.string().min(8, 'Password must be at least 8 characters long.').max(128, 'Password must not exceed 128 characters.'),
  ageConfirmed: z.literal(true, {
    errorMap: () => ({ message: 'You must confirm that you are of legal age.' })
  } as any),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email format.').max(255),
  password: z.string().min(1, 'Password is required.'),
});

// Pre-computed dummy hash for timing-safe login
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', 12);

router.post('/guest', (_req, res) => {
  const guestId = `guest_${crypto.randomBytes(8).toString('hex')}`;
  const guestNumber = Math.floor(1000 + Math.random() * 9000);
  const username = `Guest_${guestNumber}`;

  const token = signAuthToken(guestId, true);

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

router.post('/register', validate(registerSchema), async (req, res) => {
  try {
    const { username, email, password } = req.body;

    const trimmedUsername = username.trim();
    const trimmedEmail = email.trim().toLowerCase();

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
      consentGiven: new Date(),
      consentVersion: '1.0',
      ageConfirmed: true,
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

router.post('/login', validate(loginSchema), async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      // Timing-safe: always hash even when user not found to prevent timing attacks
      await bcrypt.compare(password, DUMMY_HASH);
      res.status(401).json({ message: 'Invalid email or password.' });
      return;
    }

    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      res.status(401).json({ message: 'Invalid email or password.' });
      return;
    }

    // Update lastLogin timestamp
    await User.findByIdAndUpdate(user.id, { $set: { lastLogin: new Date() } });

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
