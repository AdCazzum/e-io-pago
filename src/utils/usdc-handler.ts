/**
 * USDC Handler for Base Sepolia transactions
 * Based on XMTP transaction examples
 */

import { createPublicClient, formatUnits, http, toHex } from 'viem';
import { baseSepolia } from 'viem/chains';

import type { WalletSendCallsParams } from '@xmtp/content-type-wallet-send-calls';

// USDC on Base Sepolia
const USDC_TOKEN_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
const CHAIN_ID = toHex(84532); // Base Sepolia
const DECIMALS = 6;
const NETWORK_NAME = 'Base Sepolia';
const NETWORK_ID = 'base-sepolia';

// ERC20 minimal ABI for balance checking
const ERC20_ABI = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

/**
 * Creates a viem public client for Base Sepolia
 */
function getPublicClient(): ReturnType<typeof createPublicClient> {
  return createPublicClient({
    chain: baseSepolia,
    transport: http(),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;
}

/**
 * Gets USDC balance for an address
 */
export async function getUSDCBalance(address: string): Promise<string> {
  const client = getPublicClient();

  const balance = await client.readContract({
    address: USDC_TOKEN_ADDRESS as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address as `0x${string}`],
  });

  return formatUnits(balance, DECIMALS);
}

/**
 * Creates wallet send calls for USDC transfer
 * @param fromAddress Sender address
 * @param recipientAddress Recipient address
 * @param amountInDecimals Amount in USDC smallest units (6 decimals)
 */
export function createUSDCTransferCalls(
  fromAddress: string,
  recipientAddress: string,
  amountInDecimals: bigint,
): WalletSendCallsParams {
  const methodSignature = '0xa9059cbb'; // ERC20 transfer(address,uint256)

  // Format transaction data
  const transactionData = `${methodSignature}${recipientAddress
    .slice(2)
    .padStart(64, '0')}${amountInDecimals.toString(16).padStart(64, '0')}`;

  const amountInUSDC = Number(amountInDecimals) / Math.pow(10, DECIMALS);

  return {
    version: '1.0',
    from: fromAddress as `0x${string}`,
    chainId: CHAIN_ID,
    calls: [
      {
        to: USDC_TOKEN_ADDRESS as `0x${string}`,
        data: transactionData as `0x${string}`,
        metadata: {
          description: `Transfer ${amountInUSDC.toFixed(2)} USDC to ${recipientAddress.substring(0, 6)}...${recipientAddress.substring(recipientAddress.length - 4)} on ${NETWORK_NAME}`,
          transactionType: 'transfer',
          currency: 'USDC',
          amount: amountInDecimals.toString(),
          decimals: DECIMALS.toString(),
          networkId: NETWORK_ID,
        },
      },
    ],
  };
}

/**
 * Converts a decimal amount (e.g., 50.00 EUR) to USDC smallest units
 */
export function amountToUSDC(amount: number): bigint {
  return BigInt(Math.floor(amount * Math.pow(10, DECIMALS)));
}

/**
 * Formats USDC amount from smallest units to human-readable
 */
export function formatUSDC(amountInDecimals: bigint): string {
  return formatUnits(amountInDecimals, DECIMALS);
}
