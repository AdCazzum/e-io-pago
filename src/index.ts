/**
 * XMTP Receipt Split Agent
 *
 * Simplified version that works with current XMTP Agent SDK
 */

import 'dotenv/config';
import { Agent, filter } from '@xmtp/agent-sdk';
import { getTestUrl } from '@xmtp/agent-sdk/debug';
import OpenAI from 'openai';

import { analyzeReceipt, validateReceiptData, calculateSplit } from './utils/receipt-analyzer.js';
import {
  generateSplitMessage,
  createFallbackMessage,
  createHelpMessage,
  createErrorMessage,
} from './utils/message-formatter.js';

// Rate limiting map to prevent spam
const rateLimitMap = new Map<string, number>();
const RATE_LIMIT_MS = 5000; // 5 seconds between requests

/**
 * Checks if a user is rate limited
 */
function checkRateLimit(userAddress: string): boolean {
  const lastRequest = rateLimitMap.get(userAddress);
  const now = Date.now();

  if (lastRequest && now - lastRequest < RATE_LIMIT_MS) {
    return false;
  }

  rateLimitMap.set(userAddress, now);
  return true;
}

/**
 * Main agent function
 */
async function main() {
  console.log('🚀 Starting XMTP Receipt Split Agent...\n');

  // Validate environment variables
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ Error: OPENAI_API_KEY environment variable is required');
    process.exit(1);
  }

  // Initialize OpenAI client
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  // Create XMTP agent
  const agent = await Agent.createFromEnv({
    env: (process.env.XMTP_ENV || 'dev') as 'dev' | 'production',
  });

  // Handle agent startup
  agent.on('start', () => {
    console.log('✅ Agent is ready and listening for messages!\n');
    console.log('📬 Agent Address:', agent.address);
    console.log('🔗 Test URL:', getTestUrl(agent.client));
    console.log('🌐 Environment:', process.env.XMTP_ENV || 'dev');
    console.log('\n💡 Add this agent to a group chat and send a message!\n');
  });

  // Handle text messages
  agent.on('text', async (ctx) => {
    // Skip own messages to prevent loops
    if (filter.fromSelf(ctx.message, ctx.client)) return;

    const sender = await ctx.getSenderAddress();
    const text = ctx.message.content.toLowerCase().trim();

    console.log(`💬 Text message from ${sender}: "${ctx.message.content}"`);

    // Rate limiting check
    if (!checkRateLimit(sender)) {
      console.log(`⏱️  Rate limited: ${sender}`);
      await ctx.conversation.send('Please wait a moment before sending another request. ⏱️');
      return;
    }

    // Help command
    if (text.includes('help') || text === '/help' || text === '?') {
      const helpMsg = createHelpMessage();
      await ctx.conversation.send(helpMsg);
      return;
    }

    // Greeting
    if (text.includes('hello') || text.includes('hi') || text.includes('hey')) {
      await ctx.conversation.send(
        "Hello! 👋 I'm your Receipt Split Agent. Send me a photo of a receipt and I'll help split the bill among everyone in the group!"
      );
      return;
    }

    // Default response for other text
    await ctx.conversation.send(
      '📸 Please send a receipt image and I\'ll analyze it for you!\n\nType "help" for more information.'
    );
  });

  // Handle unhandled errors
  agent.on('unhandledError', (error) => {
    console.error('💥 Unhandled error:', error);
  });

  // Start the agent
  console.log('🔄 Starting agent...\n');
  await agent.start();
}

// Run the agent
main().catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
