import express from 'express';
import { batchMarkDebtsAsPaid } from '../utils/blockchain.js';
import { findExpensesByCreditor } from '../utils/blockchain.js';

const router = express.Router();

interface MarkPaidRequest {
  groupId: string;
  debtorAddress: string;
  creditorAddress: string;
  signature: string; // Signature from user to verify ownership
}

/**
 * POST /api/mark-paid
 * Marks debts as paid using bot's wallet (bot pays gas)
 */
router.post('/mark-paid', async (req, res) => {
  try {
    const { groupId, debtorAddress, creditorAddress, signature }: MarkPaidRequest = req.body;

    // Validate inputs
    if (!groupId || !debtorAddress || !creditorAddress) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // TODO: Verify signature to ensure request is from actual debtor
    // For now, we'll skip signature verification but it should be added for production

    const botPrivateKey = process.env.XMTP_WALLET_KEY;
    if (botPrivateKey === undefined) {
      return res.status(500).json({ error: 'Bot wallet key not configured' });
    }

    // Find matching expenses
    const expenseIds = await findExpensesByCreditor(groupId, debtorAddress, creditorAddress);

    if (expenseIds.length === 0) {
      return res.status(404).json({ error: 'No debts found to this creditor' });
    }

    // Mark debts as paid (bot pays gas)
    const txHash = await batchMarkDebtsAsPaid(expenseIds, creditorAddress, botPrivateKey);

    return res.json({
      success: true,
      txHash,
      expenseIds: expenseIds.map((id) => id.toString()),
    });
  } catch (error) {
    console.error('Error in /api/mark-paid:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
