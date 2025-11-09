import dotenv from 'dotenv';

// Load environment variables FIRST - this file is imported before anything else
dotenv.config();

// Validate critical environment variables
if (!process.env.ENCRYPTION_KEY) {
  console.error('❌ ERROR: ENCRYPTION_KEY not found in .env file!');
  console.error('The server cannot start without this key.');
  console.error('Please ensure your .env file contains: ENCRYPTION_KEY=...');
  process.exit(1);
}

if (!process.env.MONGODB_URI) {
  console.error('❌ ERROR: MONGODB_URI not found in .env file!');
  process.exit(1);
}

if (!process.env.SESSION_SECRET) {
  console.error('❌ ERROR: SESSION_SECRET not found in .env file!');
  console.error('Required for user sessions.');
  process.exit(1);
}

console.log('✅ Environment variables loaded successfully');
console.log('✅ Database configured: MongoDB');
console.log('✅ Session management configured');
console.log(`ℹ️  NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
console.log(`ℹ️  CLIENT_URL: ${process.env.CLIENT_URL || 'http://localhost:3000'}`);
console.log(`ℹ️  FRONTEND_URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
console.log(`ℹ️  GOOGLE_CALLBACK_URL: ${process.env.GOOGLE_CALLBACK_URL || 'not set'}`);
console.log(`ℹ️  COOKIE_DOMAIN: ${process.env.COOKIE_DOMAIN || 'not set (using default)'}`);

