import { createPublicClient, http, type Address, formatEther as viemFormatEther } from 'viem';
import { baseSepolia } from 'viem/chains';

import ExpenseManagerABI from '../../contracts/ExpenseManager.json';

// IMPORTANT: Using the NEW contract address (deployed with correct batchMarkAsPaid function)
const CONTRACT_ADDRESS = '0x2BdC8CC1bcc1C4d9394db0679a6075839F518742' as Address;

// Support both local and testnet RPC
const useLocalNetwork = process.env.NEXT_PUBLIC_USE_LOCAL_NETWORK === 'true';
const RPC_URL = useLocalNetwork
  ? process.env.NEXT_PUBLIC_LOCAL_RPC_URL ?? 'http://127.0.0.1:8545'
  : process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC ?? 'https://sepolia.base.org';

const chain = baseSepolia;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getPublicClient(): any {
  return createPublicClient({
    chain,
    transport: http(RPC_URL),
  });
}

export interface DebtInfo {
  creditor: string
  amount: bigint
}

export interface CreditInfo {
  debtor: string
  amount: bigint
}

export interface ExpenseData {
  id: bigint
  groupId: string
  payer: string
  merchant: string
  totalAmount: bigint
  perPersonAmount: bigint
  currency: string
  ipfsHash: string
  timestamp: bigint
  participants: string[]
  metadata: string
}

export async function getUserDebtsAndCredits(
  groupId: string,
  userAddress: string,
): Promise<{
  debts: DebtInfo[]
  credits: CreditInfo[]
  totalDebts: bigint
  totalCredits: bigint
  netBalance: bigint
}> {
  const client = getPublicClient();

  try {
    const [debtCreditors, debtAmounts] = await client.readContract({
      address: CONTRACT_ADDRESS,
      abi: ExpenseManagerABI.abi,
      functionName: 'getUserDebts',
      args: [groupId, userAddress],
    }) as [readonly Address[], readonly bigint[]];

    const [creditDebtors, creditAmounts] = await client.readContract({
      address: CONTRACT_ADDRESS,
      abi: ExpenseManagerABI.abi,
      functionName: 'getUserCredits',
      args: [groupId, userAddress],
    }) as [readonly Address[], readonly bigint[]];

    // Filter out bot address from debts/credits
    const botAddress = process.env.NEXT_PUBLIC_BOT_ADDRESS?.toLowerCase();

    const debts: DebtInfo[] = debtCreditors
      .map((creditor: Address, i: number) => ({
        creditor,
        amount: debtAmounts[i],
      }))
      .filter((debt: DebtInfo) => botAddress === undefined || debt.creditor.toLowerCase() !== botAddress);

    const credits: CreditInfo[] = creditDebtors
      .map((debtor: Address, i: number) => ({
        debtor,
        amount: creditAmounts[i],
      }))
      .filter((credit: CreditInfo) => botAddress === undefined || credit.debtor.toLowerCase() !== botAddress);

    const totalDebts = debts.reduce((sum, d) => sum + d.amount, 0n);
    const totalCredits = credits.reduce((sum, c) => sum + c.amount, 0n);
    const netBalance = totalCredits - totalDebts;

    return { debts, credits, totalDebts, totalCredits, netBalance };
  } catch (error) {
    console.error('Error fetching debts/credits:', error);
    return {
      debts: [],
      credits: [],
      totalDebts: 0n,
      totalCredits: 0n,
      netBalance: 0n,
    };
  }
}

export async function getGroupExpenses(groupId: string): Promise<ExpenseData[]> {
  const client = getPublicClient();

  try {
    const expenseIds = await client.readContract({
      address: CONTRACT_ADDRESS,
      abi: ExpenseManagerABI.abi,
      functionName: 'getGroupExpenses',
      args: [groupId],
    }) as readonly bigint[];

    const expenses: ExpenseData[] = [];

    for (const id of expenseIds) {
      const expense = await client.readContract({
        address: CONTRACT_ADDRESS,
        abi: ExpenseManagerABI.abi,
        functionName: 'getExpense',
        args: [id],
      }) as ExpenseData;
      expenses.push(expense);
    }

    return expenses;
  } catch (error) {
    console.error('Error fetching expenses:', error);
    return [];
  }
}

export function formatEther(value: bigint): string {
  return viemFormatEther(value);
}

export function formatAddress(addr: string): string {
  return `${addr.slice(0, 6)  }...${  addr.slice(-4)}`;
}
