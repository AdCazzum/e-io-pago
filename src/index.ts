/**
 * XMTP Receipt Split Agent
 *
 * An agent that runs on XMTP (Base Network) and helps groups split bills
 * by analyzing receipt images using GPT-4o Vision API.
 */

import 'dotenv/config';
import { Agent, filter } from '@xmtp/agent-sdk';
import { getTestUrl } from '@xmtp/agent-sdk/debug';
import {
  ContentTypeAttachment,
  AttachmentCodec,
  RemoteAttachmentCodec,
  ContentTypeRemoteAttachment,
} from '@xmtp/content-type-remote-attachment';
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
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

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

  // Note: Attachment codecs are automatically registered by the XMTP Agent SDK

  // Handle agent startup
  agent.on('start', () => {
    console.log('✅ Agent is ready and listening for messages!\n');
    console.log('📬 Agent Address:', agent.address);
    console.log('🔗 Test URL:', getTestUrl(agent.client));
    console.log('🌐 Environment:', process.env.XMTP_ENV || 'dev');
    console.log('\n💡 Add this agent to a group chat and send a receipt image!\n');
  });

  // Global error handler
  agent.errors.use(async (error, ctx) => {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);

    try {
      await ctx.sendText(
        'Sorry, something went wrong processing your request. Please try again in a moment. 🔄'
      );
    } catch (sendError) {
      console.error('Failed to send error message:', sendError);
    }
  });

  // Handle text messages
  agent.on('text', async (ctx) => {
    // Skip own messages to prevent loops
    if (filter.fromSelf(ctx.message, ctx.client)) return;

    const sender = ctx.getSenderAddress();
    const text = ctx.message.content.toLowerCase().trim();

    console.log(`💬 Text message from ${sender}: "${ctx.message.content}"`);

    // Rate limiting check
    if (!checkRateLimit(sender)) {
      console.log(`⏱️  Rate limited: ${sender}`);
      await ctx.sendText('Please wait a moment before sending another request. ⏱️');
      return;
    }

    // Help command
    if (text.includes('help') || text === '/help' || text === '?') {
      await ctx.sendText(createHelpMessage());
      return;
    }

    // Greeting
    if (text.includes('hello') || text.includes('hi') || text.includes('hey')) {
      await ctx.sendText(
        "Hello! 👋 I'm your Receipt Split Agent. Send me a photo of a receipt and I'll help split the bill among everyone in the group!"
      );
      return;
    }

    // Default response for other text
    await ctx.sendText(
      '📸 Please send a receipt image and I\'ll analyze it for you!\n\nType "help" for more information.'
    );
  });

  // Handle attachments and images
  agent.on('message', async (ctx) => {
    const message = ctx.message;
    const sender = ctx.getSenderAddress();

    // Skip own messages
    if (filter.fromSelf(message, ctx.client)) return;

    // Handle regular attachments
    if (message.contentType?.sameAs(ContentTypeAttachment)) {
      console.log(`📎 Attachment received from ${sender}`);

      const attachment = message.content;

      // Check if it's an image
      if (!attachment.mimeType.startsWith('image/')) {
        console.log(`❌ Non-image attachment: ${attachment.mimeType}`);
        await ctx.sendText('Please send an image of your receipt (JPEG or PNG). 📸');
        return;
      }

      // Check image size
      if (attachment.data.length > MAX_IMAGE_SIZE) {
        console.log(`❌ Image too large: ${attachment.data.length} bytes`);
        await ctx.sendText('Image is too large. Please send a smaller image (max 10MB). 📦');
        return;
      }

      // Rate limiting check
      if (!checkRateLimit(sender)) {
        console.log(`⏱️  Rate limited: ${sender}`);
        await ctx.sendText('Please wait a moment before sending another receipt. ⏱️');
        return;
      }

      await processReceiptImage(ctx, attachment.data, attachment.mimeType, openai);
    }
    // Handle remote attachments (larger files)
    else if (message.contentType.sameAs(ContentTypeRemoteAttachment)) {
      console.log(`📎 Remote attachment received from ${sender}`);

      // Rate limiting check
      if (!checkRateLimit(sender)) {
        console.log(`⏱️  Rate limited: ${sender}`);
        await ctx.sendText('Please wait a moment before sending another receipt. ⏱️');
        return;
      }

      await ctx.sendText('Processing your receipt... 🔍');

      try {
        const remoteAttachment = message.content;
        const attachment = await RemoteAttachmentCodec.load(remoteAttachment, ctx.client);

        if (!attachment.mimeType.startsWith('image/')) {
          console.log(`❌ Non-image remote attachment: ${attachment.mimeType}`);
          await ctx.sendText('Please send an image of your receipt (JPEG or PNG). 📸');
          return;
        }

        if (attachment.data.length > MAX_IMAGE_SIZE) {
          console.log(`❌ Remote image too large: ${attachment.data.length} bytes`);
          await ctx.sendText('Image is too large. Please send a smaller image (max 10MB). 📦');
          return;
        }

        await processReceiptImage(ctx, attachment.data, attachment.mimeType, openai);
      } catch (error) {
        console.error('Error loading remote attachment:', error);
        await ctx.sendText(createErrorMessage('processing'));
      }
    }
  });

  // Handle unhandled errors
  agent.on('unhandledError', (error) => {
    console.error('💥 Unhandled error:', error);
  });

  // Start the agent
  console.log('🔄 Starting agent...\n');
  await agent.start();
}

/**
 * Processes a receipt image and sends split calculation
 */
async function processReceiptImage(
  ctx: any,
  imageData: Uint8Array,
  mimeType: string,
  openai: OpenAI
): Promise<void> {
  const sender = ctx.getSenderAddress();
  console.log(`🔍 Processing receipt image from ${sender}...`);

  try {
    // Send processing message
    await ctx.sendText('Analyzing your receipt... 🔍');

    // Convert to base64
    const base64Image = Buffer.from(imageData).toString('base64');
    console.log(`📊 Image size: ${imageData.length} bytes, MIME: ${mimeType}`);

    // Analyze with GPT-4o Vision
    console.log('🤖 Calling GPT-4o Vision API...');
    const receiptData = await analyzeReceipt(base64Image, mimeType, openai);
    console.log(`✅ Receipt analyzed: ${receiptData.merchant}, Total: ${receiptData.total} ${receiptData.currency}`);

    // Validate receipt data
    if (!validateReceiptData(receiptData)) {
      console.error('❌ Invalid receipt data structure');
      await ctx.sendText(createErrorMessage('validation'));
      return;
    }

    // Get group member count
    let numberOfPeople = 1;

    // Check if it's a group chat
    if (ctx.conversation.topic) {
      try {
        const group = ctx.conversation;
        await group.sync();
        const members = await group.members();
        numberOfPeople = members.length;
        console.log(`👥 Group has ${numberOfPeople} members`);
      } catch (error) {
        console.warn('⚠️  Could not get group members, defaulting to 1 person:', error);
      }
    } else {
      console.log('💬 Direct message conversation, using 1 person');
    }

    // Handle edge case: only agent in group or DM
    if (numberOfPeople <= 1) {
      await ctx.sendText(
        `I analyzed your receipt from **${receiptData.merchant}**!\n\n` +
          `Total: **${receiptData.total.toFixed(2)} ${receiptData.currency}**\n\n` +
          `💡 Add more people to the group to split the bill! Right now it's just you (and me 🤖).`
      );
      return;
    }

    // Calculate split
    const perPersonAmount = calculateSplit(receiptData.total, numberOfPeople);
    console.log(`💰 Split: ${perPersonAmount} ${receiptData.currency} per person`);

    // Handle very small amounts
    if (perPersonAmount < 0.01) {
      await ctx.sendText(
        `This amount is too small to split meaningfully (${perPersonAmount.toFixed(2)} ${receiptData.currency} per person). Someone generous can cover it! 😊`
      );
      return;
    }

    // Generate friendly split message using GPT-4o
    console.log('💬 Generating natural language response...');
    try {
      const message = await generateSplitMessage(receiptData, numberOfPeople, perPersonAmount, openai);
      await ctx.sendText(message);
      console.log('✅ Split message sent successfully\n');
    } catch (error) {
      console.warn('⚠️  Failed to generate GPT message, using fallback:', error);
      const fallbackMessage = createFallbackMessage(receiptData, numberOfPeople, perPersonAmount);
      await ctx.sendText(fallbackMessage);
      console.log('✅ Fallback message sent successfully\n');
    }
  } catch (error: any) {
    console.error('❌ Error processing receipt:', error.message);
    console.error('Stack:', error.stack);

    // Determine error type and send appropriate message
    if (error.message?.includes('Invalid receipt data')) {
      await ctx.sendText(createErrorMessage('validation'));
    } else if (error.message?.includes('vision') || error.message?.includes('API')) {
      await ctx.sendText(createErrorMessage('image-quality'));
    } else {
      await ctx.sendText(createErrorMessage('processing'));
    }
  }
}

// Run the agent
main().catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
