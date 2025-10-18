# Complete Local Testing Guide

This guide explains exactly how to test the entire e io pago system locally.

## Minimum Setup Required

### 1️⃣ Install XMTP Bot

```bash
cd /Users/lorenzofiore/Progetti/Personale/e-io-pago
npm install
```

### 2️⃣ Configure Environment Variables

**Generate XMTP keys:**
```bash
npm run gen:keys
```

This automatically creates a `.env` file with:
- `XMTP_WALLET_KEY` - Bot's Ethereum wallet private key
- `XMTP_DB_ENCRYPTION_KEY` - Database encryption key
- `XMTP_ENV=dev` - Development environment

**Add OpenAI API Key:**

Open the `.env` file and add:
```bash
OPENAI_API_KEY=sk-proj-...  # Get from https://platform.openai.com/api-keys
```

**✅ This is ALL you need to test the bot!**

Other variables (`BASE_SEPOLIA_RPC`, `EXPENSE_CONTRACT_ADDRESS`, etc.) are only needed if you want to test blockchain integration (currently not implemented).

## Testing the XMTP Bot

### 1. Start the Bot

```bash
npm run dev
```

Expected output:
```
✅ Agent is ready and listening for messages!
📬 Agent Address: 0x1234567890abcdef...
```

**⚠️ IMPORTANT:** Copy and save this address - you'll need it to add the bot to groups!

### 2. Open XMTP Chat

Go to [xmtp.chat](https://xmtp.chat) and connect your wallet (MetaMask, Coinbase Wallet, etc.)

### 3. Create a Group

- Click "New Group"
- Group name: "Test Expenses" (or whatever you want)
- Add members:
  - **Bot address**: `0x1234567890abcdef...` (from terminal)
  - Optional: add other wallets to test with multiple people

### 4. Test the Help Command

In the group, type:
```
@eiopago help
```

You should receive the help message from the bot.

### 5. Test Receipt Analysis

**Find a receipt image:**
- Download a sample receipt from Google Images
- Or use a photo from your phone
- Or use a receipt screenshot

**Send to the bot:**
1. In the group, type: `@eiopago`
2. Click the attachment icon
3. Select the receipt image
4. Send

### 6. Observe Bot Logs

In the terminal where `npm run dev` is running, you'll see:

```
📬 Group message from 0xABC...
✅ Triggered in group
📎 Processing attachment: image/jpeg
📥 Downloading and decrypting attachment...
📄 Attachment: receipt.jpg (image/jpeg)
🔍 Analyzing image to detect if it's a receipt...
✅ Receipt analyzed: McDonald's, total: EUR 24.50
💰 Split calculated: EUR 12.25 per person (2 people)
📍 Extracting IPFS hash from attachment URL...
   Attachment URL: https://gateway.pinata.cloud/ipfs/QmXYZ123...
✅ Extracted IPFS hash: QmXYZ123...
⚠️  On-chain integration not yet implemented
   Receipt data and IPFS hash available for future on-chain storage
```

### 7. Receive the Response

The bot will respond in the group with something like:

```
📝 New expense added by 0x1234...5678

🏪 McDonald's
💰 Total: 24.50 EUR
👥 Per person: 12.25 EUR (2 people)

📸 Receipt: https://gateway.pinata.cloud/ipfs/QmXYZ123...

⚠️ On-chain system integration in progress
Soon you'll be able to view all debts in a mini-app!
```

## How IPFS Works

**NO Pinata or IPFS account needed!** 🎉

When you send an image on XMTP:
1. The XMTP client (xmtp.chat) automatically uploads the file to IPFS
2. It sends a `RemoteAttachment` with the IPFS URL ready
3. The bot downloads the file for GPT-4o analysis
4. The bot **extracts the IPFS hash from the URL** of the RemoteAttachment
5. The bot uses that hash to generate the public link

**No additional upload needed!** The file is already on public IPFS thanks to XMTP.

## Testing with Multiple Users

### Scenario: Dinner Among Friends

**Setup:**
1. Wallet A (you) - creates the group "Dinner Friends"
2. Wallet B (friend) - joins the group
3. Add the bot: `0x...` (address from terminal)

**Test:**
1. **Wallet A** uploads receipt for €40
   - In the group: `@eiopago` + receipt photo
   - Bot calculates: €20 per person (2 people, bot excluded)

2. **Verify response:**
   - Bot shows: "€20.00 per person"
   - IPFS receipt link works
   - Both users see the same message

3. **Wallet B** uploads another receipt for €30
   - Same process
   - Bot calculates: €15 per person

## Troubleshooting

### "Agent not responding"

**Check:**
```bash
# Is the bot running?
# Check the terminal where you ran npm run dev

# Did you use the trigger word?
# Must start with @eiopago (or the trigger you set)

# Are you in a group?
# The bot only works in groups, not in DMs
```

### "❌ Failed to analyze receipt"

**Possible causes:**
1. **Invalid OpenAI API Key** - Check in `.env` file
2. **Image is not a receipt** - GPT-4o rejects images that aren't receipts
3. **Unsupported image format** - Use JPG or PNG
4. **Image too large** - XMTP has size limits (try reducing)

**Verify OpenAI key:**
```bash
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

If it returns an error, the key is invalid.

### "Could not extract IPFS hash"

**Not a serious error!** The bot uses the full URL as fallback.

This happens if:
- XMTP uses a different URL format
- The file wasn't uploaded to standard IPFS

The receipt link will work anyway.

### "Rate limited"

Wait 5 seconds between messages. The bot has a 5-second rate limit per user.

## Advanced Testing: Smart Contract (Optional)

⚠️ **Currently blockchain integration is disabled** because it requires user signature.

If you still want to test the smart contract:

### 1. Deploy the Contract

**Prerequisites:**
- Base Sepolia testnet ETH (free from [Coinbase Faucet](https://www.coinbase.com/faucets))
- Deployer private key

**Add to `.env`:**
```bash
BASE_SEPOLIA_RPC=https://sepolia.base.org
DEPLOYER_PRIVATE_KEY=0x...  # Key with ETH on Base Sepolia
```

**Deploy:**
```bash
npm run compile
npm run deploy
```

Output:
```
ExpenseManager deployed to: 0xABC123...
```

**Add to `.env`:**
```bash
EXPENSE_CONTRACT_ADDRESS=0xABC123...
```

### 2. Test Contract Manually

```bash
# Install Hardhat console
npx hardhat console --network baseSepolia
```

```javascript
const ExpenseManager = await ethers.getContractFactory("ExpenseManager");
const contract = await ExpenseManager.attach("0xABC123...");

// Create a group
await contract.createGroup("test-group", ["0xUser1...", "0xUser2..."]);

// Verify
const group = await contract.getGroup("test-group");
console.log(group);
```

### 3. Verify on BaseScan

Go to [sepolia.basescan.org](https://sepolia.basescan.org) and search for the contract address.

## Testing the Mini-App (Optional)

The mini-app is for viewing debts saved on-chain. Since blockchain integration isn't active in the bot yet, the mini-app will show empty data.

**Quick setup:**
```bash
cd miniapp
npm install
cp .env.example .env.local
```

**Configure `.env.local`:**
```bash
NEXT_PUBLIC_BASE_SEPOLIA_RPC=https://sepolia.base.org
NEXT_PUBLIC_EXPENSE_CONTRACT_ADDRESS=0xABC123...  # From deployment
NEXT_PUBLIC_CDP_API_KEY=...  # From portal.cdp.coinbase.com
```

**Start:**
```bash
npm run dev
```

Open http://localhost:3000

## Next Steps

To complete the system, we need to implement:

1. **Transaction signing mechanism** - Allow user to sign expense addition on-chain
2. **XMTP Transactions integration** - Use `ContentTypeWalletSendCalls` to send transaction requests
3. **Base Paymaster** - Enable gasless transactions for "Mark as Paid"

Want help implementing any of these features? 🚀
