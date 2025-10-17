/**
 * Message formatting utilities for natural language responses
 */

import type { ReceiptData } from '../types.js';
import type OpenAI from 'openai';

/**
 * Generates a simple, concise message with just total and per-person amount
 */
export function generateSplitMessage(
  receiptData: ReceiptData,
  numberOfPeople: number,
  perPersonAmount: number,
  _openai: OpenAI,
): string {
  // Simple, direct message with just the essential info
  return `💰 **Total: ${receiptData.total.toFixed(2)} ${receiptData.currency}**

👥 **Per person: ${perPersonAmount.toFixed(2)} ${receiptData.currency}** (${numberOfPeople} ${numberOfPeople === 1 ? 'person' : 'people'})`;
}

/**
 * Creates a structured fallback message (same simple format)
 */
export function createFallbackMessage(
  receiptData: ReceiptData,
  numberOfPeople: number,
  perPersonAmount: number,
): string {
  return `💰 **Total: ${receiptData.total.toFixed(2)} ${receiptData.currency}**

👥 **Per person: ${perPersonAmount.toFixed(2)} ${receiptData.currency}** (${numberOfPeople} ${numberOfPeople === 1 ? 'person' : 'people'})`;
}

/**
 * Creates a help message explaining how to use the agent
 */
export function createHelpMessage(): string {
  return `👋 **Receipt Split Agent**

I help you split bills equally among group members!

**How to use:**
1. 📸 Send a photo of your receipt
2. 🔍 I'll analyze it and extract all items
3. 💰 I'll calculate the split for everyone in the group
4. ✅ Everyone pays their equal share!

**Tips:**
• Make sure the receipt image is clear and well-lit
• The total and items should be visible
• I support JPEG and PNG images
• Works best in group chats!

Send "help" anytime to see this message again. 🤖`;
}

/**
 * Creates an error message for failed receipt processing
 */
export function createErrorMessage(errorType: 'image-quality' | 'processing' | 'validation'): string {
  switch (errorType) {
    case 'image-quality':
      return `📸 **Image Quality Issue**

I'm having trouble reading this receipt. Could you try:
• Taking a clearer photo with better lighting
• Making sure all text is visible and in focus
• Avoiding glare or shadows on the receipt
• Getting closer to the receipt

Please send another photo and I'll try again! 🔍`;

    case 'processing':
      return `⚠️ **Processing Error**

Sorry, I encountered an issue processing your receipt. This could be due to:
• Temporary API issues
• Unusual receipt format
• Missing or unclear information

Please try again in a moment, or send a different photo if the issue persists. 🔄`;

    case 'validation':
      return `❌ **Receipt Data Incomplete**

I couldn't extract all the necessary information from this receipt. Please ensure:
• The total amount is clearly visible
• At least one item is listed
• The receipt isn't cut off or obscured

Try sending another photo with the complete receipt visible! 📄`;

    default:
      return 'Sorry, something went wrong. Please try again! 🔄';
  }
}
