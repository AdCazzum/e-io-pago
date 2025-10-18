'use client';

import { Avatar, Name } from '@coinbase/onchainkit/identity';
import { baseSepolia } from 'viem/chains';

interface AddressDisplayProps {
  address: string;
  showAvatar?: boolean;
}

export function AddressDisplay({ address, showAvatar = true }: AddressDisplayProps) {
  // Use Base Sepolia for testnet
  const useLocalNetwork = process.env.NEXT_PUBLIC_USE_LOCAL_NETWORK === 'true';
  const chain = useLocalNetwork ? baseSepolia : baseSepolia; // Always Base Sepolia for now

  return (
    <div className="flex items-center gap-2 min-w-0">
      {showAvatar && (
        <Avatar
          address={address as `0x${string}`}
          chain={chain}
          className="w-8 h-8 rounded-full flex-shrink-0"
        />
      )}
      <div className="flex-1 min-w-0 overflow-hidden">
        <Name
          address={address as `0x${string}`}
          chain={chain}
          className="font-medium text-gray-900 truncate block"
        />
      </div>
    </div>
  );
}
