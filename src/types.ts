/**
 * Types and interfaces for the XMTP Receipt Split Agent
 */

/**
 * Represents a single item on a receipt
 */
export interface ReceiptItem {
  name: string;
  price: number;
  quantity?: number;
}

/**
 * Complete structured data extracted from a receipt
 */
export interface ReceiptData {
  merchant: string;
  date?: string;
  items: ReceiptItem[];
  subtotal: number;
  tax: number;
  tip?: number;
  total: number;
  currency: string;
}

/**
 * Bill split calculation result
 */
export interface SplitResult {
  total: number;
  numberOfPeople: number;
  perPerson: number;
  currency: string;
}

/**
 * Configuration for the agent
 */
export interface AgentConfig {
  env: 'dev' | 'production';
  dbPath?: string;
  openaiApiKey: string;
}
