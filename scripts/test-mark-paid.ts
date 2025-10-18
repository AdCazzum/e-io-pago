import { ethers } from 'ethers';
import ExpenseManagerABI from '../contracts/ExpenseManager.json';
import dotenv from 'dotenv';

dotenv.config();

const CONTRACT_ADDRESS = '0x2BdC8CC1bcc1C4d9394db0679a6075839F518742'; // NEW contract
const RPC_URL = process.env.BASE_SEPOLIA_RPC ?? 'https://sepolia.base.org';
const USER_PRIVATE_KEY = process.env.XMTP_WALLET_KEY; // Using bot key as temporary test
const USER_ADDRESS = '0x1Ecf8f677a61a2D7B984919f76218b5D5Fb478d2';
const CREDITOR_ADDRESS = '0xD3E8055D0C0fBDc608b488E61F000A794F231359'; // Real creditor

async function testMarkAsPaid(): Promise<void> {
  if (USER_PRIVATE_KEY === undefined) {
    console.error('❌ Private key not found');
    process.exit(1);
  }

  console.log('🧪 Testing batchMarkAsPaid...');
  console.log(`   Contract: ${CONTRACT_ADDRESS}`);
  console.log(`   Debtor: ${USER_ADDRESS}`);
  console.log(`   Creditor: ${CREDITOR_ADDRESS}`);
  console.log('');

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(USER_PRIVATE_KEY, provider);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ExpenseManagerABI.abi, wallet);

  // Get user groups
  const groupIds = await contract.getUserGroups(USER_ADDRESS);
  if (groupIds.length === 0) {
    console.error('❌ User has no groups');
    process.exit(1);
  }

  const groupId = groupIds[0];
  console.log(`📁 Testing with group: ${groupId}`);
  console.log('');

  // Get debts
  const [creditors, amounts] = await contract.getUserDebts(groupId, USER_ADDRESS);
  console.log(`💸 Found ${creditors.length} debts`);

  let creditorIndex = -1;
  for (let i = 0; i < creditors.length; i++) {
    const amountEth = ethers.formatEther(amounts[i]);
    console.log(`   ${i}: Owes ${creditors[i]} → ${amountEth} ETH`);
    if (creditors[i].toLowerCase() === CREDITOR_ADDRESS.toLowerCase()) {
      creditorIndex = i;
    }
  }

  if (creditorIndex === -1) {
    console.error(`❌ No debt found to creditor ${CREDITOR_ADDRESS}`);
    process.exit(1);
  }

  console.log('');
  console.log(`✅ Found debt to creditor at index ${creditorIndex}`);
  console.log('');

  // Get total debt first
  const totalDebt = await contract.getDebt(groupId, USER_ADDRESS, CREDITOR_ADDRESS);
  console.log(`📊 Total debt: ${ethers.formatEther(totalDebt)} ETH`);

  // Get all expenses
  const allExpenseIds = await contract.getGroupExpenses(groupId);
  console.log(`📊 Total expenses in group: ${allExpenseIds.length}`);

  // Find matching expenses (only up to total debt)
  const matchingExpenses: bigint[] = [];
  let accumulatedAmount = 0n;

  for (const expenseId of allExpenseIds) {
    const expense = await contract.getExpense(expenseId);

    // Check if payer is the creditor
    if (expense.payer.toLowerCase() !== CREDITOR_ADDRESS.toLowerCase()) {
      continue;
    }

    // Check if user is a participant
    const isParticipant = expense.participants.some(
      (p: string) => p.toLowerCase() === USER_ADDRESS.toLowerCase(),
    );

    if (isParticipant) {
      // Only add if it doesn't exceed total debt
      if (accumulatedAmount + expense.perPersonAmount <= totalDebt) {
        matchingExpenses.push(expenseId);
        accumulatedAmount += expense.perPersonAmount;
        console.log(`   ✓ Expense #${expenseId} matches (${ethers.formatEther(expense.perPersonAmount)} ETH)`);
      } else {
        console.log(`   ✗ Expense #${expenseId} would exceed debt (${ethers.formatEther(expense.perPersonAmount)} ETH)`);
      }
    }
  }

  if (matchingExpenses.length === 0) {
    console.error('❌ No matching expenses found');
    process.exit(1);
  }

  console.log('');
  console.log(`✅ Found ${matchingExpenses.length} matching expense(s)`);
  console.log('');

  // Try to call batchMarkAsPaid
  console.log('🚀 Calling batchMarkAsPaid...');
  console.log(`   expenseIds: [${matchingExpenses.join(', ')}]`);
  console.log(`   debtor: ${USER_ADDRESS}`);
  console.log(`   creditor: ${CREDITOR_ADDRESS}`);
  console.log('');

  try {
    // Estimate gas first
    console.log('⛽ Estimating gas...');
    const gasEstimate = await contract.batchMarkAsPaid.estimateGas(
      matchingExpenses,
      USER_ADDRESS,
      CREDITOR_ADDRESS,
    );
    console.log(`   Estimated gas: ${gasEstimate.toString()}`);
    console.log('');

    console.log('📤 Sending transaction...');
    const tx = await contract.batchMarkAsPaid(
      matchingExpenses,
      USER_ADDRESS,
      CREDITOR_ADDRESS,
    );

    console.log(`✅ Transaction sent: ${tx.hash}`);
    console.log('⏳ Waiting for confirmation...');

    const receipt = await tx.wait();
    console.log('✅ Transaction confirmed!');
    console.log(`   Block: ${receipt.blockNumber}`);
    console.log(`   Gas used: ${receipt.gasUsed.toString()}`);
  } catch (error: any) {
    console.error('❌ Transaction failed!');
    console.error('');
    console.error('Error details:');
    if (error.message) {
      console.error('Message:', error.message);
    }
    if (error.reason) {
      console.error('Reason:', error.reason);
    }
    if (error.code) {
      console.error('Code:', error.code);
    }
    if (error.data) {
      console.error('Data:', error.data);
    }
    throw error;
  }
}

testMarkAsPaid().catch((error) => {
  console.error('\n💥 Script failed:', error);
  process.exit(1);
});
