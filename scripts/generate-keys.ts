/**
 * Generate XMTP wallet and encryption keys
 *
 * This script generates:
 * - A new Ethereum wallet private key for the XMTP agent
 * - A database encryption key for securing local XMTP data
 *
 * Run with: npm run gen:keys
 */

import { randomBytes } from 'crypto';
import { Wallet } from 'ethers';
import { writeFileSync, existsSync } from 'fs';
import { join } from 'path';

function generateKeys() {
  console.log('🔑 Generating XMTP keys...\n');

  // Check if .env already exists
  const envPath = join(process.cwd(), '.env');
  if (existsSync(envPath)) {
    console.log('⚠️  Warning: .env file already exists!');
    console.log('This script will NOT overwrite your existing .env file.');
    console.log('To regenerate keys, please backup and remove the existing .env file first.\n');
    process.exit(0);
  }

  // Generate wallet
  const wallet = Wallet.createRandom();
  const privateKey = wallet.privateKey;
  const address = wallet.address;

  // Generate encryption key (32 bytes hex)
  const encryptionKey = randomBytes(32).toString('hex');

  // Create .env content
  const envContent = `# XMTP Agent Configuration
# Generated on ${new Date().toISOString()}

# XMTP Wallet Configuration
XMTP_WALLET_KEY=${privateKey}
XMTP_DB_ENCRYPTION_KEY=${encryptionKey}
XMTP_ENV=dev

# OpenAI Configuration
# Get your API key from: https://platform.openai.com/api-keys
OPENAI_API_KEY=your_openai_api_key_here
`;

  // Write to .env file
  writeFileSync(envPath, envContent);

  console.log('✅ Keys generated successfully!\n');
  console.log('📝 Configuration saved to .env\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔐 Agent Wallet Details:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Address: ${address}`);
  console.log(`Private Key: ${privateKey}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('⚠️  IMPORTANT: Keep your private key secure!');
  console.log('⚠️  Never commit the .env file to version control!\n');
  console.log('📋 Next steps:');
  console.log('1. Edit .env and add your OpenAI API key');
  console.log('   Get one at: https://platform.openai.com/api-keys');
  console.log('2. (Optional) Fund this wallet address on Base Network');
  console.log('   Use Base Faucet: https://portal.cdp.coinbase.com/products/faucet');
  console.log('3. Run the agent: npm run dev\n');
  console.log('💡 Save the wallet address to add the agent to group chats!\n');
}

// Run the script
try {
  generateKeys();
} catch (error) {
  console.error('❌ Error generating keys:', error);
  process.exit(1);
}
