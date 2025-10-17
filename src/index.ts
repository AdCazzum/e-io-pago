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
 * Generates a natural conversational response using GPT-4o
 */
async function generateConversationalResponse(
  userMessage: string,
  openai: OpenAI
): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a helpful, friendly Receipt Split Agent for XMTP group chats. Your main purpose is to help groups split bills by analyzing receipt images.

Your personality:
- Friendly and conversational
- Helpful and supportive
- Use emojis occasionally but not excessively
- Keep responses concise (2-3 sentences max)
- Always relate back to your main purpose when appropriate

Key information about you:
- You can analyze receipt images using GPT-4o Vision
- You calculate equal bill splits for group members
- You work in XMTP group chats on Base Network
- Users send you receipt photos and you tell them how to split the bill

When users ask what you do, explain your receipt splitting functionality.
When users greet you, be warm and welcoming.
When users ask questions, answer helpfully and encourage them to try sending a receipt.`,
        },
        {
          role: 'user',
          content: userMessage,
        },
      ],
      max_tokens: 150,
      temperature: 0.8,
    });

    return response.choices[0].message.content || 'Hello! How can I help you today?';
  } catch (error) {
    console.error('Error generating conversational response:', error);
    // Fallback to simple response
    return "I'm here to help you split bills! Send me a receipt image and I'll analyze it for you. Type 'help' for more info.";
  }
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

    const sender = (await ctx.getSenderAddress()) || 'unknown';
    const originalMessage = ctx.message.content.trim();
    const text = originalMessage.toLowerCase();

    // Check if this is a group conversation by checking if it's a DM
    const isDm = filter.isDM(ctx.conversation);
    const isGroup = !isDm;

    console.log(`💬 ${isGroup ? '👥 Group' : '💬 DM'} message from ${sender}: "${originalMessage}"`);

    // Get trigger word from environment (default: @eiopago)
    const triggerWord = (process.env.AGENT_TRIGGER || '@eiopago').toLowerCase();

    // If it's a DM, send message that agent only works in groups
    if (isDm) {
      console.log(`⏭️  DM received - informing user to use in groups`);
      await ctx.conversation.send(
        `👋 Hi! I'm a group expense splitting agent.\n\n` +
        `Please add me to a group chat and tag me with "${triggerWord}" to use me.\n\n` +
        `Example: ${triggerWord} help`
      );
      return;
    }

    // In group chats, only respond if triggered
    if (!text.startsWith(triggerWord)) {
      console.log(`⏭️  Skipping group message (not triggered with "${triggerWord}")`);
      return;
    }

    console.log(`✅ Triggered in group with: "${triggerWord}"`);


    // Remove trigger word from message for processing (if present)
    let messageToProcess = originalMessage;
    if (text.startsWith(triggerWord)) {
      messageToProcess = originalMessage.substring(triggerWord.length).trim();
    }

    // If empty after removing trigger, use default
    if (!messageToProcess) {
      messageToProcess = 'hello';
    }

    // Rate limiting check
    if (!checkRateLimit(sender)) {
      console.log(`⏱️  Rate limited: ${sender}`);
      await ctx.conversation.send('Please wait a moment before sending another request. ⏱️');
      return;
    }

    // Help command - keep this as structured response
    const processedLower = messageToProcess.toLowerCase().trim();
    if (processedLower === 'help' || processedLower === '/help' || processedLower === '?') {
      const helpMsg = createHelpMessage();
      await ctx.conversation.send(helpMsg);
      return;
    }

    // All other messages - use GPT for natural responses
    console.log('🤖 Generating GPT response...');
    const response = await generateConversationalResponse(messageToProcess, openai);
    console.log(`✅ GPT response: "${response}"`);
    await ctx.conversation.send(response);
  });

  // Handle replies (when someone replies to agent's message)
  // This is the "native" way to mention/tag the agent
  agent.on('reply', async (ctx) => {
    // Skip own messages
    if (filter.fromSelf(ctx.message, ctx.client)) return;

    const sender = await ctx.getSenderAddress();
    const replyContent = ctx.message.content;

    // Extract the text content from the Reply object
    const messageContent = typeof replyContent === 'string'
      ? replyContent
      : (replyContent as any).content || '';

    console.log(`💬 Reply received from ${sender}: "${messageContent}"`);

    // Rate limiting check
    if (!checkRateLimit(sender)) {
      console.log(`⏱️  Rate limited: ${sender}`);
      await ctx.conversation.send('Please wait a moment before sending another request. ⏱️');
      return;
    }

    // Help command
    const text = String(messageContent).toLowerCase().trim();
    if (text === 'help' || text === '/help' || text === '?') {
      const helpMsg = createHelpMessage();
      await ctx.conversation.send(helpMsg);
      return;
    }

    // Generate GPT response for the reply
    console.log('🤖 Generating GPT response to reply...');
    const response = await generateConversationalResponse(String(messageContent), openai);
    console.log(`✅ GPT response: "${response}"`);
    await ctx.conversation.send(response);
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
