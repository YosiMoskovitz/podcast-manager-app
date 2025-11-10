import express from 'express';
import passport from '../config/passport.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Get current authenticated user
router.get('/user', (req, res) => {
  if (req.isAuthenticated()) {
    res.json({
      id: req.user.id,
      email: req.user.email,
      name: req.user.name,
      picture: req.user.picture
    });
  } else {
    res.status(401).json({ error: 'Not authenticated' });
  }
});

// Initiate Google OAuth
router.get('/google', 
  passport.authenticate('google', { 
    scope: ['profile', 'email'] 
  })
);

// Google OAuth callback
router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: '/login?error=auth_failed' }),
  (req, res) => {
    // Explicitly save the session before redirecting
    req.session.save((err) => {
      if (err) {
        logger.error('Session save error:', err);
        return res.redirect('/login?error=session_save_failed');
      }
      
      logger.info(`User logged in: ${req.user.email}`);
      
      // Redirect to frontend after successful authentication
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      res.redirect(frontendUrl);
    });
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
