import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { User, IUserDoc } from '../models';
import { UserRole, UserStatus } from '@novax/shared';

export interface AuthRequest extends Request {
  user?: IUserDoc;
  userId?: string;
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }

  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as { userId: string; role: string };
    req.userId = payload.userId;

    User.findById(payload.userId)
      .then((user) => {
        if (!user || user.status === UserStatus.SUSPENDED) {
          res.status(401).json({ success: false, error: 'Account not found or suspended' });
          return;
        }
        req.user = user;
        next();
      })
      .catch(() => {
        res.status(500).json({ success: false, error: 'Internal error' });
      });
  } catch {
    res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
}

export function authorize(...roles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }
    if (!roles.includes(req.user.role as UserRole)) {
      res.status(403).json({ success: false, error: 'Insufficient permissions' });
      return;
    }
    next();
  };
}
