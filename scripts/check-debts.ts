import { ethers } from 'ethers';
import ExpenseManagerABI from '../contracts/ExpenseManager.json';
import dotenv from 'dotenv';

dotenv.config();

const CONTRACT_ADDRESS = process.env.EXPENSE_CONTRACT_ADDRESS ?? '';
const RPC_URL = process.env.BASE_SEPOLIA_RPC ?? 'https://sepolia.base.org';
const USER_ADDRESS = '0x1Ecf8f677a61a2D7B984919f76218b5D5Fb478d2';

async function checkDebts(): Promise<void> {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ExpenseManagerABI.abi, provider);

  console.log('🔍 Checking debts on contract...');
  console.log(`   Contract: ${CONTRACT_ADDRESS}`);
  console.log(`   User: ${USER_ADDRESS}`);
  console.log('');

  // Get all groups for the user
  const groupIds = await contract.getUserGroups(USER_ADDRESS);
  console.log(`📋 User belongs to ${groupIds.length} group(s)`);
  console.log('');

  for (const groupId of groupIds) {
    console.log(`\n📁 Group: ${groupId}`);
    console.log('━'.repeat(80));

    // Get group members
    const members = await contract.getGroupMembers(groupId);
    console.log(`👥 Members (${members.length}):`);
    for (const member of members) {
      console.log(`   - ${member}`);
    }
    console.log('');

    // Get user debts
    const [creditors, amounts] = await contract.getUserDebts(groupId, USER_ADDRESS);
    console.log(`💸 Debts (${creditors.length}):`);
    for (let i = 0; i < creditors.length; i++) {
      const amountEth = ethers.formatEther(amounts[i]);
      console.log(`   - Owes ${creditors[i]}: ${amountEth} ETH`);
    }
    console.log('');

    // Get user credits
    const [debtors, creditAmounts] = await contract.getUserCredits(groupId, USER_ADDRESS);
    console.log(`💰 Credits (${debtors.length}):`);
    for (let i = 0; i < debtors.length; i++) {
      const amountEth = ethers.formatEther(creditAmounts[i]);
      console.log(`   - ${debtors[i]} owes me: ${amountEth} ETH`);
    }
    console.log('');

    // Get all expenses
    const expenseIds = await contract.getGroupExpenses(groupId);
    console.log(`📊 Total expenses: ${expenseIds.length}`);

    for (const expenseId of expenseIds) {
      const expense = await contract.getExpense(expenseId);
      console.log(`\n   Expense #${expenseId}:`);
      console.log(`   - Payer: ${expense.payer}`);
      console.log(`   - Merchant: ${expense.merchant}`);
      console.log(`   - Total: ${ethers.formatEther(expense.totalAmount)} ${expense.currency}`);
      console.log(`   - Per person: ${ethers.formatEther(expense.perPersonAmount)} ${expense.currency}`);
      console.log(`   - Participants (${expense.participants.length}):`);
      for (const participant of expense.participants) {
        console.log(`     - ${participant}`);
      }
    }
  }
}

checkDebts().catch(console.error);
