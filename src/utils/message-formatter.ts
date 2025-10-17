/**
 * Message formatting utilities for natural language responses
 */

import type { ReceiptData } from '../types.js';
import type OpenAI from 'openai';

/**
 * Generates a natural, friendly message explaining the receipt split
 * Uses GPT-4o to create conversational responses
 */
export async function generateSplitMessage(
  receiptData: ReceiptData,
  numberOfPeople: number,
  perPersonAmount: number,
  openai: OpenAI,
): Promise<string> {
  // Create itemized list
  const itemsList = receiptData.items
    .map(
      (item) =>
        `  • ${item.name}${(item.quantity !== null && item.quantity !== undefined && item.quantity > 1) ? ` (x${item.quantity})` : ''}: ${item.price.toFixed(2)} ${receiptData.currency}`,
    )
    .join('\n');

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You are a helpful, friendly assistant that helps groups split bills fairly.
        Generate a natural, conversational message explaining the receipt and bill split.
        Be clear, concise, and friendly. Use emojis appropriately to make the message engaging.
        Keep the tone casual and helpful, like you're helping friends split a bill.

        Structure your response to include:
        1. A friendly greeting acknowledging the receipt
        2. Key details (merchant, date if available, total)
        3. The itemized list provided
        4. Clear split calculation
        5. A friendly closing

        Make sure the split amount is very clear and easy to find.`,
      },
      {
        role: 'user',
        content: `Create a message for a group chat explaining this receipt split:
        - Merchant: ${receiptData.merchant}
        ${(receiptData.date !== null && receiptData.date !== undefined && receiptData.date !== '') ? `- Date: ${receiptData.date}` : ''}
        - Subtotal: ${receiptData.subtotal.toFixed(2)} ${receiptData.currency}
        - Tax: ${receiptData.tax.toFixed(2)} ${receiptData.currency}
        ${(receiptData.tip !== null && receiptData.tip !== undefined && receiptData.tip > 0) ? `- Tip: ${receiptData.tip.toFixed(2)} ${receiptData.currency}` : ''}
        - Total: ${receiptData.total.toFixed(2)} ${receiptData.currency}
        - Number of people: ${numberOfPeople}
        - Amount per person: ${perPersonAmount.toFixed(2)} ${receiptData.currency}

        Items:
${itemsList}`,
      },
    ],
    max_tokens: 500,
    temperature: 0.7, // Slightly higher for more natural variation
  });

  const message = response.choices[0].message.content;
  if (message === null || message === undefined || message === '') {
    // Fallback to structured message if GPT doesn't respond
    return createFallbackMessage(receiptData, numberOfPeople, perPersonAmount);
  }

  return message;
}

/**
 * Creates a structured fallback message if GPT-4o fails
 */
export function createFallbackMessage(
  receiptData: ReceiptData,
  numberOfPeople: number,
  perPersonAmount: number,
): string {
  const itemsList = receiptData.items
    .map(
      (item) =>
        `• ${item.name}${(item.quantity !== null && item.quantity !== undefined && item.quantity > 1) ? ` (x${item.quantity})` : ''}: ${item.price.toFixed(2)} ${receiptData.currency}`,
    )
    .join('\n');

  return `📝 **Receipt Analysis Complete!**

🏪 **${receiptData.merchant}**
${(receiptData.date !== null && receiptData.date !== undefined && receiptData.date !== '') ? `📅 Date: ${receiptData.date}\n` : ''}
**Items:**
${itemsList}

💰 Subtotal: ${receiptData.subtotal.toFixed(2)} ${receiptData.currency}
🧾 Tax: ${receiptData.tax.toFixed(2)} ${receiptData.currency}
${(receiptData.tip !== null && receiptData.tip !== undefined && receiptData.tip > 0) ? `💵 Tip: ${receiptData.tip.toFixed(2)} ${receiptData.currency}\n` : ''}
**Total: ${receiptData.total.toFixed(2)} ${receiptData.currency}**

👥 **Split Between ${numberOfPeople} ${numberOfPeople === 1 ? 'Person' : 'People'}:**
**Each person pays: ${perPersonAmount.toFixed(2)} ${receiptData.currency}** 🎯

Time to settle up! 💸`;
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
