'use client'

import { useParams } from 'next/navigation'
import { useAccount } from 'wagmi'
import { useEffect, useState } from 'react'
import { getGroupExpenses, formatEther, formatAddress, type ExpenseData } from '@/lib/contract'
import { ConnectWallet } from '@coinbase/onchainkit/wallet'
import Link from 'next/link'

function getIPFSUrl(ipfsHash: string): string {
  const gateway = process.env.NEXT_PUBLIC_PINATA_GATEWAY || 'https://gateway.pinata.cloud'
  return `${gateway}/ipfs/${ipfsHash}`
}

export default function ExpensesPage() {
  const params = useParams()
  const groupId = params.groupId as string
  const { address, isConnected } = useAccount()

  const [expenses, setExpenses] = useState<ExpenseData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchExpenses() {
      if (!isConnected) {
        setLoading(false)
        return
      }

      setLoading(true)
      try {
        const data = await getGroupExpenses(groupId)
        setExpenses(data)
      } catch (error) {
        console.error('Error fetching expenses:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchExpenses()
  }, [groupId, isConnected])

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-12 text-center max-w-md">
          <div className="text-6xl mb-6">🔐</div>
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Connect Your Wallet
          </h2>
          <p className="text-gray-600 mb-8">
            Please connect your Base wallet to view expenses.
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
          <p className="text-xl text-gray-700">Loading expenses...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <header className="mb-8 flex items-center justify-between">
          <div>
            <Link href={`/group/${groupId}`} className="text-blue-600 hover:text-blue-800 mb-2 inline-block">
              ← Back to Dashboard
            </Link>
            <h1 className="text-4xl font-bold text-gray-900">All Expenses</h1>
            <p className="text-gray-600 mt-2">Group ID: {groupId}</p>
          </div>
          <ConnectWallet />
        </header>

        {/* Expenses List */}
        {expenses.length > 0 ? (
          <div className="space-y-4">
            {expenses.map((expense) => {
              const date = new Date(Number(expense.timestamp) * 1000)
              const metadata = expense.metadata ? JSON.parse(expense.metadata) : null

              return (
                <div key={expense.id.toString()} className="bg-white rounded-xl shadow-lg p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-2xl font-bold text-gray-900">
                        {expense.merchant}
                      </h3>
                      <p className="text-gray-500 text-sm">
                        {date.toLocaleDateString()} at {date.toLocaleTimeString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-bold text-blue-600">
                        {formatEther(expense.totalAmount)} {expense.currency}
                      </p>
                      <p className="text-gray-500 text-sm">
                        {formatEther(expense.perPersonAmount)} {expense.currency} per person
                      </p>
                    </div>
                  </div>

                  {/* Payer Info */}
                  <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600">
                      Paid by:{' '}
                      <span className="font-mono font-bold">
                        {formatAddress(expense.payer)}
                      </span>
                      {address && expense.payer.toLowerCase() === address.toLowerCase() && (
                        <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                          You
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      Split between {expense.participants.length} people
                    </p>
                  </div>

                  {/* Metadata (Items, Subtotal, Tax, Tip) */}
                  {metadata && (
                    <div className="mb-4">
                      {metadata.items && metadata.items.length > 0 && (
                        <div className="mb-3">
                          <h4 className="font-bold text-gray-700 mb-2">Items:</h4>
                          <ul className="space-y-1">
                            {metadata.items.map((item: { name: string; price: number }, index: number) => (
                              <li key={index} className="flex justify-between text-sm text-gray-600">
                                <span>{item.name}</span>
                                <span>{item.price.toFixed(2)} {expense.currency}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <div className="border-t pt-2 space-y-1 text-sm">
                        {metadata.subtotal && (
                          <div className="flex justify-between text-gray-600">
                            <span>Subtotal:</span>
                            <span>{metadata.subtotal.toFixed(2)} {expense.currency}</span>
                          </div>
                        )}
                        {metadata.tax && (
                          <div className="flex justify-between text-gray-600">
                            <span>Tax:</span>
                            <span>{metadata.tax.toFixed(2)} {expense.currency}</span>
                          </div>
                        )}
                        {metadata.tip && (
                          <div className="flex justify-between text-gray-600">
                            <span>Tip:</span>
                            <span>{metadata.tip.toFixed(2)} {expense.currency}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Receipt Image Link */}
                  {expense.ipfsHash && (
                    <a
                      href={getIPFSUrl(expense.ipfsHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      View Receipt Image
                    </a>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
            <div className="text-6xl mb-4">📭</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              No Expenses Yet
            </h2>
            <p className="text-gray-600">
              Upload a receipt in the XMTP group chat to get started!
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
