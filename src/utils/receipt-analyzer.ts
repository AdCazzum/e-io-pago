/**
 * Receipt analysis using GPT-4o Vision API
 */

import type { ReceiptData } from '../types.js';
import type OpenAI from 'openai';

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
  openai: OpenAI,
): Promise<ReceiptData> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You are a receipt analysis expert. Your task is to determine if an image is a receipt, and if so, extract all information.

IMPORTANT: First check if this is actually a receipt (restaurant bill, shop receipt, invoice with itemized purchases). If it's NOT a receipt (e.g., a photo of people, landscape, meme, random document), respond with:
{"isReceipt": false}

If it IS a receipt, return structured JSON data with these fields:
{
  "isReceipt": true,
  "merchant": string (store/restaurant name),
  "date": string (transaction date in YYYY-MM-DD format, or null),
  "items": array of {name: string, price: number, quantity: number},
  "subtotal": number (before tax),
  "tax": number,
  "tip": number (if applicable, otherwise 0),
  "total": number (final amount),
  "currency": string (USD, EUR, etc.)
}

Defaults for missing fields:
- date: null if not visible
- quantity: 1 if not specified
- tip: 0 if not applicable
- currency: "USD" if not specified

Extract ALL items visible on the receipt.`,
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'First, determine if this is a receipt. If yes, extract all data in the specified JSON format. If no, return {"isReceipt": false}.',
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
  if (result === null || result === undefined || result === '') {
    throw new Error('No response from GPT-4o Vision API');
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const parsedResult = JSON.parse(result);

  // Check if GPT-4o determined this is not a receipt
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  if (parsedResult.isReceipt === false) {
    throw new Error('Image does not appear to be a valid receipt');
  }

  const receiptData = parsedResult as ReceiptData;

  // Validate the data
  if (!validateReceiptData(receiptData)) {
    throw new Error('Invalid receipt data structure received from API');
  }

  return receiptData;
}

/**
 * Validates that the receipt data has the required structure
 */
export function validateReceiptData(data: unknown): data is ReceiptData {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const candidate = data as Record<string, unknown>;

  return (
    typeof candidate.merchant === 'string' &&
    typeof candidate.total === 'number' &&
    candidate.total > 0 &&
    typeof candidate.subtotal === 'number' &&
    typeof candidate.tax === 'number' &&
    typeof candidate.currency === 'string' &&
    Array.isArray(candidate.items) &&
    candidate.items.length > 0 &&
    candidate.items.every(
      (item: unknown) => {
        if (typeof item !== 'object' || item === null) {
          return false;
        }
        const itemCandidate = item as Record<string, unknown>;
        return (
          typeof itemCandidate.name === 'string' &&
          typeof itemCandidate.price === 'number' &&
          itemCandidate.price >= 0
        );
      },
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
