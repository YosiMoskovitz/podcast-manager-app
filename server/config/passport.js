import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import User from '../models/User.js';
import UserEncryptionKey from '../models/UserEncryptionKey.js';
import encryptionService from '../services/encryption.js';
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
          // Hash the Google ID for lookup
          const hashedGoogleId = encryptionService.hashGoogleId(profile.id);
          const emailHash = encryptionService.hashEmail(profile.emails[0].value);
          
          // Check if user already exists
          let user = await User.findOne({ googleId: hashedGoogleId });

          if (user) {
            // Update last login
            user.lastLogin = new Date();
            await user.save();
            logger.info(`User logged in: ${hashedGoogleId.substring(0, 8)}...`);
            return done(null, user);
          }

          // Create new user with encryption
          // Generate encryption key for new user
          const userKey = encryptionService.generateUserKey();
          const encryptedUserKey = encryptionService.encryptUserKey(userKey);
          
          // Create user with encrypted fields
          user = new User({
            googleId: hashedGoogleId,
            emailHash: emailHash,
            lastLogin: new Date()
          });
          
          // Set virtual fields and encrypt
          user.name = profile.displayName;
          user.picture = profile.photos[0]?.value;
          user.encrypt(userKey);
          
          await user.save();
          
          // Store encryption key
          await UserEncryptionKey.create({
            userId: user._id,
            encryptedKey: encryptedUserKey
          });

          logger.info(`New user created: ${hashedGoogleId.substring(0, 8)}...`);
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
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    logger.error('Error deserializing user:', error);
    done(error, null);
  }
});

export default passport;
