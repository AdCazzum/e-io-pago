/**
 * DM sender for expense approval requests
 */

import { ActionBuilder } from './inline-actions/inline-actions.js';
import { ContentTypeActions } from './inline-actions/types/ActionsContent.js';

import type { ExpenseApproval } from '../types.js';
import type { Agent } from '@xmtp/agent-sdk';

/**
 * Creates action buttons for expense approval
 */
export function createApprovalActions(
  expenseId: string,
  amount: number,
  currency: string,
): ReturnType<typeof ActionBuilder.create> {
  const acceptActionId = `accept-expense-${expenseId}`;
  const rejectActionId = `reject-expense-${expenseId}`;

  return ActionBuilder.create(
    `approval-${expenseId}`,
    `📨 **New Expense Added!**\n\n💰 Total: ${amount.toFixed(2)} ${currency}\n👤 Your share: ${amount.toFixed(2)} ${currency}\n\nPlease confirm:`,
  )
    .add(acceptActionId, '✅ Accept', 'primary')
    .add(rejectActionId, '❌ Reject', 'danger');
}

/**
 * Sends expense approval DMs to all group members (excluding the bot)
 */
export async function sendExpenseApprovalDMs(
  agent: Agent,
  expense: ExpenseApproval,
  memberInboxIds: string[],
): Promise<void> {
  console.log(
    `📨 Sending approval DMs to ${memberInboxIds.length} members for expense ${expense.expenseId}`,
  );

  const botInboxId = agent.client.inboxId;

  // Filter out the bot's inbox ID
  const recipientInboxIds = memberInboxIds.filter((id) => id !== botInboxId);

  console.log(
    `📬 Filtered recipients (excluding bot): ${recipientInboxIds.length}`,
  );

  // Send DM to each member
  for (const memberInboxId of recipientInboxIds) {
    try {
      console.log(`📤 Sending DM to member: ${memberInboxId}`);

      // Create or find DM conversation with this member
      const dm = await agent.client.conversations.newDm(memberInboxId);

      // Create approval action buttons
      const actions = createApprovalActions(
        expense.expenseId,
        expense.perPersonAmount,
        expense.receiptData.currency,
      ).build();

      // Send the approval request with action buttons
      await dm.send(actions, ContentTypeActions);

      console.log(`✅ Sent approval request to ${memberInboxId}`);
    } catch (error) {
      console.error(
        `❌ Failed to send DM to ${memberInboxId}:`,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  console.log(
    `✅ Finished sending approval DMs for expense ${expense.expenseId}`,
  );
}

/**
 * Sends a confirmation DM to a user after they respond to an expense approval
 */
export async function sendApprovalConfirmationDM(
  agent: Agent,
  userInboxId: string,
  decision: 'accepted' | 'rejected',
  amount: number,
  currency: string,
): Promise<void> {
  try {
    const dm = await agent.client.conversations.newDm(userInboxId);

    const emoji = decision === 'accepted' ? '✅' : '❌';
    const action = decision === 'accepted' ? 'accepted' : 'rejected';

    const message = `${emoji} You ${action} the expense of ${amount.toFixed(2)} ${currency}`;

    await dm.send(message);

    console.log(`✅ Sent confirmation DM to ${userInboxId}`);
  } catch (error) {
    console.error(
      `❌ Failed to send confirmation DM to ${userInboxId}:`,
      error instanceof Error ? error.message : String(error),
    );
  }
}
