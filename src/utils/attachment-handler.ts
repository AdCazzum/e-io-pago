/**
 * Attachment handling utilities for XMTP remote attachments
 * Based on XMTP agent examples best practices
 */

import {
  RemoteAttachmentCodec,
  type Attachment,
  type RemoteAttachment,
} from '@xmtp/content-type-remote-attachment';

import type { CodecRegistry } from '@xmtp/content-type-primitives';

/**
 * Public IPFS gateways to try as fallbacks
 * Order matters - faster/more reliable gateways first
 */
const PUBLIC_IPFS_GATEWAYS = [
  'https://ipfs.io',
  'https://cloudflare-ipfs.com',
  'https://dweb.link',
] as const;

/**
 * Extracts the IPFS CID (Content Identifier) from a URL
 *
 * @param url - The IPFS URL (can be from any gateway)
 * @returns The CID or null if not found
 */
function extractIPFSCID(url: string): string | null {
  // Match patterns like:
  // - https://gateway.pinata.cloud/ipfs/QmXxx
  // - https://xxx.mypinata.cloud/ipfs/bafyxxx
  // - ipfs://QmXxx
  const match = url.match(/\/ipfs\/([a-zA-Z0-9]+)/);
  return match?.[1] ?? null;
}

/**
 * Loads and decrypts a remote attachment with IPFS gateway fallback
 *
 * @param remoteAttachment - The remote attachment metadata
 * @param client - The XMTP client with codec registry
 * @returns The decrypted attachment with data
 */
export async function loadRemoteAttachment(
  remoteAttachment: RemoteAttachment,
  client: CodecRegistry,
): Promise<Attachment> {
  try {
    console.log('🔧 Attempting to load and decrypt attachment...');

    // Try the original URL first
    try {
      console.log(`📥 Trying original URL: ${remoteAttachment.url}`);
      const attachment = await RemoteAttachmentCodec.load<Attachment>(
        remoteAttachment,
        client,
      );
      console.log('✅ Successfully loaded from original URL');
      return attachment;
    } catch (originalError) {
      console.log(`⚠️  Original URL failed: ${originalError instanceof Error ? originalError.message : 'Unknown'}`);

      // Extract CID for fallback
      const cid = extractIPFSCID(remoteAttachment.url);
      if (cid === null) {
        throw new Error(`Could not extract IPFS CID from URL: ${remoteAttachment.url}`);
      }

      console.log(`📦 Extracted CID: ${cid}`);
      console.log('🔄 Trying public IPFS gateways...');

      // Try each public gateway
      for (const gateway of PUBLIC_IPFS_GATEWAYS) {
        const fallbackUrl = `${gateway}/ipfs/${cid}`;
        console.log(`🔄 Trying gateway: ${gateway}`);

        try {
          const modifiedAttachment: RemoteAttachment = {
            ...remoteAttachment,
            url: fallbackUrl,
          };

          const attachment = await RemoteAttachmentCodec.load<Attachment>(
            modifiedAttachment,
            client,
          );

          console.log(`✅ Successfully loaded from: ${gateway}`);
          return attachment;
        } catch (gatewayError) {
          console.log(`⚠️  Gateway ${gateway} failed: ${gatewayError instanceof Error ? gatewayError.message : 'Unknown'}`);
          // Continue to next gateway
        }
      }

      // If all gateways failed, throw error
      throw new Error(
        `Could not load attachment from any gateway. CID: ${cid}. ` +
        'The file may not be available on public IPFS networks.',
      );
    }
  } catch (error) {
    // Log the full error for debugging
    console.error('❌ Attachment loading error:', error);

    // Provide more context for debugging
    if (error instanceof Error) {
      console.error(`❌ Error message: ${error.message}`);

      if (error.message.includes('gateway') || error.message.includes('CID')) {
        throw new Error(
          'Could not download the attachment from any IPFS gateway. ' +
          'The file may not be publicly accessible. Please try sending the image again.',
        );
      }

      if (error.message.includes('digest')) {
        throw new Error(
          'Failed to verify attachment integrity. The file may be corrupted. Please try sending the image again.',
        );
      }

      throw new Error(`Failed to load attachment: ${error.message}`);
    }
    throw new Error('Failed to load attachment: Unknown error');
  }
}

/**
 * Validates that an attachment is an image
 *
 * @param mimeType - The MIME type to check
 * @returns True if the MIME type is an image
 */
export function isImage(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

/**
 * Validates that an image is in a supported format for GPT-4o Vision
 *
 * @param mimeType - The MIME type to check
 * @returns True if the format is supported
 */
export function isSupportedImageFormat(mimeType: string): boolean {
  const supportedFormats = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
  ];
  return supportedFormats.includes(mimeType.toLowerCase());
}

/**
 * Converts attachment data to base64 string for GPT-4o Vision API
 *
 * @param data - The attachment data as Uint8Array
 * @returns Base64-encoded string
 */
export function attachmentToBase64(data: Uint8Array): string {
  return Buffer.from(data).toString('base64');
}
