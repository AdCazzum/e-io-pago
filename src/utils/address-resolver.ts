/**
 * Address resolution utilities
 * Resolves various address formats to Ethereum addresses
 */

import { getAddress } from '@coinbase/onchainkit/identity';
import { IdentifierKind } from '@xmtp/node-sdk';
import { base } from 'viem/chains';

import type { Conversation } from '@xmtp/agent-sdk';

/**
 * Extracts Ethereum addresses from conversation members
 */
async function getMemberAddresses(conversation: Conversation): Promise<string[]> {
  const members = await conversation.members();
  const addresses: string[] = [];

  for (const member of members) {
    const ethIdentifier = member.accountIdentifiers.find(
      (id) => id.identifierKind === IdentifierKind.Ethereum,
    );

    if (ethIdentifier !== undefined) {
      addresses.push(ethIdentifier.identifier);
    }
  }

  return addresses;
}

/**
 * Matches a shortened address against a list of full addresses
 * Supports formats: "0xabc...def", "0xabc…def" (with ellipsis)
 */
function matchShortenedAddress(shortenedAddress: string, fullAddresses: string[]): string | null {
  const match = shortenedAddress.match(/^(0x[a-fA-F0-9]+)(?:…|\.{2,3})([a-fA-F0-9]+)$/);
  if (match === null) {
    return null;
  }

  const [, prefix, suffix] = match;

  for (const fullAddress of fullAddresses) {
    const normalized = fullAddress.toLowerCase();
    if (
      normalized.startsWith(prefix.toLowerCase()) &&
      normalized.endsWith(suffix.toLowerCase())
    ) {
      return fullAddress.toLowerCase();
    }
  }

  return null;
}

/**
 * Resolves a basename to an Ethereum address using OnchainKit
 * Basenames are ENS names on Base (always ending with .base.eth)
 * Example: "alice.base.eth" or "bob.base.eth"
 */
async function resolveBasename(basename: string): Promise<string | null> {
  try {
    // Basename must end with .base.eth
    const fullName = basename.toLowerCase();
    if (!fullName.endsWith('.base.eth')) {
      console.log(`❌ Basename "${basename}" does not end with .base.eth`);
      return null; // Not a valid basename
    }

    console.log(`🔍 Resolving basename: ${fullName}`);

    // Use OnchainKit's getAddress function to resolve the basename
    // Setting chain: base makes it resolve Basenames instead of ENS
    const address = await getAddress({
      name: fullName,
      chain: base,
    });

    if (address !== null && address !== undefined) {
      console.log(`✅ Resolved "${fullName}" to ${address}`);
      return address.toLowerCase();
    } else {
      console.log(`❌ No address found for "${fullName}"`);
      return null;
    }
  } catch (error) {
    console.error('❌ Error resolving basename:', error);
    return null;
  }
}

/**
 * Resolves a creditor identifier to an Ethereum address
 * Supports:
 * - Full Ethereum addresses: "0x1234...5678" or "@0x1234...5678" (42 chars)
 * - Shortened addresses: "0x1234...5678", "@0x1234...5678", "0x1234…5678", "@0x1234…5678"
 * - Basenames: "alice.base.eth" or "@alice.base.eth"
 *
 * The @ prefix is optional for all formats
 *
 * @param identifier - The identifier to resolve
 * @param conversation - The conversation to search members in
 * @returns The resolved Ethereum address or null if not found
 */
export async function resolveCreditorAddress(
  identifier: string,
  conversation: Conversation,
): Promise<string | null> {
  // Remove @ prefix if present
  let trimmed = identifier.trim();
  if (trimmed.startsWith('@')) {
    trimmed = trimmed.substring(1);
  }

  // Case 1: Full Ethereum address (0x + 40 hex chars)
  if (trimmed.match(/^0x[a-fA-F0-9]{40}$/) !== null) {
    return trimmed.toLowerCase();
  }

  // Get member addresses for matching
  const memberAddresses = await getMemberAddresses(conversation);

  // Case 2: Exact match against member addresses (case-insensitive)
  for (const addr of memberAddresses) {
    if (addr.toLowerCase() === trimmed.toLowerCase()) {
      return addr.toLowerCase();
    }
  }

  // Case 3: Shortened address format (e.g., "0xabc...def")
  if (trimmed.match(/^0x[a-fA-F0-9]+(?:…|\.{2,3})[a-fA-F0-9]+$/) !== null) {
    const matched = matchShortenedAddress(trimmed, memberAddresses);
    if (matched !== null) {
      return matched;
    }
  }

  // Case 4: Try to resolve as basename
  // Basenames must end with .base.eth (e.g., "alice.base.eth")
  if (trimmed.endsWith('.base.eth')) {
    const resolvedBasename = await resolveBasename(trimmed);
    if (resolvedBasename !== null && resolvedBasename !== undefined) {
      // Verify the resolved address is in the group
      for (const addr of memberAddresses) {
        if (addr.toLowerCase() === resolvedBasename) {
          return resolvedBasename;
        }
      }
    }
  }

  return null;
}
