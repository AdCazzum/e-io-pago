import { ethers } from 'ethers';
import ExpenseManagerABI from '../contracts/ExpenseManager.json';

const CONTRACT_ADDRESS = '0x2BdC8CC1bcc1C4d9394db0679a6075839F518742';
const RPC_URL = 'https://sepolia.base.org';
const GROUP_ID = '5970ebcdd7f313ec0406723bdf657cb9';

async function checkExpenseDetails(): Promise<void> {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ExpenseManagerABI.abi, provider);

  console.log('📊 Checking expense details...\n');

  const expenseIds = await contract.getGroupExpenses(GROUP_ID);

  for (const id of expenseIds) {
    const expense = await contract.getExpense(id);
    console.log(`Expense #${id}:`);
    console.log(`  Payer: ${expense.payer}`);
    console.log(`  Merchant: ${expense.merchant}`);
    console.log(`  Total: ${ethers.formatEther(expense.totalAmount)} ${expense.currency}`);
    console.log(`  Per person: ${ethers.formatEther(expense.perPersonAmount)} ${expense.currency}`);
    console.log(`  Participants: ${expense.participants.length}`);
    for (const p of expense.participants) {
      console.log(`    - ${p}`);
    }
    console.log('');
  }

  // Check total debt
  const USER_ADDRESS = '0x1Ecf8f677a61a2D7B984919f76218b5D5Fb478d2';
  const CREDITOR = '0xD3E8055D0C0fBDc608b488E61F000A794F231359';

  const totalDebt = await contract.getDebt(GROUP_ID, USER_ADDRESS, CREDITOR);
  console.log(`\nTotal debt from ${USER_ADDRESS} to ${CREDITOR}:`);
  console.log(`  ${ethers.formatEther(totalDebt)} ETH`);
}

checkExpenseDetails().catch(console.error);
