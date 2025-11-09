import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import User from '../models/User.js';
import { logger } from '../utils/logger.js';

// Register Google OAuth strategy only when credentials are present.
const hasGoogleCreds = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

if (!hasGoogleCreds) {
  // Don't throw here — allow the server to start without Google OAuth configured.
  logger.warn('Google OAuth credentials not found. Google sign-in and Drive connect will be disabled.');
} else {
  // Configure Google OAuth Strategy
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/auth/google/callback',
        scope: ['profile', 'email']
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          // Check if user already exists
          let user = await User.findOne({ googleId: profile.id });

          if (user) {
            // Update last login
            user.lastLogin = new Date();
            await user.save();
            logger.info(`User logged in: ${user.email}`);
            return done(null, user);
          }

          // Create new user
          user = await User.create({
            googleId: profile.id,
            email: profile.emails[0].value,
            name: profile.displayName,
            picture: profile.photos[0]?.value,
            lastLogin: new Date()
          });

          logger.info(`New user created: ${user.email}`);
          done(null, user);
        } catch (error) {
          logger.error('Error in Google OAuth strategy:', error);
          done(error, null);
        }
      }
    )
  );
}

// Serialize user to session
passport.serializeUser((user, done) => {
  logger.info(`[PASSPORT] Serializing user: ${user.email} (ID: ${user.id})`);
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  try {
    logger.info(`[PASSPORT] Deserializing user ID: ${id}`);
    const user = await User.findById(id);
    if (user) {
      logger.info(`[PASSPORT] User deserialized successfully: ${user.email}`);
    } else {
      logger.warn(`[PASSPORT] User not found for ID: ${id}`);
    }
    done(null, user);
  } catch (error) {
    logger.error('Error deserializing user:', error);
    done(error, null);
  }
});

export default passport;
