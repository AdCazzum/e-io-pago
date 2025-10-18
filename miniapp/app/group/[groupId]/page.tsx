'use client';

import { useParams } from 'next/navigation';
import { useAccount } from 'wagmi';
import { useEffect, useState } from 'react';
import {
  getUserDebtsAndCredits,
  formatEther,
  type DebtInfo,
  type CreditInfo,
} from '@/lib/contract';
import { ConnectWallet } from '@coinbase/onchainkit/wallet';
import Link from 'next/link';
import { AddressDisplay } from '@/components/AddressDisplay';

export default function GroupPage() {
  const params = useParams();
  const groupId = params.groupId as string;
  const { address, isConnected, isConnecting } = useAccount();

  const [debtsData, setDebtsData] = useState<{
    debts: DebtInfo[];
    credits: CreditInfo[];
    totalDebts: bigint;
    totalCredits: bigint;
    netBalance: bigint;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [isInitializing, setIsInitializing] = useState(true);
  const [showConnectButton, setShowConnectButton] = useState(false);

  // Auto-connect logic
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitializing(false);
      if (!isConnected) {
        setShowConnectButton(true);
      }
    }, 3000);

    if (isConnected) {
      clearTimeout(timer);
      setIsInitializing(false);
    }

    return () => {
      clearTimeout(timer);
    };
  }, [isConnected]);

  // Fetch debts/credits data
  useEffect(() => {
    async function fetchData() {
      if (!address || !isConnected) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const data = await getUserDebtsAndCredits(groupId, address);
        setDebtsData(data);
      } catch (error) {
        console.error('Error fetching debts/credits:', error);
      } finally {
        setLoading(false);
      }
    }

    void fetchData();
  }, [groupId, address, isConnected]);

  // Loading state
  if (isInitializing || isConnecting) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="mb-6 animate-bounce">
            <div className="text-7xl">💰</div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-3">Loading...</h1>
          <div className="flex items-center justify-center gap-2 text-gray-600">
            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span>Connecting...</span>
          </div>
        </div>
      </div>
    );
  }

  // Not connected
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
        <div className="bg-white rounded-3xl shadow-xl p-8 text-center max-w-md">
          <div className="text-6xl mb-6">🔐</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Connect Your Wallet</h2>
          <p className="text-gray-600 mb-8 leading-relaxed">
            Connect your Base Smart Wallet to view group expenses and debts.
          </p>
          {showConnectButton && (
            <div className="flex justify-center">
              <ConnectWallet />
            </div>
          )}
        </div>
      </div>
    );
  }

  // Loading debts/credits
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-pulse">📊</div>
          <p className="text-xl text-gray-700">Loading group data...</p>
        </div>
      </div>
    );
  }

  const isPositiveBalance = debtsData && debtsData.netBalance >= 0n;
  const balanceColor = isPositiveBalance ? 'text-green-600' : 'text-red-600';
  const balanceSign = isPositiveBalance ? '+' : '';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        {/* Header */}
        <header className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <Link href="/" className="text-blue-600 hover:text-blue-700 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span className="font-medium">Back</span>
            </Link>
            {showConnectButton && (
              <div className="scale-90">
                <ConnectWallet />
              </div>
            )}
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Group Expenses</h1>
          <p className="text-sm text-gray-600 font-mono mt-1 truncate">
            {groupId}
          </p>
        </header>

        {/* Net Balance Card */}
        <div className="bg-white rounded-3xl shadow-lg p-6 mb-5">
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-2">Your Net Balance</p>
            <div className={`text-4xl font-bold ${balanceColor} mb-1`}>
              {balanceSign}${debtsData ? formatEther(debtsData.netBalance) : '0.00'}
            </div>
            {debtsData && debtsData.netBalance !== 0n && (
              <p className="text-xs text-gray-500">
                {isPositiveBalance ? 'You are owed' : 'You owe'}
              </p>
            )}
          </div>
        </div>


        {/* Debts Section */}
        {debtsData && debtsData.debts.length > 0 && (
          <div className="mb-5">
            <h2 className="text-lg font-bold text-gray-900 mb-3 px-1">💸 Your Debts</h2>
            <div className="space-y-3">
              {debtsData.debts.map((debt, index) => (
                <div key={index} className="bg-white rounded-2xl shadow p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-500 mb-2">You owe</p>
                      <AddressDisplay address={debt.creditor} />
                    </div>
                    <div className="text-right ml-3">
                      <p className="text-xl font-bold text-red-600">
                        ${formatEther(debt.amount)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 text-sm text-gray-600 text-center">
                    To mark as paid, use the <span className="font-mono bg-gray-100 px-2 py-1 rounded">@eiopago paid</span> command in your XMTP chat
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Credits Section */}
        {debtsData && debtsData.credits.length > 0 && (
          <div className="mb-5">
            <h2 className="text-lg font-bold text-gray-900 mb-3 px-1">💰 Your Credits</h2>
            <div className="space-y-3">
              {debtsData.credits.map((credit, index) => (
                <div key={index} className="bg-white rounded-2xl shadow p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-500 mb-2">Owes you</p>
                      <AddressDisplay address={credit.debtor} />
                    </div>
                    <div className="text-right ml-3">
                      <p className="text-xl font-bold text-green-600">
                        ${formatEther(credit.amount)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {debtsData && debtsData.debts.length === 0 && debtsData.credits.length === 0 && (
          <div className="bg-white rounded-3xl shadow-lg p-8 text-center mb-5">
            <div className="text-6xl mb-4">✨</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">All Settled!</h3>
            <p className="text-gray-600 leading-relaxed">
              No debts or credits in this group yet. Send a receipt photo in your XMTP chat to get started.
            </p>
          </div>
        )}

        {/* View Expenses Button */}
        <Link
          href={`/group/${groupId}/expenses`}
          className="block bg-white rounded-2xl shadow p-4 hover:shadow-lg transition-all duration-200 active:scale-98"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-2xl">📋</div>
              <div>
                <p className="font-bold text-gray-900">View All Expenses</p>
                <p className="text-sm text-gray-600">See complete expense history</p>
              </div>
            </div>
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Link>

        {/* Footer */}
        <footer className="mt-8 text-center text-gray-500 text-xs">
          <p>Built on Base Sepolia</p>
        </footer>
      </div>
    </div>
  );
}
