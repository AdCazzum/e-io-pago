/**
 * XMTP Receipt Split Agent
 *
 * Simplified version that works with current XMTP Agent SDK
 */

import 'dotenv/config';
import { Agent, filter } from '@xmtp/agent-sdk';
import { getTestUrl } from '@xmtp/agent-sdk/debug';
import { RemoteAttachmentCodec, AttachmentCodec } from '@xmtp/content-type-remote-attachment';
import OpenAI from 'openai';

import { analyzeReceipt, calculateSplit } from './utils/receipt-analyzer.js';
import {
  generateSplitMessage,
  createHelpMessage,
  createErrorMessage,
} from './utils/message-formatter.js';
import {
  loadRemoteAttachment,
  isImage,
  isSupportedImageFormat,
  attachmentToBase64,
} from './utils/attachment-handler.js';
import {
  inlineActionsMiddleware,
  registerAction,
} from './utils/inline-actions/inline-actions.js';
import { ActionsCodec } from './utils/inline-actions/types/ActionsContent.js';
import { IntentCodec } from './utils/inline-actions/types/IntentContent.js';
import {
  createExpenseApproval,
  getExpenseById,
  recordApproval,
} from './utils/expense-manager.js';
import {
  sendExpenseApprovalDMs,
  sendApprovalConfirmationDM,
} from './utils/dm-sender.js';

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

  // Shutdown flag to prevent processing during shutdown
  let isShuttingDown = false;

  // Create XMTP agent with attachment codecs and inline actions
  const agent = await Agent.createFromEnv({
    codecs: [
      new RemoteAttachmentCodec(),
      new AttachmentCodec(),
      new ActionsCodec(),
      new IntentCodec(),
    ],
    env: (process.env.XMTP_ENV || 'dev') as 'dev' | 'production',
  });

  // Register inline actions middleware
  agent.use(inlineActionsMiddleware);

  // Register action handlers for expense approval
  // These handlers will be triggered when users click Accept or Reject buttons
  // Action ID format: accept-expense-{expenseId} or reject-expense-{expenseId}
  const handleExpenseAction = async (
    expenseId: string,
    decision: 'accepted' | 'rejected',
    ctx: Parameters<typeof registerAction>[1] extends (ctx: infer C) => Promise<void> ? C : never,
  ): Promise<void> => {
    console.log(`🎯 Processing ${decision} action for expense ${expenseId}`);

    // Get the expense from the manager
    const expense = getExpenseById(expenseId);

    if (expense === undefined) {
      console.error(`❌ Expense not found: ${expenseId}`);
      await ctx.sendText('❌ This expense approval has expired or is invalid.');
      return;
    }

    // Get user's address (from their inbox ID)
    const userInboxId = ctx.message.senderInboxId;
    const userAddress = await ctx.getSenderAddress();

    if (userAddress === undefined) {
      console.error('❌ Could not get sender address');
      await ctx.sendText('❌ Could not verify your identity. Please try again.');
      return;
    }

    // Record the approval
    const recorded = recordApproval(expenseId, userAddress, decision);

    if (!recorded) {
      await ctx.sendText('❌ Failed to record your response. Please try again.');
      return;
    }

    // Send confirmation DM to the user
    await sendApprovalConfirmationDM(
      agent,
      userInboxId,
      decision,
      expense.perPersonAmount,
      expense.receiptData.currency,
    );

    // Send announcement to the group
    try {
      const groupConversation = await agent.client.conversations.getConversationById(
        expense.groupConversationId,
      );

      if (groupConversation === undefined) {
        console.error('❌ Could not find group conversation');
        return;
      }

      const emoji = decision === 'accepted' ? '✅' : '❌';
      const action = decision === 'accepted' ? 'accepted' : 'rejected';
      const shortAddress = `${userAddress.substring(0, 6)}...${userAddress.substring(userAddress.length - 4)}`;

      const announcement = `${emoji} ${shortAddress} ${action} the expense of ${expense.perPersonAmount.toFixed(2)} ${expense.receiptData.currency}`;

      await groupConversation.send(announcement);

      console.log(`✅ Sent announcement to group for ${userAddress}`);
    } catch (error) {
      console.error(
        '❌ Error sending group announcement:',
        error instanceof Error ? error.message : String(error),
      );
    }
  };

  // Register dynamic action handlers
  // We'll register handlers as expenses are created, but also set up a fallback handler
  // that can handle any expense action dynamically
  const expenseActionPattern = /^(accept|reject)-expense-(.+)$/;

  // Use a generic handler that parses the action ID
  const genericExpenseHandler = async (ctx: Parameters<typeof registerAction>[1] extends (ctx: infer C) => Promise<void> ? C : never): Promise<void> => {
    // Get the action ID from the intent content
    const intentContent = ctx.message.content as { actionId?: string };
    const actionId = intentContent.actionId ?? '';

    const match = expenseActionPattern.exec(actionId);

    if (match === null) {
      console.error(`❌ Invalid expense action format: ${actionId}`);
      await ctx.sendText('❌ Invalid action format.');
      return;
    }

    const decision = match[1] === 'accept' ? 'accepted' : 'rejected';
    const expenseId = match[2];

    await handleExpenseAction(expenseId, decision as 'accepted' | 'rejected', ctx);
  };

  // We'll need to register handlers dynamically when expenses are created
  // For now, we'll just keep track of this handler function to use later
  const registerExpenseActionHandlers = (expenseId: string): void => {
    registerAction(`accept-expense-${expenseId}`, genericExpenseHandler);
    registerAction(`reject-expense-${expenseId}`, genericExpenseHandler);
    console.log(`✅ Registered action handlers for expense ${expenseId}`);
  };

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
    // Skip if shutting down
    if (isShuttingDown) return;

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
    // Skip if shutting down
    if (isShuttingDown) return;

    // Skip own messages
    if (filter.fromSelf(ctx.message, ctx.client)) {
      return;
    }

    const sender = await ctx.getSenderAddress();
    if (sender === undefined) {
      console.log('⚠️  Could not get sender address, skipping message');
      return;
    }

    const replyContent = ctx.message.content;

    // Extract the text content from the Reply object
    const messageContent = typeof replyContent === 'string'
      ? replyContent
      : (replyContent as Record<string, unknown>).content ?? '';

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

  // Handle attachments (images, files)
  agent.on('attachment', async (ctx) => {
    // Skip if shutting down
    if (isShuttingDown) return;

    // Skip own messages
    if (filter.fromSelf(ctx.message, ctx.client)) {
      return;
    }

    const sender = await ctx.getSenderAddress();
    if (sender === undefined) {
      console.log('⚠️  Could not get sender address, skipping attachment');
      return;
    }

    // Check if this is a group conversation
    const isDm = filter.isDM(ctx.conversation);
    const isGroup = !isDm;

    console.log(`📎 ${isGroup ? '👥 Group' : '💬 DM'} attachment from ${sender}`);

    // If it's a DM, ignore silently (agent only works in groups)
    if (isDm) {
      console.log(`⏭️  DM attachment received - ignoring silently`);
      return;
    }

    // Rate limiting check
    if (!checkRateLimit(sender)) {
      console.log(`⏱️  Rate limited: ${sender}`);
      return; // Silently ignore rate-limited attachments
    }

    try {
      console.log('📥 Downloading and decrypting attachment...');

      // Load the remote attachment
      const remoteAttachment = ctx.message.content;
      const attachment = await loadRemoteAttachment(
        remoteAttachment,
        agent.client
      );

      console.log(`📄 Attachment: ${attachment.filename || 'unnamed'} (${attachment.mimeType})`);

      // Only process images - silently ignore other file types
      if (!isImage(attachment.mimeType)) {
        console.log(`⏭️  Not an image, ignoring`);
        return;
      }

      // Only process supported formats - silently ignore others
      if (!isSupportedImageFormat(attachment.mimeType)) {
        console.log(`⏭️  Unsupported image format, ignoring`);
        return;
      }

      // Convert to base64 for GPT-4o Vision
      const base64Image = attachmentToBase64(attachment.data);

      console.log('🔍 Analyzing image to detect if it\'s a receipt...');

      // Try to analyze the receipt - this will throw if it's not a receipt
      const receiptData = await analyzeReceipt(base64Image, attachment.mimeType, openai);

      console.log(`✅ Receipt analyzed: ${receiptData.merchant}, total: ${receiptData.currency} ${receiptData.total}`);

      // Get group members count (excluding the bot)
      const members = await ctx.conversation.members();
      const numberOfPeople = members.length - 1; // Exclude the bot itself

      if (numberOfPeople <= 0) {
        await ctx.conversation.send(
          '❌ I need at least 2 people in the group to split the bill!\n\n' +
          'Please add more members to the group.'
        );
        return;
      }

      // Calculate the split
      const perPerson = calculateSplit(receiptData.total, numberOfPeople);

      console.log(`💰 Split calculated: ${receiptData.currency} ${perPerson} per person (${numberOfPeople} people)`);

      // Generate and send the split message to the group
      const splitMessage = generateSplitMessage(
        receiptData,
        numberOfPeople,
        perPerson,
        openai
      );

      await ctx.conversation.send(splitMessage);
      console.log('✅ Split message sent successfully!');

      // NEW: Create expense approval and send DMs to all members
      console.log('📨 Creating expense approval workflow...');

      // Create the expense approval record
      const expense = createExpenseApproval(
        receiptData,
        perPerson,
        numberOfPeople,
        ctx.conversation.id,
      );

      // Register action handlers for this specific expense
      registerExpenseActionHandlers(expense.expenseId);

      // Get member inbox IDs
      const memberInboxIds = members.map((member) => member.inboxId);

      // Send DM to each member with approval buttons
      await sendExpenseApprovalDMs(agent, expense, memberInboxIds);

      console.log('✅ Expense approval workflow initiated!');

    } catch (error) {
      console.error('❌ Error processing attachment:', error);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // If it's not a receipt or validation failed, ignore silently
      if (errorMessage.includes('not a receipt') ||
          errorMessage.includes('not appear to be') ||
          errorMessage.includes('cannot extract') ||
          errorMessage.includes('valid receipt')) {
        console.log('⏭️  Not a valid receipt, ignoring silently');
        return;
      }

      // For actual processing errors (download, network, API), send user-friendly message
      await ctx.conversation.send(
        '❌ Sorry, I encountered an error while processing your receipt. ' +
        'Please try sending the image again, or make sure the receipt is clear and readable.'
      );
    }
  });

  // Handle unhandled errors
  agent.on('unhandledError', (error) => {
    console.error('💥 Unhandled error:', error);
  });

  // Graceful shutdown handler
  const gracefulShutdown = async (signal: string): Promise<void> => {
    if (isShuttingDown) {
      return;
    }
    isShuttingDown = true;

    console.log(`\n⚠️  Received ${signal}, shutting down gracefully...`);

    try {
      // Give ongoing operations time to complete
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log('✅ Shutdown complete');
      process.exit(0);
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
      process.exit(1);
    }
  };

  // Register shutdown handlers
  process.on('SIGINT', () => void gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));

  // Start the agent
  console.log('🔄 Starting agent...\n');
  await agent.start();
}

// Run the agent
main().catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
