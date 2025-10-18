import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET(): Promise<ImageResponse> {
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          backgroundColor: '#0052FF',
          color: 'white',
          fontSize: 60,
          fontWeight: 'bold',
        }}
      >
        <div>e io pago</div>
        <div style={{ fontSize: 30, marginTop: 20 }}>
          Split receipts with your group
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
