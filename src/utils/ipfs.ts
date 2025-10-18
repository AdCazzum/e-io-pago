/**
 * IPFS integration using Pinata
 * Handles uploading receipt images to IPFS and retrieving them
 */

import { PinataSDK } from 'pinata';

/**
 * Initialize Pinata SDK client
 */
function getPinataClient(): PinataSDK {
  const jwt = process.env.PINATA_JWT;
  const gateway = process.env.PINATA_GATEWAY;

  if (jwt === undefined) {
    throw new Error('PINATA_JWT environment variable is required');
  }

  return new PinataSDK({
    pinataJwt: jwt,
    pinataGateway: gateway,
  });
}

/**
 * Uploads a receipt image to IPFS via Pinata
 * @param imageBuffer The image data as Uint8Array
 * @param mimeType MIME type of the image (e.g., 'image/jpeg')
 * @returns IPFS CID hash
 */
export async function uploadReceiptToIPFS(
  imageBuffer: Uint8Array,
  mimeType: string,
): Promise<string> {
  try {
    console.log('📤 Uploading image to IPFS via Pinata...');
    console.log(`   Size: ${imageBuffer.length} bytes`);
    console.log(`   Type: ${mimeType}`);

    const pinata = getPinataClient();

    // Determine file extension from MIME type
    const extension = mimeType.split('/')[1] ?? 'jpg';
    const filename = `receipt-${Date.now()}.${extension}`;

    // Create a Blob from the buffer
    const blob = new Blob([imageBuffer], { type: mimeType });

    // Create a File object
    const file = new File([blob], filename, { type: mimeType });

    // Upload to IPFS
    // @ts-expect-error - Pinata SDK types are incomplete
    const upload = (await pinata.upload.file(file)) as {
      IpfsHash: string;
      PinSize: number;
      Timestamp: string;
    };

    console.log('✅ Image uploaded to IPFS successfully!');
    console.log(`   CID: ${upload.IpfsHash}`);
    console.log(`   Size: ${upload.PinSize} bytes`);
    console.log(`   Gateway URL: ${getIPFSUrl(upload.IpfsHash)}`);

    return upload.IpfsHash;
  } catch (error) {
    console.error('❌ Error uploading to IPFS:', error);
    throw new Error(
      `Failed to upload image to IPFS: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Generates a public gateway URL for an IPFS hash
 * @param ipfsHash The IPFS CID
 * @returns Public gateway URL
 */
export function getIPFSUrl(ipfsHash: string): string {
  const gateway = process.env.PINATA_GATEWAY ?? 'https://gateway.pinata.cloud';

  // Remove trailing slash if present
  const cleanGateway = gateway.replace(/\/$/, '');

  return `${cleanGateway}/ipfs/${ipfsHash}`;
}

/**
 * Retrieves an image from IPFS (for testing/validation)
 * @param ipfsHash The IPFS CID
 * @returns Image buffer
 */
export async function getImageFromIPFS(ipfsHash: string): Promise<Uint8Array> {
  try {
    const url = getIPFSUrl(ipfsHash);
    console.log(`📥 Fetching image from IPFS: ${url}`);

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  } catch (error) {
    console.error('❌ Error fetching from IPFS:', error);
    throw new Error(
      `Failed to fetch image from IPFS: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Validates that Pinata is configured correctly
 * @returns true if configuration is valid
 */
export function validatePinataConfig(): boolean {
  const jwt = process.env.PINATA_JWT;

  if (jwt === undefined || jwt.trim().length === 0) {
    console.error('❌ PINATA_JWT is not configured');
    return false;
  }

  console.log('✅ Pinata configuration is valid');
  return true;
}
