import { http, createConfig } from 'wagmi'
import { baseSepolia } from 'wagmi/chains'
import { coinbaseWallet } from 'wagmi/connectors'

export const config = createConfig({
  chains: [baseSepolia],
  connectors: [
    coinbaseWallet({
      appName: process.env.NEXT_PUBLIC_APP_NAME || 'e io pago',
      preference: 'smartWalletOnly', // Use only Smart Wallet (gasless support)
    }),
  ],
  ssr: true,
  transports: {
    [baseSepolia.id]: http(
      process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC || 'https://sepolia.base.org'
    ),
  },
})

declare module 'wagmi' {
  interface Register {
    config: typeof config
  }
}
