/**
 * Expense approval state management
 */

import type { ExpenseApproval, ReceiptData } from '../types.js';

// In-memory storage for pending expense approvals
const pendingExpenses = new Map<string, ExpenseApproval>();

/**
 * Generates a unique expense ID based on timestamp and random suffix
 */
export function generateExpenseId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `exp-${timestamp}-${random}`;
}

/**
 * Creates a new expense approval record
 */
export function createExpenseApproval(
  receiptData: ReceiptData,
  perPersonAmount: number,
  numberOfPeople: number,
  groupConversationId: string,
): ExpenseApproval {
  const expenseId = generateExpenseId();

  const expense: ExpenseApproval = {
    expenseId,
    receiptData,
    perPersonAmount,
    numberOfPeople,
    approvals: new Map<string, 'accepted' | 'rejected'>(),
    groupConversationId,
    createdAt: new Date(),
  };

  pendingExpenses.set(expenseId, expense);

  console.log(`✅ Created expense approval: ${expenseId}`);

  return expense;
}

/**
 * Records a user's approval or rejection of an expense
 */
export function recordApproval(
  expenseId: string,
  userAddress: string,
  decision: 'accepted' | 'rejected',
): boolean {
  const expense = pendingExpenses.get(expenseId);

  if (expense === undefined) {
    console.error(`❌ Expense not found: ${expenseId}`);
    return false;
  }

  expense.approvals.set(userAddress.toLowerCase(), decision);

  console.log(
    `✅ Recorded ${decision} from ${userAddress} for expense ${expenseId}`,
  );

  return true;
}

/**
 * Retrieves an expense by ID
 */
export function getExpenseById(expenseId: string): ExpenseApproval | undefined {
  return pendingExpenses.get(expenseId);
}

/**
 * Gets all pending expenses (for debugging/monitoring)
 */
export function getAllPendingExpenses(): Map<string, ExpenseApproval> {
  return pendingExpenses;
}

/**
 * Removes an expense from pending state (after all approvals collected or timeout)
 */
export function removeExpense(expenseId: string): boolean {
  const removed = pendingExpenses.delete(expenseId);

  if (removed) {
    console.log(`🗑️  Removed expense: ${expenseId}`);
  }

  return removed;
}

/**
 * Clears all pending expenses (for testing/cleanup)
 */
export function clearAllExpenses(): void {
  pendingExpenses.clear();
  console.log('🧹 Cleared all pending expenses');
}

/**
 * Gets approval status summary for an expense
 */
export function getApprovalSummary(expenseId: string): {
  total: number;
  accepted: number;
  rejected: number;
  pending: number;
} | null {
  const expense = pendingExpenses.get(expenseId);

  if (expense === undefined) {
    return null;
  }

  const total = expense.numberOfPeople;
  let accepted = 0;
  let rejected = 0;

  expense.approvals.forEach((decision) => {
    if (decision === 'accepted') {
      accepted++;
    } else {
      rejected++;
    }
  });

  const pending = total - (accepted + rejected);

  return {
    total,
    accepted,
    rejected,
    pending,
  };
}
