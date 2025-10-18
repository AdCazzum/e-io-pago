import { networkInterfaces } from 'os';

/**
 * Script to get the local IP address of the machine
 * Useful for mobile testing when you need to connect to Hardhat node from phone
 */
function getLocalIpAddress(): string | null {
  const nets = networkInterfaces();

  for (const name of Object.keys(nets)) {
    const netInterface = nets[name];
    if (netInterface === undefined) continue;

    for (const net of netInterface) {
      // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
      const familyV4Value = typeof net.family === 'string' ? 'IPv4' : 4;
      if (net.family === familyV4Value && !net.internal) {
        return net.address;
      }
    }
  }

  return null;
}

console.log('🌐 Local Network Configuration\n');
console.log('═'.repeat(60));

const ip = getLocalIpAddress();

if (ip !== null) {
  console.log('✅ Your computer\'s local IP address:', ip);
  console.log('═'.repeat(60));
  console.log('\n📱 For mobile testing, update miniapp/.env.local:');
  console.log('─'.repeat(60));
  console.log(`NEXT_PUBLIC_LOCAL_RPC_URL=http://${ip}:8545`);
  console.log('─'.repeat(60));
  console.log('\n📝 Steps:');
  console.log('  1. Make sure your phone is on the same WiFi network');
  console.log('  2. Start Hardhat node: npm run hardhat:node');
  console.log('  3. Deploy contract: npm run hardhat:deploy');
  console.log(`  4. Update miniapp/.env.local with: http://${ip}:8545`);
  console.log('  5. Start miniapp: cd miniapp && npm run dev');
  console.log(`  6. On your phone, open: http://${ip}:3000`);
  console.log('\n⚠️  Make sure your firewall allows connections on ports 8545 and 3000\n');
} else {
  console.error('❌ Could not determine local IP address');
  console.error('   Try running: ifconfig (macOS/Linux) or ipconfig (Windows)\n');
}
