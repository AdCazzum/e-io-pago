import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

const BOT_PRIVATE_KEY = process.env.XMTP_WALLET_KEY;
const RPC_URL = process.env.BASE_SEPOLIA_RPC ?? 'https://sepolia.base.org';
const TO_ADDRESS = '0x1Ecf8f677a61a2D7B984919f76218b5D5Fb478d2';
const AMOUNT_ETH = '0.2'; // Amount in ETH

async function transferETH(): Promise<void> {
  if (BOT_PRIVATE_KEY === undefined) {
    console.error('❌ XMTP_WALLET_KEY not found in .env');
    process.exit(1);
  }

  console.log('💸 Starting ETH transfer...');
  console.log(`   From: Bot wallet`);
  console.log(`   To: ${TO_ADDRESS}`);
  console.log(`   Amount: ${AMOUNT_ETH} ETH`);
  console.log(`   Network: Base Sepolia`);
  console.log('');

  // Create provider and wallet
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(BOT_PRIVATE_KEY, provider);

  console.log(`📬 Bot address: ${wallet.address}`);

  // Check balance
  const balance = await provider.getBalance(wallet.address);
  const balanceEth = ethers.formatEther(balance);
  console.log(`💰 Current balance: ${balanceEth} ETH`);
  console.log('');

  // Validate amount
  const amountWei = ethers.parseEther(AMOUNT_ETH);
  if (balance < amountWei) {
    console.error(`❌ Insufficient balance. You have ${balanceEth} ETH but trying to send ${AMOUNT_ETH} ETH`);
    process.exit(1);
  }

  // Estimate gas
  const gasPrice = await provider.getFeeData();
  const gasLimit = 21000n; // Standard ETH transfer
  const gasCost = gasLimit * (gasPrice.gasPrice ?? 0n);
  const gasCostEth = ethers.formatEther(gasCost);
  const totalCost = amountWei + gasCost;
  const totalCostEth = ethers.formatEther(totalCost);

  console.log(`⛽ Estimated gas cost: ${gasCostEth} ETH`);
  console.log(`💵 Total cost: ${totalCostEth} ETH (${AMOUNT_ETH} + gas)`);
  console.log('');

  if (balance < totalCost) {
    console.error(`❌ Insufficient balance for amount + gas. You have ${balanceEth} ETH but need ${totalCostEth} ETH`);
    process.exit(1);
  }

  // Send transaction
  console.log('📤 Sending transaction...');
  const tx = await wallet.sendTransaction({
    to: TO_ADDRESS,
    value: amountWei,
  });

  console.log(`✅ Transaction sent!`);
  console.log(`   Hash: ${tx.hash}`);
  console.log(`   Explorer: https://sepolia.basescan.org/tx/${tx.hash}`);
  console.log('');

  // Wait for confirmation
  console.log('⏳ Waiting for confirmation...');
  const receipt = await tx.wait();

  if (receipt === null) {
    console.error('❌ Transaction failed - receipt is null');
    process.exit(1);
  }

  console.log('✅ Transaction confirmed!');
  console.log(`   Block: ${receipt.blockNumber}`);
  console.log(`   Gas used: ${receipt.gasUsed.toString()}`);
  console.log('');

  // Check new balances
  const newBotBalance = await provider.getBalance(wallet.address);
  const newRecipientBalance = await provider.getBalance(TO_ADDRESS);

  console.log('📊 Final balances:');
  console.log(`   Bot: ${ethers.formatEther(newBotBalance)} ETH`);
  console.log(`   Recipient: ${ethers.formatEther(newRecipientBalance)} ETH`);
  console.log('');
  console.log('🎉 Transfer complete!');
}

transferETH().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
