import { Router } from 'express';
import { z } from 'zod';
import { rateLimit } from 'express-rate-limit';

import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { Report } from '../models/Report';

const router = Router();

// Rate limit: 5 reports per hour
const reportLimiter = rateLimit({
  windowMs: 60 * 60_000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many reports. Please try again later.' },
});

const reportSchema = z.object({
  reportedUserId: z.string().min(1),
  gameId: z.string().optional(),
  reason: z.enum(['cheating', 'harassment', 'inappropriate_name', 'stalling', 'other']),
  description: z.string().max(500).optional(),
});

// POST / — Submit a player report
router.post('/', authMiddleware, reportLimiter, validate(reportSchema), async (req: AuthenticatedRequest, res) => {
  try {
    const reporterId = req.userId!;
    const { reportedUserId, gameId, reason, description } = req.body as z.infer<typeof reportSchema>;

    if (reporterId === reportedUserId) {
      res.status(400).json({ message: 'You cannot report yourself.' });
      return;
    }

    const report = await Report.create({
      reporter: reporterId,
      reported: reportedUserId,
      gameId: gameId ?? undefined,
      reason,
      description: description ?? '',
    });

    res.status(201).json({
      id: report.id,
      reason: report.reason,
      status: report.status,
      createdAt: report.createdAt,
    });
  } catch (error) {
    console.error('Submit report error:', error);
    res.status(500).json({ message: 'Failed to submit report.' });
  }
});

export default router;
