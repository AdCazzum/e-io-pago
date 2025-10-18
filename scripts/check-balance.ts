import { ethers } from 'ethers';

const provider = new ethers.JsonRpcProvider('https://sepolia.base.org');

async function checkBalance(): Promise<void> {
  const address = '0x1Ecf8f677a61a2D7B984919f76218b5D5Fb478d2';
  const balance = await provider.getBalance(address);
  console.log('Address:', address);
  console.log('Balance:', ethers.formatEther(balance), 'ETH');
}

checkBalance().catch(console.error);
