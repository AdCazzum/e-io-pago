const { ethers } = require("hardhat");

/**
 * Deployment script for ExpenseManager contract
 *
 * This script deploys the ExpenseManager contract to Base Sepolia testnet
 * with ERC2771 support for gasless transactions via Base Paymaster
 */
async function main() {
  console.log("🚀 Starting ExpenseManager deployment...\n");

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("📬 Deploying with account:", deployer.address);

  // Check balance
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", ethers.formatEther(balance), "ETH\n");

  if (balance === 0n) {
    console.error("❌ Error: Deployer account has no ETH!");
    console.error("   Get testnet ETH from: https://www.coinbase.com/faucets/base-ethereum-goerli-faucet");
    process.exit(1);
  }

  // Base Sepolia Trusted Forwarder address (for ERC2771 gasless transactions)
  // This is the official Base Paymaster forwarder
  // Source: https://docs.base.org/tools/paymaster
  const TRUSTED_FORWARDER = "0x7109709ECfa91a80626fF3989D68f67F5b1DD12D"; // Base Sepolia

  console.log("🔧 Trusted Forwarder (ERC2771):", TRUSTED_FORWARDER);
  console.log("   This enables gasless transactions via Base Paymaster\n");

  // Deploy the contract
  console.log("📝 Deploying ExpenseManager contract...");
  const ExpenseManager = await ethers.getContractFactory("ExpenseManager");
  const expenseManager = await ExpenseManager.deploy(TRUSTED_FORWARDER);

  await expenseManager.waitForDeployment();

  const contractAddress = await expenseManager.getAddress();

  console.log("\n✅ ExpenseManager deployed successfully!");
  console.log("📍 Contract address:", contractAddress);
  console.log("🔗 BaseScan URL:", `https://sepolia.basescan.org/address/${contractAddress}`);

  // Display deployment info
  console.log("\n📋 Deployment Summary:");
  console.log("─".repeat(60));
  console.log("Contract:", "ExpenseManager");
  console.log("Network:", "Base Sepolia (Chain ID: 84532)");
  console.log("Deployer:", deployer.address);
  console.log("Contract Address:", contractAddress);
  console.log("Trusted Forwarder:", TRUSTED_FORWARDER);
  console.log("Gasless Support:", "✅ Enabled (ERC2771)");
  console.log("─".repeat(60));

  // Save deployment info to .env
  console.log("\n💾 Add this to your .env file:");
  console.log("─".repeat(60));
  console.log(`EXPENSE_CONTRACT_ADDRESS=${contractAddress}`);
  console.log(`TRUSTED_FORWARDER=${TRUSTED_FORWARDER}`);
  console.log("─".repeat(60));

  // Verification instructions
  console.log("\n🔍 To verify the contract on BaseScan, run:");
  console.log("─".repeat(60));
  console.log(`npx hardhat verify --network baseSepolia ${contractAddress} "${TRUSTED_FORWARDER}"`);
  console.log("─".repeat(60));

  console.log("\n✅ Deployment complete!\n");
}

// Execute deployment
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Deployment failed:");
    console.error(error);
    process.exit(1);
  });
