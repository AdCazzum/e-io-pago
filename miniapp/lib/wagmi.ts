import { defineChain } from 'viem';
import { http, createConfig } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
import { coinbaseWallet } from 'wagmi/connectors';

// Local Hardhat network configuration
const localRpcUrl = process.env.NEXT_PUBLIC_LOCAL_RPC_URL ?? 'http://127.0.0.1:8545';

const hardhatLocal = defineChain({
  id: 1337,
  name: 'Hardhat Local',
  nativeCurrency: {
    decimals: 18,
    name: 'Ether',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: { http: [localRpcUrl] },
  },
  testnet: true,
});

// Determine which chain to use based on environment variable
const useLocalNetwork = process.env.NEXT_PUBLIC_USE_LOCAL_NETWORK === 'true';

// Create configuration based on environment
const createAppConfig = (): ReturnType<typeof createConfig> => {
  if (useLocalNetwork) {
    return createConfig({
      chains: [hardhatLocal],
      connectors: [
        coinbaseWallet({
          appName: process.env.NEXT_PUBLIC_APP_NAME ?? 'e io pago',
          preference: 'smartWalletOnly',
        }),
      ],
      ssr: true,
      transports: {
        [hardhatLocal.id]: http(localRpcUrl),
      },
    });
  }

  return createConfig({
    chains: [baseSepolia],
    connectors: [
      coinbaseWallet({
        appName: process.env.NEXT_PUBLIC_APP_NAME ?? 'e io pago',
        preference: 'smartWalletOnly',
      }),
    ],
    ssr: true,
    transports: {
      [baseSepolia.id]: http(
        process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC ?? 'https://sepolia.base.org',
      ),
    },
  });
};

export const config = createAppConfig();

declare module 'wagmi' {
  interface Register {
    config: typeof config
  }
}
