import express from 'express';
import passport from '../config/passport.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Get current authenticated user
router.get('/user', (req, res) => {
  logger.info(`[AUTH] /user endpoint called - Session ID: ${req.sessionID}`);
  logger.info(`[AUTH] isAuthenticated: ${req.isAuthenticated()}`);
  logger.info(`[AUTH] Session data: ${JSON.stringify(req.session)}`);
  logger.info(`[AUTH] User data: ${req.user ? JSON.stringify({ id: req.user.id, email: req.user.email }) : 'null'}`);
  
  if (req.isAuthenticated()) {
    res.json({
      id: req.user.id,
      email: req.user.email,
      name: req.user.name,
      picture: req.user.picture
    });
  } else {
    logger.warn(`[AUTH] User not authenticated - returning 401`);
    res.status(401).json({ error: 'Not authenticated' });
  }
});

// Initiate Google OAuth
router.get('/google', (req, res, next) => {
  logger.info(`[AUTH] Starting Google OAuth flow - Session ID: ${req.sessionID}`);
  logger.info(`[AUTH] Request origin: ${req.get('origin')}`);
  logger.info(`[AUTH] Request host: ${req.get('host')}`);
  next();
},
  passport.authenticate('google', { 
    scope: ['profile', 'email'] 
  })
);

// Google OAuth callback
router.get('/google/callback',
  (req, res, next) => {
    logger.info(`[AUTH] Google OAuth callback received - Session ID: ${req.sessionID}`);
    logger.info(`[AUTH] Query params: ${JSON.stringify(req.query)}`);
    logger.info(`[AUTH] Cookies: ${JSON.stringify(req.cookies)}`);
    next();
  },
  passport.authenticate('google', { failureRedirect: '/login?error=auth_failed' }),
  (req, res) => {
    logger.info(`[AUTH] Google OAuth successful - User: ${req.user?.email}`);
    logger.info(`[AUTH] Session ID after auth: ${req.sessionID}`);
    logger.info(`[AUTH] isAuthenticated: ${req.isAuthenticated()}`);
    logger.info(`[AUTH] Session data: ${JSON.stringify(req.session)}`);
    
    // Redirect to frontend after successful authentication
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    logger.info(`[AUTH] Redirecting to frontend: ${frontendUrl}`);
    res.redirect(frontendUrl);
  }
);

// Logout
router.post('/logout', (req, res) => {
  const userEmail = req.user?.email;
  
  req.logout((err) => {
    if (err) {
      logger.error('Error during logout:', err);
      return res.status(500).json({ error: 'Logout failed' });
    }
    
    req.session.destroy((err) => {
      if (err) {
        logger.error('Error destroying session:', err);
        return res.status(500).json({ error: 'Session destruction failed' });
      }
      
      res.clearCookie('connect.sid');
      logger.info(`User logged out: ${userEmail}`);
      res.json({ message: 'Logged out successfully' });
    });
  });
});

export default router;
