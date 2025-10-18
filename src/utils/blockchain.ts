/**
 * Blockchain integration for ExpenseManager smart contract
 * Handles all interactions with the on-chain expense tracking system
 */

import { ethers } from 'ethers';

import ExpenseManagerArtifact from '../contracts/ExpenseManager.json' assert { type: 'json' };

import type { ReceiptData } from '../types.js';

// Type the ABI
const EXPENSE_MANAGER_ABI = ExpenseManagerArtifact.abi;

/**
 * Gets a configured ethers provider
 * Supports both local Hardhat node and Base Sepolia
 */
function getProvider(): ethers.JsonRpcProvider {
  // Use RPC_URL for generic configuration, fallback to BASE_SEPOLIA_RPC for backward compatibility
  const rpcUrl = process.env.RPC_URL ?? process.env.BASE_SEPOLIA_RPC ?? 'https://sepolia.base.org';
  return new ethers.JsonRpcProvider(rpcUrl);
}

/**
 * Gets the ExpenseManager contract instance (read-only)
 */
function getContract(): ethers.Contract {
  const contractAddress = process.env.EXPENSE_CONTRACT_ADDRESS;

  if (contractAddress === undefined) {
    throw new Error('EXPENSE_CONTRACT_ADDRESS environment variable is required');
  }

  const provider = getProvider();
  return new ethers.Contract(contractAddress, EXPENSE_MANAGER_ABI, provider);
}

/**
 * Gets a contract instance with a signer (for write operations)
 * @param privateKey Private key of the account that will pay gas
 */
function getContractWithSigner(privateKey: string): ethers.Contract {
  const contractAddress = process.env.EXPENSE_CONTRACT_ADDRESS;

  if (contractAddress === undefined) {
    throw new Error('EXPENSE_CONTRACT_ADDRESS environment variable is required');
  }

  const provider = getProvider();
  const wallet = new ethers.Wallet(privateKey, provider);
  return new ethers.Contract(contractAddress, EXPENSE_MANAGER_ABI, wallet);
}

/**
 * Checks if a group exists on-chain
 * @param groupId XMTP conversation ID
 * @returns true if group exists
 */
export async function groupExists(groupId: string): Promise<boolean> {
  try {
    const contract = getContract();
    const group = await contract.groups(groupId);
    return group.exists as boolean;
  } catch (error) {
    console.error('Error checking if group exists:', error);
    return false;
  }
}

/**
 * Creates a new group on-chain
 * @param groupId XMTP conversation ID
 * @param members Array of member addresses
 * @param creatorPrivateKey Private key of the creator (will pay gas)
 */
export async function createGroup(
  groupId: string,
  members: string[],
  creatorPrivateKey: string,
): Promise<void> {
  try {
    console.log(`📝 Creating group on-chain: ${groupId}`);
    console.log(`   Members: ${members.length}`);

    const contract = getContractWithSigner(creatorPrivateKey);

    const tx = await contract.createGroup(groupId, members);
    console.log(`   Transaction hash: ${tx.hash}`);

    await tx.wait();
    console.log('✅ Group created successfully on-chain');
  } catch (error) {
    console.error('❌ Error creating group on-chain:', error);
    throw new Error(
      `Failed to create group on-chain: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Ensures a group exists on-chain, creating it if necessary
 * @param groupId XMTP conversation ID
 * @param members Array of member addresses
 * @param creatorPrivateKey Private key of the creator
 */
export async function ensureGroupExists(
  groupId: string,
  members: string[],
  creatorPrivateKey: string,
): Promise<void> {
  const exists = await groupExists(groupId);

  if (!exists) {
    console.log(`📝 Group ${groupId} doesn't exist, creating...`);
    await createGroup(groupId, members, creatorPrivateKey);

    // Wait and verify the group was created
    console.log('⏳ Waiting for group creation to be confirmed...');
    let retries = 0;
    const maxRetries = 10;
    while (retries < maxRetries) {
      await new Promise((resolve) => {
        setTimeout(resolve, 2000);
      }); // Wait 2 seconds
      const nowExists = await groupExists(groupId);
      if (nowExists) {
        console.log('✅ Group creation confirmed on-chain');
        return;
      }
      retries++;
      console.log(`   Retry ${retries}/${maxRetries}...`);
    }

    throw new Error('Group creation timed out - transaction may still be pending');
  } else {
    console.log(`✅ Group ${groupId} already exists on-chain`);
  }
}

/**
 * Adds an expense to the blockchain
 * @param groupId XMTP conversation ID
 * @param receiptData Receipt data from GPT-4o Vision
 * @param perPersonAmount Calculated amount per person
 * @param payerAddress Address of the person who paid (who uploaded the receipt)
 * @param ipfsHash IPFS CID of the receipt image
 * @param payerPrivateKey Private key of the payer (will pay gas for this transaction)
 */
export async function addExpenseOnchain(
  groupId: string,
  receiptData: ReceiptData,
  perPersonAmount: number,
  payerAddress: string,
  ipfsHash: string,
  payerPrivateKey: string,
): Promise<string> {
  try {
    console.log('💰 Adding expense on-chain...');
    console.log(`   Group: ${groupId}`);
    console.log(`   Merchant: ${receiptData.merchant}`);
    console.log(`   Total: ${receiptData.total} ${receiptData.currency}`);
    console.log(`   Per person: ${perPersonAmount} ${receiptData.currency}`);
    console.log(`   Payer: ${payerAddress}`);
    console.log(`   IPFS: ${ipfsHash}`);

    const contract = getContractWithSigner(payerPrivateKey);

    // Convert amounts to wei (assuming EUR/USD = smallest unit for now)
    // In production, you might want to use a stablecoin or proper decimal handling
    const totalAmountWei = ethers.parseUnits(receiptData.total.toString(), 18);
    const perPersonAmountWei = ethers.parseUnits(perPersonAmount.toString(), 18);

    // Create metadata JSON string
    const metadata = JSON.stringify({
      items: receiptData.items,
      subtotal: receiptData.subtotal,
      tax: receiptData.tax,
      tip: receiptData.tip,
      date: receiptData.date,
    });

    // Call smart contract
    const tx = await contract.addExpense(
      groupId,
      receiptData.merchant,
      totalAmountWei,
      perPersonAmountWei,
      receiptData.currency,
      ipfsHash,
      metadata,
    );

    console.log(`   Transaction hash: ${tx.hash}`);

    const receipt = await tx.wait();
    console.log('✅ Expense added on-chain successfully!');
    console.log(`   Block: ${receipt.blockNumber}`);
    console.log(`   Gas used: ${receipt.gasUsed.toString()}`);

    return tx.hash as string;
  } catch (error) {
    console.error('❌ Error adding expense on-chain:', error);
    throw new Error(
      `Failed to add expense on-chain: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Gets all expenses for a group
 * @param groupId XMTP conversation ID
 * @returns Array of expense IDs
 */
export async function getGroupExpenses(groupId: string): Promise<bigint[]> {
  try {
    const contract = getContract();
    const expenseIds = (await contract.getGroupExpenses(groupId)) as bigint[];
    return expenseIds;
  } catch (error) {
    console.error('Error fetching group expenses:', error);
    return [];
  }
}

/**
 * Gets debt information for a user in a group
 * @param groupId XMTP conversation ID
 * @param userAddress User's Ethereum address
 * @returns Object with debts (what user owes) and credits (what others owe user)
 */
export async function getUserBalanceInfo(
  groupId: string,
  userAddress: string,
): Promise<{
  debts: Array<{ creditor: string; amount: bigint }>;
  credits: Array<{ debtor: string; amount: bigint }>;
  netBalance: bigint;
}> {
  try {
    const contract = getContract();

    // Get what user owes to others
    const [debtCreditors, debtAmounts] = (await contract.getUserDebts(
      groupId,
      userAddress,
    )) as [string[], bigint[]];

    const debts = debtCreditors.map((creditor, index) => ({
      creditor,
      amount: debtAmounts[index] ?? 0n,
    }));

    // Get what others owe to user
    const [creditDebtors, creditAmounts] = (await contract.getUserCredits(
      groupId,
      userAddress,
    )) as [string[], bigint[]];

    const credits = creditDebtors.map((debtor, index) => ({
      debtor,
      amount: creditAmounts[index] ?? 0n,
    }));

    // Calculate net balance (credits - debts)
    const totalDebts = debts.reduce((sum, debt) => sum + debt.amount, 0n);
    const totalCredits = credits.reduce((sum, credit) => sum + credit.amount, 0n);
    const netBalance = totalCredits - totalDebts;

    return {
      debts,
      credits,
      netBalance,
    };
  } catch (error) {
    console.error('Error fetching user balance:', error);
    return {
      debts: [],
      credits: [],
      netBalance: 0n,
    };
  }
}

/**
 * Gets group members from the smart contract
 * @param groupId XMTP conversation ID
 * @returns Array of member addresses
 */
export async function getGroupMembers(groupId: string): Promise<string[]> {
  try {
    const contract = getContract();
    const members = (await contract.getGroupMembers(groupId)) as string[];
    return members;
  } catch (error) {
    console.error('Error fetching group members:', error);
    return [];
  }
}

/**
 * Validates blockchain configuration
 * @returns true if configuration is valid
 */
export function validateBlockchainConfig(): boolean {
  const contractAddress = process.env.EXPENSE_CONTRACT_ADDRESS;
  const rpcUrl = process.env.RPC_URL ?? process.env.BASE_SEPOLIA_RPC;

  if (contractAddress === undefined || contractAddress.trim().length === 0) {
    console.error('❌ EXPENSE_CONTRACT_ADDRESS is not configured');
    return false;
  }

  if (rpcUrl === undefined || rpcUrl.trim().length === 0) {
    console.error('❌ RPC_URL (or BASE_SEPOLIA_RPC) is not configured');
    return false;
  }

  console.log('✅ Blockchain configuration is valid');
  console.log(`   Contract: ${contractAddress}`);
  console.log(`   RPC: ${rpcUrl}`);

  return true;
}

/**
 * Gets transaction receipt URL
 * @param txHash Transaction hash
 * @returns Block explorer URL (BaseScan for testnet, localhost info for local)
 */
export function getBaseScanUrl(txHash: string): string {
  const rpcUrl = process.env.RPC_URL ?? process.env.BASE_SEPOLIA_RPC ?? 'https://sepolia.base.org';

  // Check if using local node
  if (rpcUrl.includes('localhost') || rpcUrl.includes('127.0.0.1')) {
    return `Local transaction: ${txHash}`;
  }

  return `https://sepolia.basescan.org/tx/${txHash}`;
}
