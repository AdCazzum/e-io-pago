import { ethers } from "hardhat";

/**
 * Deployment script for ExpenseManager contract on local Hardhat node
 *
 * This script deploys the ExpenseManager contract to a local Hardhat network
 * for testing purposes without requiring testnet ETH or gas fees
 */
async function main() {
  console.log("🚀 Starting ExpenseManager local deployment...\n");

  // Get the deployer account (first Hardhat account)
  const [deployer] = await ethers.getSigners();
  console.log("📬 Deploying with account:", deployer.address);

  // Check balance
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", ethers.formatEther(balance), "ETH\n");

  // For local testing, we can use a dummy trusted forwarder address
  // or deploy a minimal forwarder contract if needed
  // Using address(0) for simplicity in local testing
  const TRUSTED_FORWARDER = "0x0000000000000000000000000000000000000000";

  console.log("🔧 Trusted Forwarder (ERC2771):", TRUSTED_FORWARDER);
  console.log("   (Using zero address for local testing)\n");

  // Deploy the contract
  console.log("📝 Deploying ExpenseManager contract...");
  const ExpenseManager = await ethers.getContractFactory("ExpenseManager");
  const expenseManager = await ExpenseManager.deploy(TRUSTED_FORWARDER);

  await expenseManager.waitForDeployment();

  const contractAddress = await expenseManager.getAddress();

  console.log("\n✅ ExpenseManager deployed successfully!");
  console.log("📍 Contract address:", contractAddress);

  // Display deployment info
  console.log("\n📋 Deployment Summary:");
  console.log("─".repeat(60));
  console.log("Contract:", "ExpenseManager");
  console.log("Network:", "Localhost (Chain ID: 1337)");
  console.log("RPC URL:", "http://127.0.0.1:8545");
  console.log("Deployer:", deployer.address);
  console.log("Contract Address:", contractAddress);
  console.log("Trusted Forwarder:", TRUSTED_FORWARDER);
  console.log("─".repeat(60));

  // Save deployment info
  console.log("\n💾 Use these values for local testing:");
  console.log("─".repeat(60));
  console.log(`EXPENSE_CONTRACT_ADDRESS=${contractAddress}`);
  console.log(`RPC_URL=http://127.0.0.1:8545`);
  console.log(`CHAIN_ID=1337`);
  console.log("─".repeat(60));

  console.log("\n✅ Local deployment complete!\n");
  console.log("🔄 To interact with this contract:");
  console.log("   1. Update your .env with the contract address above");
  console.log("   2. Start your bot with: npm run dev");
  console.log("   3. Keep this Hardhat node running in a separate terminal\n");
}

// Execute deployment
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Deployment failed:");
    console.error(error);
    process.exit(1);
  });
