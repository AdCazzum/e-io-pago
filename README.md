# E io pago!

An intelligent XMTP agent on Base Network that analyzes receipt images using GPT-4o Vision and automatically calculates bill splits for groups.

## 🌟 Features

- **📸 Receipt Analysis**: Upload a receipt photo and get instant analysis
- **🤖 GPT-4o Vision**: Advanced AI extracts items, prices, taxes, and totals
- **💰 Automatic Split**: Calculates equal split among all group members
- **💬 Natural Responses**: Friendly, conversational messages
- **👥 Group Support**: Works seamlessly in XMTP group conversations
- **🔒 Secure & Private**: End-to-end encrypted messaging via XMTP
- **⚡ Fast Processing**: Quick analysis and response times
- **🌐 Base Network**: Smart contract on Base Sepolia for on-chain management
- **📦 IPFS Integration**: Decentralized receipt storage (managed automatically by XMTP)

## 📋 Prerequisites

Before you begin, ensure you have:

- **Node.js v20 or higher** - [Download here](https://nodejs.org/)
- **npm** (included with Node.js)
- **OpenAI Account** with API access - [Sign up here](https://platform.openai.com/)
- **Git** (optional, for cloning)

## 🚀 Quick Start - Local Setup

### 1. Clone or Download the Project

```bash
git clone <your-repo-url>
cd e-io-pago
```

Or download and extract the ZIP file.

### 2. Install Dependencies

```bash
npm install
```

This will install all required packages:
- `@xmtp/agent-sdk` - XMTP messaging
- `@xmtp/content-type-remote-attachment` - Image handling
- `openai` - GPT-4o Vision API
- `ethers` - Ethereum wallet utilities
- `dotenv` - Environment configuration

### 3. Generate XMTP Keys

```bash
npm run gen:keys
```

This command will:
- Generate a new Ethereum wallet for your agent
- Create a database encryption key
- Create a `.env` file with the generated keys
- Display your agent's wallet address

**Example output:**
```
✅ Keys generated successfully!

🔐 Agent Wallet Details:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Address: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
Private Key: 0x...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️  IMPORTANT: Keep your private key secure!
```

**Save the wallet address** - you'll need it to add the agent to group chats!

### 4. Configure OpenAI API Key

Open the `.env` file and add your OpenAI API key:

```env
OPENAI_API_KEY=sk-proj-...your-key-here...
```

**How to get an OpenAI API key:**
1. Go to [platform.openai.com](https://platform.openai.com/)
2. Sign up or log in
3. Navigate to [API Keys](https://platform.openai.com/api-keys)
4. Click "Create new secret key"
5. Copy the key and paste it in your `.env` file

**Note:** GPT-4o Vision API requires a paid OpenAI account with credits.

### 5. Start the Agent

#### Development Mode (with hot-reload)

```bash
npm run dev
```

This starts the agent with automatic reloading using `tsx`.

#### Production Mode

```bash
npm run build
npm start
```

This compiles TypeScript to JavaScript and runs the compiled code.

### 6. Verify Agent is Running

You should see output like:

```
🚀 Starting XMTP Receipt Split Agent...

🔄 Starting agent...

✅ Agent is ready and listening for messages!

📬 Agent Address: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
🔗 Test URL: https://xmtp.chat/dm/0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
🌐 Environment: dev

💡 Add this agent to a group chat and send a receipt image!
```

**✅ Setup complete!** Keep this terminal window open - the agent will continue running and logging activity.

## 📱 How to Use

### Testing with XMTP Chat (Development)

1. **Open [xmtp.chat](https://xmtp.chat)** in your browser
2. **Connect your wallet** (MetaMask, Coinbase Wallet, etc.)
3. **Create a new group** or use an existing one
4. **Add the agent to the group** using the address shown in the terminal
5. **Send a receipt photo** with the trigger `@eiopago`

### Example Interaction

**In the group, type:**
```
@eiopago help
```

**The agent responds:**
```
👋 Hi! I'm your expense splitting assistant.

📸 How it works:
1. Upload a receipt photo to the group
2. Tag me with @eiopago along with the image
3. I'll analyze the receipt and calculate the split

💡 Available commands:
• help - Show this message
• [receipt photo] - Analyze and split the expense

Ready to help! 🚀
```

**Send a receipt:**
1. In the group, type `@eiopago`
2. Attach a receipt photo
3. Send

**The agent analyzes and responds:**
```
📝 New expense added by 0x1234...5678

🏪 McDonald's
💰 Total: 24.50 EUR
👥 Per person: 12.25 EUR (2 people)

📸 Receipt: https://gateway.pinata.cloud/ipfs/QmXYZ123...

⚠️ On-chain system integration in progress
Soon you'll be able to view all debts in a mini-app!
```

### Available Commands

- **`@eiopago help`** - Show usage instructions
- **`@eiopago` + receipt photo** - Analyze and calculate split
- **Any message with `@eiopago`** - Conversational response with GPT-4o

**Note:** The bot works **only in groups**, not in direct messages (DMs).

## 🏗️ System Architecture

### Main Components

```
┌─────────────────┐
│  XMTP Client    │  ← User uploads receipt in group
│  (xmtp.chat)    │
└────────┬────────┘
         │ RemoteAttachment with IPFS URL
         ▼
┌─────────────────────────────────────────┐
│  XMTP Agent (index.ts)                  │
│  • Event handlers (text, attachment)    │
│  • Rate limiting                        │
│  • Group filtering                      │
└────────┬───────────────────────┬────────┘
         │                       │
         ▼                       ▼
┌──────────────────┐    ┌──────────────────┐
│  GPT-4o Vision   │    │  IPFS Integration│
│  Receipt Analyze │    │  Hash Extraction │
└──────────────────┘    └──────────────────┘
         │                       │
         ▼                       ▼
┌─────────────────────────────────────────┐
│  Smart Contract (Base Sepolia)          │
│  • ExpenseManager.sol                   │
│  • Multi-group support                  │
│  • Peer-to-peer debt tracking           │
│  • ERC2771 (gasless transactions)       │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│  Mini-App (Next.js)                     │
│  • Group dashboard                      │
│  • Expense history                      │
│  • Debt/credit visualization            │
│  • OnchainKit + Wagmi                   │
└─────────────────────────────────────────┘
```

### How IPFS Works

**No Pinata account needed!** 🎉

XMTP handles IPFS uploads automatically:

1. **User** sends image on XMTP
2. **XMTP Client** automatically uploads to IPFS
3. **XMTP** sends `RemoteAttachment` with IPFS URL
4. **Bot** downloads and decrypts for GPT-4o analysis
5. **Bot** extracts IPFS hash from URL (`QmXYZ...`)
6. **Bot** generates public link to gateway

**No additional upload needed!** The file is already on IPFS.

## ⚙️ Environment Configuration

### Required Variables

The `.env` file contains:

```env
# XMTP Configuration (generated by npm run gen:keys)
XMTP_WALLET_KEY=0x...
XMTP_DB_ENCRYPTION_KEY=abc123...
XMTP_ENV=dev
AGENT_TRIGGER=@eiopago

# OpenAI Configuration (add manually)
OPENAI_API_KEY=sk-proj-...

# IPFS Configuration (optional, only for displaying links)
PINATA_GATEWAY=https://gateway.pinata.cloud
```

### Optional Variables (Blockchain)

If you want to test smart contract integration:

```env
# Blockchain Configuration (Base Sepolia)
BASE_SEPOLIA_RPC=https://sepolia.base.org
EXPENSE_CONTRACT_ADDRESS=0x...  # After deployment
DEPLOYER_PRIVATE_KEY=0x...      # For contract deployment

# BaseScan (for contract verification)
BASESCAN_API_KEY=...
```

**Note:** Blockchain integration is currently **in development**. The bot already works for receipt analysis and expense splitting.

## 🗂️ Project Structure

```
e-io-pago/
├── src/
│   ├── index.ts                    # Main XMTP agent
│   ├── types.ts                    # TypeScript interfaces
│   └── utils/
│       ├── receipt-analyzer.ts     # GPT-4o Vision integration
│       ├── message-formatter.ts    # Response formatting
│       └── blockchain.ts           # Smart contract wrapper
├── contracts/
│   └── ExpenseManager.sol          # Solidity smart contract
├── scripts/
│   ├── generate-keys.ts            # XMTP key generation
│   └── deploy.ts                   # Smart contract deployment
├── miniapp/                        # Next.js mini-app
│   ├── app/                        # Pages (App Router)
│   ├── components/                 # React components
│   ├── lib/                        # Utilities & config
│   └── package.json
├── hardhat.config.cjs              # Hardhat configuration
├── .env.example                    # Environment template
├── .gitignore                      # Files to ignore in git
├── package.json
├── tsconfig.json
├── eslint.config.js
├── README.md                       # This file
└── TESTING.md                      # Complete testing guide

# Generated files (not in git):
├── .env                            # Environment variables (generated by gen:keys)
├── dist/                           # Compiled JavaScript code
├── node_modules/                   # npm dependencies
└── xmtp-dev-*.db3                  # XMTP database files
```

## 🧪 Testing

### Quick Bot Test

```bash
# 1. Make sure the bot is running
npm run dev

# 2. Open xmtp.chat
# 3. Create group and add the bot
# 4. Send: @eiopago help
# 5. Upload a receipt photo with @eiopago
```

### Smart Contract Test (Optional)

```bash
# 1. Add DEPLOYER_PRIVATE_KEY to .env (with ETH on Base Sepolia)
# 2. Compile the contract
npm run compile

# 3. Deploy to Base Sepolia
npm run deploy

# 4. Copy contract address to .env
# EXPENSE_CONTRACT_ADDRESS=0x...

# 5. Verify on BaseScan (optional)
npm run verify
```

### Mini-App Test (Optional)

```bash
cd miniapp

# 1. Install dependencies
npm install

# 2. Configure .env.local
cp .env.example .env.local
# Add: EXPENSE_CONTRACT_ADDRESS, CDP_API_KEY

# 3. Start dev server
npm run dev

# 4. Open http://localhost:3000
```

**Complete guide:** See [TESTING.md](TESTING.md) for detailed instructions.

## 🚢 Deployment

### Railway (Recommended for Bot)

1. Push code to GitHub
2. Go to [railway.app](https://railway.app)
3. Create new project → Deploy from GitHub
4. Select your repository
5. Add environment variables:
   - `XMTP_WALLET_KEY`
   - `XMTP_DB_ENCRYPTION_KEY`
   - `XMTP_ENV=production`
   - `OPENAI_API_KEY`
6. Configure persistent volume for `/data`
7. Deploy!

### Vercel (Recommended for Mini-App)

```bash
cd miniapp
npm install -g vercel
vercel
```

Configure environment variables in Vercel dashboard:
- `NEXT_PUBLIC_BASE_SEPOLIA_RPC`
- `NEXT_PUBLIC_EXPENSE_CONTRACT_ADDRESS`
- `NEXT_PUBLIC_CDP_API_KEY`

## 💰 Costs

### OpenAI API

- **GPT-4o Vision**: ~$0.01 per receipt analysis
- **GPT-4o Text**: ~$0.001 per conversational response
- **Estimated total cost**: ~$0.02 per receipt processed

See [OpenAI Pricing](https://openai.com/pricing) for current rates.

### XMTP & Base Network

- **XMTP**: Free, no messaging fees
- **Base Network**: Gas fees only for on-chain transactions (not for messages)
- **IPFS**: Free via XMTP (managed automatically)

## 🔒 Security

### Best Practices

1. **Never commit `.env`** - Contains private keys
2. **Keep wallet private key secure** - Has signing authority
3. **Rotate OpenAI API key** if compromised
4. **Use `production` mode** for real users
5. **Monitor API usage** - OpenAI charges per request
6. **Backup database** - Contains conversation history

### Rate Limiting

The agent includes built-in rate limiting:
- 5 second cooldown between requests per user
- Prevents spam and abuse

## 🛠️ Development

### Available Commands

```bash
# Development
npm run dev              # Start with hot-reload
npm run build            # Compile TypeScript
npm start               # Start compiled code

# Testing
npm run type-check      # Verify TypeScript types
npm run lint            # ESLint
npm run lint:fix        # Auto-fix linting

# Blockchain
npm run compile         # Compile smart contract
npm run deploy          # Deploy to Base Sepolia
npm run verify          # Verify on BaseScan

# Setup
npm run gen:keys        # Generate XMTP keys
```

### Debugging

All logs are visible in the terminal:
- ✅ Messages received
- 📎 Attachments processed
- 🤖 GPT-4o calls
- ⚠️ Errors and warnings

## 📚 Documentation

- **[TESTING.md](TESTING.md)** - Complete local testing guide
- **[XMTP Docs](https://docs.xmtp.org)** - Official XMTP documentation
- **[XMTP Agent SDK](https://github.com/xmtp/xmtp-agent-sdk)** - SDK and agent examples
- **[OpenAI Vision API](https://platform.openai.com/docs/guides/vision)** - GPT-4o Vision guide
- **[Base Network](https://docs.base.org)** - Base documentation and deployment
- **[Hardhat](https://hardhat.org/docs)** - Smart contract framework

## ❓ Troubleshooting

### Agent won't start

**Error: `OPENAI_API_KEY environment variable is required`**
- Make sure `.env` file exists
- Verify `OPENAI_API_KEY` is set with a valid key

**Error: XMTP connection failed**
- Check your internet connection
- Verify `XMTP_WALLET_KEY` is set correctly
- Try regenerating keys with `npm run gen:keys`

### Receipt not processing

**"I'm having trouble reading this receipt"**
- Ensure image is clear and well-lit
- Check image is JPEG or PNG format
- Verify it's actually a receipt (GPT-4o rejects other images)
- Make sure total and items are visible

**"Processing error"**
- Check OpenAI API key is valid
- Verify you have OpenAI credits
- Check internet connection
- View terminal logs for details

### Agent not responding in group

- Verify agent address is correct
- Make sure agent is added as group member
- Check agent is running (terminal shows activity)
- Use trigger word `@eiopago` at the beginning of message
- Try `@eiopago help` command first

### Database errors

**"Database locked"**
- Run only one agent instance at a time
- Check database folder permissions
- Restart the agent

## 🗺️ Roadmap

### ✅ Completed

- [x] Receipt analysis with GPT-4o Vision
- [x] Automatic equal split
- [x] XMTP group support
- [x] IPFS integration (managed by XMTP)
- [x] ExpenseManager smart contract
- [x] Next.js mini-app
- [x] ERC2771 support (gasless transactions)

### 🚧 In Development

- [ ] On-chain integration in bot (requires user signature)
- [ ] Gasless transactions with Base Paymaster
- [ ] "Mark as Paid" system in mini-app

### 🔮 Future Features

- [ ] Custom split ratios (not just equal)
- [ ] Multi-currency support
- [ ] Expense history per group
- [ ] Debt notifications
- [ ] Payment app integration
- [ ] CSV/PDF export

## 🤝 Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

MIT License - See LICENSE file for details

## 🙏 Acknowledgments

- **XMTP** - Decentralized messaging protocol
- **OpenAI** - GPT-4o Vision API
- **Base** - Ethereum L2 network
- **Coinbase** - Base Network support
- **Pinata** - Public IPFS gateway

## 📞 Support

- **Issues**: Open a GitHub issue
- **XMTP Discord**: [Join the community](https://discord.gg/xmtp) for support
- **Documentation**: See [TESTING.md](TESTING.md) for complete guide

---

**Built with ❤️ using XMTP, GPT-4o, Base Network and IPFS**
