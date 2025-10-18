import { ethers } from 'ethers'
import ExpenseManagerABI from './contracts/ExpenseManager.json'

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_EXPENSE_CONTRACT_ADDRESS || ''
const RPC_URL = process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC || 'https://sepolia.base.org'

export function getContract() {
  const provider = new ethers.JsonRpcProvider(RPC_URL)
  return new ethers.Contract(CONTRACT_ADDRESS, ExpenseManagerABI.abi, provider)
}

export function getContractWithSigner(signer: ethers.Signer) {
  return new ethers.Contract(CONTRACT_ADDRESS, ExpenseManagerABI.abi, signer)
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

export async function getUserDebtsAndCredits(groupId: string, userAddress: string) {
  const contract = getContract()

  try {
    const [debtCreditors, debtAmounts] = await contract.getUserDebts(groupId, userAddress)
    const [creditDebtors, creditAmounts] = await contract.getUserCredits(groupId, userAddress)

    const debts: DebtInfo[] = debtCreditors.map((creditor: string, i: number) => ({
      creditor,
      amount: debtAmounts[i],
    }))

    const credits: CreditInfo[] = creditDebtors.map((debtor: string, i: number) => ({
      debtor,
      amount: creditAmounts[i],
    }))

    const totalDebts = debts.reduce((sum, d) => sum + d.amount, 0n)
    const totalCredits = credits.reduce((sum, c) => sum + c.amount, 0n)
    const netBalance = totalCredits - totalDebts

    return { debts, credits, totalDebts, totalCredits, netBalance }
  } catch (error) {
    console.error('Error fetching debts/credits:', error)
    return {
      debts: [],
      credits: [],
      totalDebts: 0n,
      totalCredits: 0n,
      netBalance: 0n,
    }
  }
}

export async function getGroupExpenses(groupId: string): Promise<ExpenseData[]> {
  const contract = getContract()

  try {
    const expenseIds = await contract.getGroupExpenses(groupId)
    const expenses: ExpenseData[] = []

    for (const id of expenseIds) {
      const expense = await contract.getExpense(id)
      expenses.push(expense)
    }

    return expenses
  } catch (error) {
    console.error('Error fetching expenses:', error)
    return []
  }
}

export function formatEther(value: bigint): string {
  return ethers.formatEther(value)
}

export function formatAddress(addr: string): string {
  return addr.slice(0, 6) + '...' + addr.slice(-4)
}
