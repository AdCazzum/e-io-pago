/**
 * Payment handling utilities
 * Handles "paid" command for debt settlement
 */

import { ContentTypeReply, type Reply } from '@xmtp/content-type-reply';
import { ContentTypeText } from '@xmtp/content-type-text';

import { resolveCreditorAddress } from './address-resolver.js';
import {
  getUserBalanceInfo,
  getGroupExpenses,
  getExpense,
  batchMarkDebtsAsPaid,
  findExpensesByCreditor,
} from './blockchain.js';

import type { Conversation } from '@xmtp/agent-sdk';

/**
 * Handles the "paid <creditor>" command
 * User marks all their debts to a creditor as paid (without actual payment)
 * @param creditor Creditor identifier (basename or address)
 */
export async function handlePaidCommand(
  groupId: string,
  sender: string,
  creditor: string,
  conversation: Conversation,
  messageId: string,
  botPrivateKey: string,
  _botAddress?: string,
): Promise<void> {
  try {
    // Resolve creditor identifier to address
    const creditorAddress = await resolveCreditorAddress(creditor, conversation);

    if (creditorAddress === null) {
      const reply: Reply = {
        reference: messageId,
        content: `❌ Could not find member "${creditor}" in this group.\n\n` +
          'Use basename (e.g., `@eiopago paid alice.base.eth`) or address (e.g., `@eiopago paid 0x123...`).',
        contentType: ContentTypeText,
      };
      await conversation.send(reply, ContentTypeReply);
      return;
    }

    // Find ALL expenses where sender owes money to this creditor
    const matchingExpenses = await findExpensesByCreditor(groupId, sender, creditorAddress);

    if (matchingExpenses.length === 0) {
      const reply: Reply = {
        reference: messageId,
        content: `❌ You don't owe any money to ${creditor}.\n\n` +
          'Use `@eiopago status` to see your current debts.',
        contentType: ContentTypeText,
      };
      await conversation.send(reply, ContentTypeReply);
      return;
    }

    // Mark ALL expenses as paid using batch transaction
    console.log(`💸 Marking ${matchingExpenses.length} expense(s) as paid by ${sender} (batch)...`);

    const paidExpenses: Array<{ id: bigint; merchant: string; amount: number; currency: string }> = [];
    let totalAmount = 0;
    let txHash = '';

    // Collect expense details first
    for (const expenseId of matchingExpenses) {
      const expense = await getExpense(expenseId);
      if (expense === null) {
        continue;
      }

      const amountEUR = Number(expense.perPersonAmount) / 1e18;
      totalAmount += amountEUR;

      paidExpenses.push({
        id: expenseId,
        merchant: expense.merchant,
        amount: amountEUR,
        currency: expense.currency,
      });
    }

    // Mark all expenses as paid in a single transaction
    try {
      txHash = await batchMarkDebtsAsPaid(matchingExpenses, sender, creditorAddress, botPrivateKey);
    } catch (error) {
      console.error('❌ Failed to mark expenses as paid (batch):', error);
      const reply: Reply = {
        reference: messageId,
        content: `❌ Failed to mark debts as paid: ${error instanceof Error ? error.message : 'Unknown error'}`,
        contentType: ContentTypeText,
      };
      await conversation.send(reply, ContentTypeReply);
      return;
    }

    // Build response message
    if (paidExpenses.length === 0) {
      const reply: Reply = {
        reference: messageId,
        content: '❌ Failed to mark any debts as paid. Please try again or check the transaction logs.',
        contentType: ContentTypeText,
      };
      await conversation.send(reply, ContentTypeReply);
      return;
    }

    let message = `✅ **${paidExpenses.length} debt(s) marked as paid!**\n\n`;
    message += `👤 Paid to: ${creditorAddress.substring(0, 6)}...${creditorAddress.substring(creditorAddress.length - 4)}\n`;
    message += `💰 Total: ${totalAmount.toFixed(2)} EUR\n\n`;

    if (paidExpenses.length > 0) {
      message += '**Expenses:**\n';
      for (const exp of paidExpenses) {
        message += `• #${exp.id} - ${exp.merchant}: ${exp.amount.toFixed(2)} ${exp.currency}\n`;
      }
    }

    if (txHash !== '') {
      message += `\n⛓️  [View transaction](https://sepolia.basescan.org/tx/${txHash})`;
    }

    const reply: Reply = {
      reference: messageId,
      content: message,
      contentType: ContentTypeText,
    };
    await conversation.send(reply, ContentTypeReply);
  } catch (error) {
    console.error('Error handling paid command:', error);
    const reply: Reply = {
      reference: messageId,
      content: `❌ Failed to mark debt as paid: ${error instanceof Error ? error.message : 'Unknown error'}`,
      contentType: ContentTypeText,
    };
    await conversation.send(reply, ContentTypeReply);
  }
}

/**
 * Handles the "status" command
 * Shows user's current debts, credits, and mini-app link
 */
export async function handleStatusCommand(
  groupId: string,
  sender: string,
  conversation: Conversation,
  messageId: string,
  botAddress?: string,
  miniappUrl?: string,
): Promise<void> {
  try {
    console.log(`📊 Fetching debts for ${sender} in group ${groupId}...`);

    const balanceInfo = await getUserBalanceInfo(groupId, sender, botAddress);

    if (balanceInfo.debts.length === 0 && balanceInfo.credits.length === 0) {
      const reply: Reply = {
        reference: messageId,
        content: '✅ You have no debts or credits in this group!',
        contentType: ContentTypeText,
      };
      await conversation.send(reply, ContentTypeReply);
      return;
    }

    let message = '📊 **Your Balance**\n\n';

    // Show debts (what you owe)
    if (balanceInfo.debts.length > 0) {
      message += '💸 **You owe:**\n';
      for (const debt of balanceInfo.debts) {
        const amount = Number(debt.amount) / 1e18;
        message += `• ${amount.toFixed(2)} EUR to ${debt.creditor.substring(0, 6)}...${debt.creditor.substring(debt.creditor.length - 4)}\n`;
      }
      message += '\n';
    }

    // Show credits (what others owe you)
    if (balanceInfo.credits.length > 0) {
      message += '💰 **Others owe you:**\n';
      for (const credit of balanceInfo.credits) {
        const amount = Number(credit.amount) / 1e18;
        message += `• ${amount.toFixed(2)} EUR from ${credit.debtor.substring(0, 6)}...${credit.debtor.substring(credit.debtor.length - 4)}\n`;
      }
      message += '\n';
    }

    // Show net balance
    const netBalance = Number(balanceInfo.netBalance) / 1e18;
    if (netBalance > 0) {
      message += `✅ Net balance: +${netBalance.toFixed(2)} EUR (you are owed)`;
    } else if (netBalance < 0) {
      message += `⚠️  Net balance: ${netBalance.toFixed(2)} EUR (you owe)`;
    } else {
      message += `✅ Net balance: ${netBalance.toFixed(2)} EUR (even)`;
    }

    // Get expenses for expense IDs
    const expenseIds = await getGroupExpenses(groupId);
    if (expenseIds.length > 0) {
      message += '\n\n💡 Use `@eiopago paid <creditor>` to settle debts.';
    }

    // Add mini-app link
    if (miniappUrl !== undefined && miniappUrl !== '') {
      const groupUrl = `${miniappUrl}/group/${groupId}`;
      message += `\n\n🔗 [View full details in mini-app](${groupUrl})`;
    }

    const reply: Reply = {
      reference: messageId,
      content: message,
      contentType: ContentTypeText,
    };
    await conversation.send(reply, ContentTypeReply);
  } catch (error) {
    console.error('Error handling debts command:', error);
    await conversation.send(
      `❌ Failed to fetch debts: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}
