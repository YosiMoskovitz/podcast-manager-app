import { logger } from '../utils/logger.js';

// Middleware to ensure user is authenticated
export function requireAuth(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  
  logger.warn(`Unauthorized access attempt to ${req.path}`);
  res.status(401).json({ error: 'Authentication required' });
}

// Middleware to attach user info (optional auth)
export function attachUser(req, res, next) {
  if (req.isAuthenticated()) {
    req.userId = req.user.id;
  }
  next();
}
