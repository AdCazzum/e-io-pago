/**
 * XMTP Receipt Split Agent - On-Chain Version
 *
 * Analyzes receipt images and saves expenses on-chain (Base Sepolia)
 */

import 'dotenv/config';
import { Agent, filter, IdentifierKind, type AgentMiddleware } from '@xmtp/agent-sdk';
import { getTestUrl } from '@xmtp/agent-sdk/debug';
import { RemoteAttachmentCodec, AttachmentCodec } from '@xmtp/content-type-remote-attachment';
import { ContentTypeReply, ReplyCodec, type Reply } from '@xmtp/content-type-reply';
import { ContentTypeText } from '@xmtp/content-type-text';
import {
  TransactionReferenceCodec,
  type TransactionReference,
} from '@xmtp/content-type-transaction-reference';
import {
  ContentTypeWalletSendCalls,
  WalletSendCallsCodec,
} from '@xmtp/content-type-wallet-send-calls';
import { ethers } from 'ethers';
import OpenAI from 'openai';

import { analyzeReceipt, calculateSplit } from './utils/receipt-analyzer.js';
import { createHelpMessage } from './utils/message-formatter.js';
import {
  loadRemoteAttachment,
  isImage,
  isSupportedImageFormat,
  attachmentToBase64,
} from './utils/attachment-handler.js';
import { ensureGroupExists, addExpenseOnchain } from './utils/blockchain.js';
import { handlePaidCommand, handleStatusCommand } from './utils/payment-handler.js';

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
async function main(): Promise<void> {
  console.log('🚀 Starting XMTP Receipt Split Agent (On-Chain)...\n');

  // Validate environment variables
  if (process.env.OPENAI_API_KEY === undefined) {
    console.error('❌ Error: OPENAI_API_KEY environment variable is required');
    process.exit(1);
  }

  // Initialize OpenAI client
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  // Shutdown flag to prevent processing during shutdown
  let isShuttingDown = false;

  // Transaction reference middleware - handles confirmed USDC payments
  const transactionReferenceMiddleware: AgentMiddleware = async (ctx, next) => {
    // Check if this is a transaction reference message
    if (ctx.usesCodec(TransactionReferenceCodec)) {
      const transactionRef = ctx.message.content as TransactionReference;
      console.log('✅ Received transaction reference:', transactionRef);

      await ctx.conversation.send(
        `✅ Payment transaction confirmed!\n\n` +
        `🔗 Network: ${transactionRef.networkId}\n` +
        `📄 [View on BaseScan](https://sepolia.basescan.org/tx/${transactionRef.reference})\n\n` +
        `Your debt has been marked as paid on-chain.`,
      );

      // Don't continue to other handlers
      return;
    }

    // Continue to next middleware/handler
    await next();
  };

  // Create XMTP agent with all codecs
  const agent = await Agent.createFromEnv({
    codecs: [
      new RemoteAttachmentCodec(),
      new AttachmentCodec(),
      new ReplyCodec(),
      new WalletSendCallsCodec(),
      new TransactionReferenceCodec(),
    ],
    env: (process.env.XMTP_ENV ?? 'dev') as 'dev' | 'production',
  });

  // Apply transaction middleware
  agent.use(transactionReferenceMiddleware);

  // Handle agent startup
  agent.on('start', async () => {
    console.log('✅ Agent is ready and listening for messages!\n');
    console.log('📬 Agent Address:', agent.address);
    console.log('🔗 Test URL:', getTestUrl(agent.client));
    console.log('🌐 Environment:', process.env.XMTP_ENV ?? 'dev');
    console.log('\n💡 Add this agent to a group chat and send a receipt image!\n');

    // Auto-activate on XMTP network by syncing conversations
    // This ensures the bot is registered and can be added to groups immediately
    try {
      console.log('🔄 Activating bot on XMTP network...');

      // Sync all conversations to register the bot on the network
      await agent.client.conversations.sync();

      // Get all conversations (this triggers network registration)
      const conversations = await agent.client.conversations.list();

      console.log('✅ Bot successfully activated on XMTP network');
      console.log(`   Found ${conversations.length} existing conversation(s)\n`);
    } catch (error) {
      console.log('⚠️  Auto-activation warning:', error);
      console.log('   The bot should still work normally.\n');
    }
  });

  // Handle text messages
  agent.on('text', async (ctx) => {
    // Skip if shutting down
    if (isShuttingDown) return;

    // Skip own messages to prevent loops
    if (filter.fromSelf(ctx.message, ctx.client)) return;

    const sender = await ctx.getSenderAddress();
    if (sender === undefined) {
      console.log('⚠️  Could not get sender address, skipping message');
      return;
    }

    const originalMessage = ctx.message.content.trim();
    const text = originalMessage.toLowerCase();

    // Check if this is a group conversation by checking if it's a DM
    const isDm = filter.isDM(ctx.conversation);
    const isGroup = !isDm;

    console.log(`💬 ${isGroup ? '👥 Group' : '💬 DM'} message from ${sender}: "${originalMessage}"`);

    // Get trigger word from environment (default: @eiopago)
    const triggerWord = (process.env.AGENT_TRIGGER ?? '@eiopago').toLowerCase();

    // If it's a DM, send message that agent only works in groups
    if (isDm) {
      console.log('⏭️  DM received - informing user to use in groups');
      await ctx.conversation.send(
        '👋 Hi! I split group expenses.\n\n' +
        `Add me to a group and send "${triggerWord} status" to see your debts and credits.\n\n` +
        `For help: ${triggerWord} help`,
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
    if (messageToProcess.length === 0) {
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
      const helpReply: Reply = {
        reference: ctx.message.id,
        content: helpMsg,
        contentType: ContentTypeText,
      };
      await ctx.conversation.send(helpReply, ContentTypeReply);
      return;
    }

    // Status command - show balance and mini-app link
    if (processedLower === 'status' || processedLower === 'stato') {
      const baseUrl = process.env.MINIAPP_URL ?? 'http://localhost:3000';

      // Get group ID (conversation.id for groups)
      // Type assertion needed because the SDK types don't include 'id' property
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const conversation = ctx.conversation as any;

      if (isGroup && conversation.id !== undefined) {
        // For groups, show balance info and mini-app link
        const groupId = conversation.id as string;

        console.log(`📊 Sending status for group ${groupId}`);

        await handleStatusCommand(groupId, sender, ctx.conversation, ctx.message.id, agent.address, baseUrl);
      } else {
        // For DMs
        console.log(`📱 Sending base URL for DM: isGroup=${isGroup}, id=${conversation.id ?? 'undefined'}`);

        const reply: Reply = {
          reference: ctx.message.id,
          content: `📊 Use this command in a group to see your debts and credits!\n\n${baseUrl}`,
          contentType: ContentTypeText,
        };

        await ctx.conversation.send(reply, ContentTypeReply);
      }

      return;
    }

    // Paid command - mark debt as paid (manual payment)
    if (processedLower.startsWith('paid ') || processedLower.startsWith('pagato ')) {
      const parts = processedLower.split(' ');
      if (parts.length < 2) {
        await ctx.conversation.send(
          '❌ Usage: `@eiopago paid <creditor>`\n\n' +
          'Tag the creditor using basename or address:\n' +
          '• `@eiopago paid alice.base.eth`\n' +
          '• `@eiopago paid @alice.base.eth`\n' +
          '• `@eiopago paid 0x123...`\n' +
          '• `@eiopago paid @0x123...`',
        );
        return;
      }

      const identifier = parts.slice(1).join(' '); // Support names with spaces
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const conversation = ctx.conversation as any;
      const groupId = conversation.id as string;
      const botPrivateKey = process.env.XMTP_WALLET_KEY ?? '';

      await handlePaidCommand(groupId, sender, identifier, ctx.conversation, ctx.message.id, botPrivateKey, agent.address);
      return;
    }

    // All other messages - show help instead of GPT response
    console.log('⚠️  Unrecognized command - showing help');
    const helpMsg = createHelpMessage();
    const helpReply: Reply = {
      reference: ctx.message.id,
      content: helpMsg,
      contentType: ContentTypeText,
    };
    await ctx.conversation.send(helpReply, ContentTypeReply);
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
    const messageContent =
      typeof replyContent === 'string' ? replyContent : (replyContent as Record<string, unknown>).content ?? '';

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
      const helpReply: Reply = {
        reference: ctx.message.id,
        content: helpMsg,
        contentType: ContentTypeText,
      };
      await ctx.conversation.send(helpReply, ContentTypeReply);
      return;
    }

    // Show help for unrecognized reply
    console.log('⚠️  Unrecognized reply - showing help');
    const helpMsg = createHelpMessage();
    const helpReply: Reply = {
      reference: ctx.message.id,
      content: helpMsg,
      contentType: ContentTypeText,
    };
    await ctx.conversation.send(helpReply, ContentTypeReply);
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
      console.log('⏭️  DM attachment received - ignoring silently');
      return;
    }

    // Rate limiting check
    if (!checkRateLimit(sender)) {
      console.log(`⏱️  Rate limited: ${sender}`);
      return; // Silently ignore rate-limited attachments
    }

    // Variable to store analyzing message ID for error handling
    let analyzingMessageId: string | undefined;

    try {
      console.log('📥 Downloading and decrypting attachment...');

      // Load the remote attachment
      const remoteAttachment = ctx.message.content;
      const attachment = await loadRemoteAttachment(remoteAttachment, agent.client);

      console.log(`📄 Attachment: ${attachment.filename ?? 'unnamed'} (${attachment.mimeType})`);

      // Only process images - silently ignore other file types
      if (!isImage(attachment.mimeType)) {
        console.log('⏭️  Not an image, ignoring');
        return;
      }

      // Only process supported formats - silently ignore others
      if (!isSupportedImageFormat(attachment.mimeType)) {
        console.log('⏭️  Unsupported image format, ignoring');
        return;
      }

      // Convert to base64 for GPT-4o Vision
      const base64Image = attachmentToBase64(attachment.data);

      // Reply to user's message with analyzing status
      const analyzingReply: Reply = {
        reference: ctx.message.id,
        content: '🔍 Analyzing your receipt...',
        contentType: ContentTypeText,
      };
      analyzingMessageId = await ctx.conversation.send(analyzingReply, ContentTypeReply);

      console.log("🔍 Analyzing image to detect if it's a receipt...");

      // Try to analyze the receipt - this will throw if it's not a receipt
      const receiptData = await analyzeReceipt(base64Image, attachment.mimeType, openai);

      console.log(
        `✅ Receipt analyzed: ${receiptData.merchant}, total: ${receiptData.currency} ${receiptData.total}`,
      );

      // Get group members count (excluding the bot)
      const members = await ctx.conversation.members();
      const numberOfPeople = members.length - 1; // Exclude the bot itself

      // Check if there's only one person (the payer)
      if (numberOfPeople <= 1) {
        await ctx.conversation.send(
          '❌ You need at least one other person in the group to split the bill!\n\n' +
          'You cannot owe money to yourself. Add more members to the group.',
        );
        return;
      }

      // Calculate the split: total divided by ALL people (including payer)
      // Each person's share is total/numberOfPeople
      // The payer paid the full amount, so each other member owes them their share
      const perPerson = calculateSplit(receiptData.total, numberOfPeople);
      const numberOfDebtors = numberOfPeople - 1; // Number of people who owe the payer

      console.log(
        `💰 Split calculated: ${receiptData.currency} ${perPerson} per person (${numberOfPeople} people total, ${numberOfDebtors} ${numberOfDebtors === 1 ? 'debtor' : 'debtors'})`,
      );

      // Extract IPFS hash from the remote attachment URL
      // XMTP already uploaded the file to IPFS, we just need to get the hash
      let ipfsHash = '';
      try {
        console.log('📍 Extracting IPFS hash from attachment URL...');
        const attachmentUrl = remoteAttachment.url;
        console.log(`   Attachment URL: ${attachmentUrl}`);

        // Extract IPFS hash from URL (format: https://*/ipfs/Qm... or ipfs://Qm...)
        const ipfsMatch = attachmentUrl.match(/(?:ipfs\/|ipfs:\/\/)([A-Za-z0-9]+)/);
        if (ipfsMatch !== null && ipfsMatch[1] !== undefined) {
          ipfsHash = ipfsMatch[1];
          console.log(`✅ Extracted IPFS hash: ${ipfsHash}`);
        } else {
          console.warn('⚠️  Could not extract IPFS hash from URL, using full URL');
          ipfsHash = attachmentUrl; // Fallback to using the full URL
        }
      } catch (error) {
        console.error('❌ Failed to extract IPFS hash:', error);
        ipfsHash = 'unknown';
      }

      // Save expense on-chain
      // NOTE: For testing, bot uses its own wallet to pay gas
      // In production, this should be signed by the payer
      let txHash = '';
      try {
        console.log('💾 Saving expense on-chain...');

        // Get all member addresses from the group (excluding the bot)
        const members = await ctx.conversation.members();
        const botAddress = agent.address?.toLowerCase();

        if (botAddress === undefined) {
          throw new Error('Bot address is undefined - cannot process expense');
        }

        // Get all addresses EXCEPT bot (bot should never be a group member)
        const memberAddresses = members
          .map((member) => {
            const ethIdentifier = member.accountIdentifiers.find(
              (id) => id.identifierKind === IdentifierKind.Ethereum,
            );
            return ethIdentifier?.identifier;
          })
          .filter((addr): addr is string => addr !== undefined)
          .filter((addr) => addr.toLowerCase() !== botAddress);

        // Ensure group exists on-chain (bot can create group without being a member)
        const groupId = ctx.conversation.id;
        const botPrivateKey = process.env.XMTP_WALLET_KEY;

        if (botPrivateKey === undefined) {
          throw new Error('XMTP_WALLET_KEY not configured');
        }

        await ensureGroupExists(groupId, memberAddresses, botPrivateKey);

        // Add expense on-chain (bot pays gas for now)
        txHash = await addExpenseOnchain(
          groupId,
          receiptData,
          perPerson,
          sender,
          ipfsHash,
          botPrivateKey,
        );

        console.log('✅ Expense saved on-chain! Tx:', txHash);
      } catch (error) {
        console.error('❌ Failed to save on-chain:', error);
        // Continue anyway - the analysis was successful
      }

      // Build IPFS URL for the receipt
      // Use a public gateway (can be configured via env var)
      const ipfsGateway = process.env.PINATA_GATEWAY ?? 'https://gateway.pinata.cloud';
      const ipfsUrl = ipfsHash !== '' && ipfsHash !== 'unknown'
        ? `${ipfsGateway}/ipfs/${ipfsHash}`
        : '';

      const miniappUrl = process.env.MINIAPP_URL ?? '';
      const groupUrl = miniappUrl !== '' ? `${miniappUrl}/group/${ctx.conversation.id}` : '';

      const message = `📝 **New expense added by ${sender.substring(0, 6)}...${sender.substring(sender.length - 4)}**

🏪 **${receiptData.merchant}**
💰 Total: **${receiptData.total.toFixed(2)} ${receiptData.currency}**
👥 Each member owes: **${perPerson.toFixed(2)} ${receiptData.currency}** (${numberOfDebtors} ${numberOfDebtors === 1 ? 'debtor' : 'debtors'})

${ipfsUrl !== '' ? `📸 [View receipt](${ipfsUrl})\n` : ''}
${txHash !== '' ? `⛓️  [View transaction](https://sepolia.basescan.org/tx/${txHash})\n` : ''}
${groupUrl !== '' ? `📊 [Check your debts](${groupUrl})\n` : ''}
✅ **Expense saved on-chain!**

💡 Use \`@eiopago status\` to see your balance or \`@eiopago paid <creditor>\` to mark debts as paid.`;

      // Reply to the analyzing message with the result
      const resultReply: Reply = {
        reference: analyzingMessageId,
        content: message,
        contentType: ContentTypeText,
      };
      await ctx.conversation.send(resultReply, ContentTypeReply);
      console.log('✅ Split message sent successfully!');
    } catch (error) {
      console.error('❌ Error processing attachment:', error);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // If it's not a receipt or validation failed, send a courtesy message
      if (
        errorMessage.includes('not a receipt') ||
        errorMessage.includes('not appear to be') ||
        errorMessage.includes('cannot extract') ||
        errorMessage.includes('valid receipt')
      ) {
        console.log('⏭️  Not a valid receipt, sending courtesy message');

        // Reply to analyzing message if we sent one
        if (analyzingMessageId !== undefined) {
          const courtesyReply: Reply = {
            reference: analyzingMessageId,
            content: 'Thank you for sharing! However, this doesn\'t appear to be a receipt. ' +
              'Please send a clear photo of a receipt so I can help split the bill for your group.',
            contentType: ContentTypeText,
          };
          await ctx.conversation.send(courtesyReply, ContentTypeReply);
        }
        return;
      }

      // For actual processing errors (download, network, API), send user-friendly message
      if (analyzingMessageId !== undefined) {
        const errorReply: Reply = {
          reference: analyzingMessageId,
          content: '❌ Sorry, I encountered an error while processing your receipt. ' +
            'Please try sending the image again, or make sure the receipt is clear and readable.',
          contentType: ContentTypeText,
        };
        await ctx.conversation.send(errorReply, ContentTypeReply);
      } else {
        await ctx.conversation.send(
          '❌ Sorry, I encountered an error while processing your receipt. ' +
          'Please try sending the image again, or make sure the receipt is clear and readable.',
        );
      }
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
      await new Promise((resolve) => {
        setTimeout(resolve, 1000);
      });
      console.log('✅ Shutdown complete');
      process.exit(0);
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
      process.exit(1);
    }
  };

  // Register shutdown handlers
  process.on('SIGINT', () => {
    void gracefulShutdown('SIGINT');
  });
  process.on('SIGTERM', () => {
    void gracefulShutdown('SIGTERM');
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
