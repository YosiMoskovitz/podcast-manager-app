import dotenv from 'dotenv';

// Load environment variables FIRST - this file is imported before anything else
dotenv.config();

// Validate critical environment variables
if (!process.env.ENCRYPTION_MASTER_KEY) {
  console.error('❌ ERROR: ENCRYPTION_MASTER_KEY not found in .env file!');
  console.error('The server cannot start without this key.');
  console.error('This key is used to encrypt per-user encryption keys.');
  console.error('Generate a new key with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  console.error('Please ensure your .env file contains: ENCRYPTION_MASTER_KEY=...');
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
console.log('✅ Encryption configured (master key loaded)');

