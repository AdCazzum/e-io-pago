'use client'

import { ConnectWallet } from '@coinbase/onchainkit/wallet'
import { useAccount } from 'wagmi'
import Link from 'next/link'

export default function Home() {
  const { address, isConnected } = useAccount()

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <header className="mb-12">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900">💰 E-io-Pago</h1>
              <p className="text-gray-600 mt-2">Group expense tracking on Base</p>
            </div>
            <ConnectWallet />
          </div>
        </header>

        {/* Main Content */}
        {!isConnected ? (
          <div className="bg-white rounded-2xl shadow-xl p-12 text-center max-w-2xl mx-auto">
            <div className="text-6xl mb-6">🔐</div>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Connect Your Wallet
            </h2>
            <p className="text-gray-600 text-lg mb-8">
              Connect your Base Smart Wallet to view your group expenses and debts.
            </p>
            <ConnectWallet />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Welcome Card */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Welcome! 👋
              </h2>
              <p className="text-gray-600">
                Connected as:{' '}
                <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                  {address?.slice(0, 6)}...{address?.slice(-4)}
                </span>
              </p>
            </div>

            {/* Demo Group Card */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Your Groups
              </h2>
              <p className="text-gray-600 mb-6">
                Groups you belong to will appear here. For now, try the demo group:
              </p>

              <Link
                href="/group/demo-group-id"
                className="block p-6 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl hover:shadow-xl transition-all duration-200 transform hover:-translate-y-1"
              >
                <div className="flex items-center justify-between text-white">
                  <div>
                    <h3 className="text-xl font-bold mb-2">📱 Demo Group</h3>
                    <p className="text-blue-100">
                      Click to view expenses and debts
                    </p>
                  </div>
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </Link>
            </div>

            {/* Info Cards */}
            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-white rounded-xl shadow p-6">
                <div className="text-3xl mb-3">🏪</div>
                <h3 className="font-bold text-gray-900 mb-2">Track Expenses</h3>
                <p className="text-gray-600 text-sm">
                  All expenses stored on-chain permanently
                </p>
              </div>
              <div className="bg-white rounded-xl shadow p-6">
                <div className="text-3xl mb-3">⚖️</div>
                <h3 className="font-bold text-gray-900 mb-2">Split Bills</h3>
                <p className="text-gray-600 text-sm">
                  Automatically calculate who owes whom
                </p>
              </div>
              <div className="bg-white rounded-xl shadow p-6">
                <div className="text-3xl mb-3">✅</div>
                <h3 className="font-bold text-gray-900 mb-2">Mark Paid</h3>
                <p className="text-gray-600 text-sm">
                  Gasless transactions via Base Paymaster
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="mt-12 text-center text-gray-500 text-sm">
          <p>Built on Base Sepolia • Powered by OnchainKit</p>
        </footer>
      </div>
    </div>
  )
}
