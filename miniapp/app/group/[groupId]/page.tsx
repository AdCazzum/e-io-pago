'use client'

import { useParams } from 'next/navigation'
import { useAccount } from 'wagmi'
import { useEffect, useState } from 'react'
import { getUserDebtsAndCredits, formatEther, formatAddress, type DebtInfo, type CreditInfo } from '@/lib/contract'
import { ConnectWallet } from '@coinbase/onchainkit/wallet'
import Link from 'next/link'

export default function GroupPage() {
  const params = useParams()
  const groupId = params.groupId as string
  const { address, isConnected } = useAccount()

  const [debtsData, setDebtsData] = useState<{
    debts: DebtInfo[]
    credits: CreditInfo[]
    totalDebts: bigint
    totalCredits: bigint
    netBalance: bigint
  } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      if (!address || !isConnected) {
        setLoading(false)
        return
      }

      setLoading(true)
      try {
        const data = await getUserDebtsAndCredits(groupId, address)
        setDebtsData(data)
      } catch (error) {
        console.error('Error fetching debts/credits:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [groupId, address, isConnected])

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-12 text-center max-w-md">
          <div className="text-6xl mb-6">🔐</div>
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Connect Your Wallet
          </h2>
          <p className="text-gray-600 mb-8">
            Please connect your Base wallet to view group expenses and debts.
          </p>
          <ConnectWallet />
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">⏳</div>
          <p className="text-xl text-gray-700">Loading group data...</p>
        </div>
      </div>
    )
  }

  const isPositiveBalance = debtsData && debtsData.netBalance >= 0n
  const balanceColor = isPositiveBalance ? 'text-green-600' : 'text-red-600'
  const balanceSign = isPositiveBalance ? '+' : ''

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <header className="mb-8 flex items-center justify-between">
          <div>
            <Link href="/" className="text-blue-600 hover:text-blue-800 mb-2 inline-block">
              ← Back to Home
            </Link>
            <h1 className="text-4xl font-bold text-gray-900">Group Dashboard</h1>
            <p className="text-gray-600 mt-2">Group ID: {groupId}</p>
          </div>
          <ConnectWallet />
        </header>

        {/* Net Balance Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          <h2 className="text-xl text-gray-600 mb-2">Your Net Balance</h2>
          <div className={`text-5xl font-bold ${balanceColor}`}>
            {debtsData ? `${balanceSign}${formatEther(debtsData.netBalance)} EUR` : '0.00 EUR'}
          </div>
          <p className="text-gray-500 mt-2">
            {isPositiveBalance
              ? 'You are owed money overall'
              : 'You owe money overall'}
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-6">
          {/* You Owe Section */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              💸 You Owe
            </h2>
            {debtsData && debtsData.debts.length > 0 ? (
              <div className="space-y-3">
                {debtsData.debts.map((debt, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 bg-red-50 rounded-lg"
                  >
                    <div>
                      <p className="font-mono text-sm text-gray-600">
                        {formatAddress(debt.creditor)}
                      </p>
                      <p className="text-xl font-bold text-red-600">
                        {formatEther(debt.amount)} EUR
                      </p>
                    </div>
                    <button
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                      onClick={() => {
                        // TODO: Implement markAsPaid transaction
                        alert('Mark as Paid functionality coming soon!')
                      }}
                    >
                      Mark as Paid
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <div className="text-4xl mb-2">✅</div>
                <p>You don't owe anyone!</p>
              </div>
            )}
          </div>

          {/* You Are Owed Section */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              💰 You Are Owed
            </h2>
            {debtsData && debtsData.credits.length > 0 ? (
              <div className="space-y-3">
                {debtsData.credits.map((credit, index) => (
                  <div
                    key={index}
                    className="p-4 bg-green-50 rounded-lg"
                  >
                    <p className="font-mono text-sm text-gray-600">
                      {formatAddress(credit.debtor)}
                    </p>
                    <p className="text-xl font-bold text-green-600">
                      {formatEther(credit.amount)} EUR
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <div className="text-4xl mb-2">💭</div>
                <p>No one owes you money</p>
              </div>
            )}
          </div>
        </div>

        {/* View Expenses Link */}
        <Link
          href={`/group/${groupId}/expenses`}
          className="block p-6 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl hover:shadow-xl transition-all duration-200 transform hover:-translate-y-1 text-white"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold mb-2">📋 View All Expenses</h3>
              <p className="text-blue-100">
                See detailed expense history with receipts
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
    </div>
  )
}
