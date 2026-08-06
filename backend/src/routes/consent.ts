import crypto from 'crypto';
import { Router } from 'express';
import { z } from 'zod';

import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { ConsentLog } from '../models/ConsentLog';

const router = Router();

const consentSchema = z.object({
  consentType: z.enum(['essential', 'analytics', 'marketing', 'terms', 'privacy']),
  granted: z.boolean(),
  policyVersion: z.string().min(1),
});

// POST / — Record consent choice
router.post('/', authMiddleware, validate(consentSchema), async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId!;
    const { consentType, granted, policyVersion } = req.body as z.infer<typeof consentSchema>;

    // Hash the IP address for audit without storing raw IP
    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    const ipHash = crypto.createHash('sha256').update(ip).digest('hex');

    const consent = await ConsentLog.create({
      userId,
      consentType,
      granted,
      policyVersion,
      ipHash,
    });

    res.status(201).json(consent);
  } catch (error) {
    console.error('Record consent error:', error);
    res.status(500).json({ message: 'Failed to record consent.' });
  }
});

// GET /status — Return current consent status for authenticated user
router.get('/status', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId!;

    // Get the latest consent record for each consent type
    const consentTypes = ['essential', 'analytics', 'marketing', 'terms', 'privacy'] as const;
    const status: Record<string, { granted: boolean; policyVersion: string; timestamp: Date } | null> = {};

    for (const consentType of consentTypes) {
      const latest = await ConsentLog.findOne({ userId, consentType })
        .sort({ timestamp: -1 })
        .lean();

      status[consentType] = latest
        ? { granted: latest.granted, policyVersion: latest.policyVersion, timestamp: latest.timestamp }
        : null;
    }

    res.json(status);
  } catch (error) {
    console.error('Consent status error:', error);
    res.status(500).json({ message: 'Failed to get consent status.' });
  }
});

export default router;
