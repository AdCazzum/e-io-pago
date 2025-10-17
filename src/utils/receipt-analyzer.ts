/**
 * Receipt analysis using GPT-4o Vision API
 */

import OpenAI from 'openai';
import type { ReceiptData } from '../types.js';

/**
 * Analyzes a receipt image using GPT-4o Vision API
 * @param base64Image - Base64 encoded image data
 * @param mimeType - MIME type of the image (e.g., 'image/jpeg')
 * @param openai - OpenAI client instance
 * @returns Structured receipt data
 */
export async function analyzeReceipt(
  base64Image: string,
  mimeType: string,
  openai: OpenAI
): Promise<ReceiptData> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You are a receipt analysis expert. Extract all information from receipts and return structured JSON data with these fields:
        - merchant: string (store/restaurant name)
        - date: string (transaction date, if visible, in YYYY-MM-DD format)
        - items: array of {name: string, price: number, quantity: number}
        - subtotal: number (before tax)
        - tax: number
        - tip: number (if applicable, otherwise 0)
        - total: number (final amount)
        - currency: string (USD, EUR, etc.)

        Be precise with numbers. If a field is not clearly visible, use reasonable defaults:
        - date: null if not visible
        - quantity: 1 if not specified
        - tip: 0 if not applicable
        - currency: "USD" if not specified

        Extract ALL items visible on the receipt. Be thorough and accurate.`,
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Analyze this receipt image and extract all data in the specified JSON format. Be thorough and extract every item visible.',
          },
          {
            type: 'image_url',
            image_url: {
              url: `data:${mimeType};base64,${base64Image}`,
              detail: 'high', // Use high detail for better OCR accuracy
            },
          },
        ],
      },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 1500,
    temperature: 0.1, // Low temperature for consistency
  });

  const result = response.choices[0].message.content;
  if (!result) {
    throw new Error('No response from GPT-4o Vision API');
  }

  const receiptData = JSON.parse(result) as ReceiptData;

  // Validate the data
  if (!validateReceiptData(receiptData)) {
    throw new Error('Invalid receipt data structure received from API');
  }

  return receiptData;
}

/**
 * Validates that the receipt data has the required structure
 */
export function validateReceiptData(data: any): data is ReceiptData {
  return (
    data &&
    typeof data.merchant === 'string' &&
    typeof data.total === 'number' &&
    data.total > 0 &&
    typeof data.subtotal === 'number' &&
    typeof data.tax === 'number' &&
    typeof data.currency === 'string' &&
    Array.isArray(data.items) &&
    data.items.length > 0 &&
    data.items.every(
      (item: any) =>
        typeof item.name === 'string' &&
        typeof item.price === 'number' &&
        item.price >= 0
    )
  );
}

/**
 * Calculates the bill split for a group
 */
export function calculateSplit(total: number, numberOfPeople: number): number {
  if (numberOfPeople <= 0) {
    throw new Error('Number of people must be greater than 0');
  }
  // Round to 2 decimal places
  return Math.round((total / numberOfPeople) * 100) / 100;
}
