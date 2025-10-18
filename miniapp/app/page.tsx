'use client';

import { ConnectWallet } from '@coinbase/onchainkit/wallet';
import { useAccount } from 'wagmi';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function Home() {
  const { address, isConnected, isConnecting } = useAccount();
  const [showConnectButton, setShowConnectButton] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  // Auto-connect flow: wait for wallet to connect automatically
  useEffect(() => {
    // Give the wallet 3 seconds to auto-connect from Base App
    const timer = setTimeout(() => {
      setIsInitializing(false);
      if (!isConnected) {
        setShowConnectButton(true);
      }
    }, 3000);

    // If connected immediately, clear timer and show content
    if (isConnected) {
      clearTimeout(timer);
      setIsInitializing(false);
    }

    return () => {
      clearTimeout(timer);
    };
  }, [isConnected]);

  // Loading state during auto-connect
  if (isInitializing || isConnecting) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
        <div className="text-center">
          {/* Animated logo */}
          <div className="mb-6 animate-bounce">
            <div className="text-7xl">💰</div>
          </div>

          <h1 className="text-3xl font-bold text-gray-900 mb-3">
            e io pago
          </h1>

          {/* Loading spinner */}
          <div className="flex items-center justify-center gap-2 text-gray-600">
            <svg
              className="animate-spin h-5 w-5"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span>Connecting...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        {/* Header - Mobile optimized */}
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">💰 e io pago</h1>
              <p className="text-gray-600 text-sm mt-1">Split expenses on Base</p>
            </div>
            {isConnected && showConnectButton && (
              <div className="scale-90 origin-right">
                <ConnectWallet />
              </div>
            )}
          </div>
        </header>

        {/* Main Content */}
        {!isConnected ? (
          <div className="bg-white rounded-3xl shadow-xl p-8 text-center">
            <div className="text-6xl mb-6">🔐</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">
              Connect Your Wallet
            </h2>
            <p className="text-gray-600 mb-8 leading-relaxed">
              Connect your Base Smart Wallet to view group expenses and track debts.
            </p>
            {showConnectButton && (
              <div className="flex justify-center">
                <ConnectWallet />
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-5">
            {/* Welcome Card - Compact for mobile */}
            <div className="bg-white rounded-2xl shadow-lg p-5">
              <div className="flex items-center gap-3">
                <div className="text-3xl">👋</div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-bold text-gray-900 mb-1">
                    Welcome back!
                  </h2>
                  <p className="text-sm text-gray-600 font-mono truncate">
                    {address?.slice(0, 6)}...{address?.slice(-4)}
                  </p>
                </div>
              </div>
            </div>

            {/* Info Message */}
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5">
              <div className="flex gap-3">
                <div className="text-2xl flex-shrink-0">ℹ️</div>
                <div>
                  <h3 className="font-semibold text-blue-900 mb-1 text-sm">
                    How to use
                  </h3>
                  <p className="text-blue-800 text-sm leading-relaxed">
                    In your XMTP group chat, send <span className="font-mono bg-blue-100 px-1.5 py-0.5 rounded">@eiopago status</span> to get a direct link to your group's page.
                  </p>
                </div>
              </div>
            </div>

            {/* Features Grid - Mobile optimized */}
            <div className="grid grid-cols-1 gap-4">
              <div className="bg-white rounded-2xl shadow p-5">
                <div className="flex items-start gap-4">
                  <div className="text-4xl flex-shrink-0">📸</div>
                  <div>
                    <h3 className="font-bold text-gray-900 mb-1">Send Receipt Photos</h3>
                    <p className="text-gray-600 text-sm leading-relaxed">
                      In XMTP, send a receipt photo and I'll analyze and split the bill automatically
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow p-5">
                <div className="flex items-start gap-4">
                  <div className="text-4xl flex-shrink-0">⚖️</div>
                  <div>
                    <h3 className="font-bold text-gray-900 mb-1">Track Debts</h3>
                    <p className="text-gray-600 text-sm leading-relaxed">
                      See who owes what and track all expenses on-chain
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow p-5">
                <div className="flex items-start gap-4">
                  <div className="text-4xl flex-shrink-0">✅</div>
                  <div>
                    <h3 className="font-bold text-gray-900 mb-1">Mark as Paid</h3>
                    <p className="text-gray-600 text-sm leading-relaxed">
                      Settle debts with gasless transactions on Base
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="mt-8 text-center text-gray-500 text-xs">
          <p>Built on Base Sepolia</p>
        </footer>
      </div>
    </div>
  );
}
