import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthenticatedRequest extends Request {
  userId?: string;
}

interface JwtPayload {
  userId: string;
  isGuest: boolean;
}

/**
 * Validate that the JWT_SECRET environment variable exists and is at least 32 characters.
 * Call this at startup before accepting connections.
 */
export function validateJwtSecret(): void {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('JWT_SECRET is not configured.');
  }

  if (secret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long.');
  }
}

export function signAuthToken(userId: string, isGuest = false): string {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('JWT_SECRET is not configured.');
  }

  return jwt.sign({ userId, isGuest }, secret, { algorithm: 'HS256', expiresIn: '7d' });
}

export function verifyAuthToken(token: string): JwtPayload {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('JWT_SECRET is not configured.');
  }

  return jwt.verify(token, secret, { algorithms: ['HS256'] }) as JwtPayload;
}

export function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  const header = req.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Authorization token is required.' });
    return;
  }

  const token = header.slice(7);

  try {
    const payload = verifyAuthToken(token);
    req.userId = payload.userId;
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired token.' });
  }
}
