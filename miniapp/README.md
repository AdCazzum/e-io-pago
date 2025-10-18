# e io pago - Mini-App

Next.js web application for viewing group expenses and managing debts on Base Sepolia.

## Features

- **Wallet Connection**: Auto-connect with Coinbase Smart Wallet
- **Group Dashboard**: View net balance, debts owed, and credits
- **Expense History**: Browse all group expenses with receipt images
- **Mark as Paid**: Gasless transactions via Base Paymaster (coming soon)
- **IPFS Integration**: View receipt images stored on IPFS

## Tech Stack

- **Next.js 15** with App Router and React Server Components
- **OnchainKit** (@coinbase/onchainkit) for Base integration
- **Wagmi v2** for Ethereum wallet connection
- **Viem 2.x** for contract interactions
- **Ethers.js v6** for BigInt utilities
- **TanStack React Query** for state management
- **Tailwind CSS 4** for styling

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Update the following variables:

```env
# Base Sepolia RPC (public testnet RPC)
NEXT_PUBLIC_BASE_SEPOLIA_RPC=https://sepolia.base.org

# ExpenseManager contract address (deploy first from parent directory)
NEXT_PUBLIC_EXPENSE_CONTRACT_ADDRESS=0x...

# Coinbase Developer Platform API key
NEXT_PUBLIC_CDP_API_KEY=your_cdp_api_key_here

# IPFS gateway for viewing receipt images
NEXT_PUBLIC_PINATA_GATEWAY=https://gateway.pinata.cloud
```

**Get CDP API Key:**
1. Go to [Coinbase Developer Portal](https://portal.cdp.coinbase.com/)
2. Create a new project
3. Generate an API key
4. Copy the key to `NEXT_PUBLIC_CDP_API_KEY`

### 3. Deploy Smart Contract

Before running the mini-app, deploy the ExpenseManager contract from the parent directory:

```bash
cd ..
npm run deploy
```

Copy the deployed contract address and update `NEXT_PUBLIC_EXPENSE_CONTRACT_ADDRESS` in `.env.local`.

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
miniapp/
├── app/
│   ├── layout.tsx                    # Root layout with Providers
│   ├── page.tsx                      # Home page with wallet connect
│   ├── globals.css                   # Tailwind CSS global styles
│   └── group/
│       └── [groupId]/
│           ├── page.tsx              # Group dashboard (debts/credits)
│           └── expenses/
│               └── page.tsx          # Expense history list
├── components/
│   └── Providers.tsx                 # Wagmi + OnchainKit + React Query providers
├── lib/
│   ├── wagmi.ts                      # Wagmi configuration
│   └── contract.ts                   # Smart contract utilities
├── public/                           # Static assets
└── package.json
```

## Usage

### Connect Wallet

1. Click "Connect Wallet" on the home page
2. Choose Coinbase Smart Wallet
3. Authenticate with your Base wallet

### View Group Dashboard

1. Navigate to `/group/{groupId}` (e.g., `/group/demo-group-id`)
2. View your net balance (credits - debts)
3. See list of debts (what you owe)
4. See list of credits (what others owe you)

### View Expense History

1. From the group dashboard, click "View All Expenses"
2. Browse all expenses with details:
   - Merchant name
   - Total amount and per-person split
   - Who paid
   - Itemized list (if available)
   - Receipt image link (IPFS)

### Mark Debt as Paid (Coming Soon)

Click "Mark as Paid" next to any debt to settle it on-chain via gasless transaction.

## Smart Contract Integration

The mini-app interacts with the ExpenseManager smart contract on Base Sepolia:

**Contract Functions Used:**
- `getGroupExpenses(groupId)` - Fetch all expense IDs for a group
- `getExpense(expenseId)` - Get expense details
- `getUserDebts(groupId, userAddress)` - Get what user owes
- `getUserCredits(groupId, userAddress)` - Get what others owe user
- `markAsPaid(expenseId, creditor)` - Settle a debt (gasless)

**Contract ABI:**
Located in `lib/contracts/ExpenseManager.json` (auto-generated during deployment).

## Base Paymaster Integration

Gasless transactions are enabled via Base Paymaster for:
- **Mark as Paid** transactions (ERC2771 meta-transactions)

**Setup:**
1. Deploy contract with Base Sepolia Trusted Forwarder
2. Configure Paymaster allowlist in Coinbase Developer Portal
3. Transactions automatically routed through paymaster

## IPFS Integration

Receipt images are stored on IPFS via Pinata and referenced by CID in the smart contract.

**View Receipt Image:**
- Click "View Receipt Image" on any expense
- Opens IPFS gateway URL: `https://gateway.pinata.cloud/ipfs/{CID}`

## Build & Deploy

### Build for Production

```bash
npm run build
```

Generates optimized production build in `.next/` directory.

### Deploy to Vercel

1. Push code to GitHub
2. Import project in Vercel
3. Configure environment variables in Vercel dashboard
4. Deploy

### Deploy to Other Platforms

The mini-app is a standard Next.js 15 application and can be deployed to:
- Vercel
- Netlify
- Cloudflare Pages
- AWS Amplify
- Self-hosted with Node.js

## Development Notes

### TypeScript Configuration

- **Target**: ES2020 (required for BigInt literals)
- **Strict mode**: Enabled
- **Path aliases**: `@/*` maps to project root

### Wallet Configuration

The app is configured for **Coinbase Smart Wallet only** (no other wallet options):

```typescript
connectors: [
  coinbaseWallet({
    appName: 'E-io-Pago',
    preference: 'smartWalletOnly',
  }),
]
```

To support other wallets (MetaMask, WalletConnect), add additional connectors to `lib/wagmi.ts`.

### Network Configuration

Currently configured for **Base Sepolia testnet only**.

To add Base Mainnet:
1. Import `base` from `wagmi/chains`
2. Add to `chains` array in `lib/wagmi.ts`
3. Add transport for mainnet
4. Update contract address for mainnet deployment

## Troubleshooting

### "Contract not found" Error

**Cause:** Contract address not configured or contract not deployed.

**Fix:**
1. Deploy ExpenseManager contract: `cd .. && npm run deploy`
2. Update `NEXT_PUBLIC_EXPENSE_CONTRACT_ADDRESS` in `.env.local`
3. Restart dev server

### "No data found" in Group Dashboard

**Causes:**
1. Group doesn't exist on-chain
2. No expenses added yet
3. Wrong network connected

**Fix:**
1. Ensure XMTP bot has created the group on-chain
2. Upload a receipt in XMTP group chat to create expenses
3. Verify wallet is connected to Base Sepolia

### BigInt Serialization Error

**Cause:** Trying to serialize BigInt in JSON.

**Fix:** Use `formatEther()` helper to convert BigInt to string before display.

### Build Errors

**ESLint configuration warning:**

This is a known Next.js 15 + Turbopack compatibility issue and can be safely ignored. The build will still succeed.

## License

MIT
