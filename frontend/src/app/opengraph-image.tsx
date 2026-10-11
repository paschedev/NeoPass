import { ImageResponse } from 'next/og';

// La vista previa general al compartir un link de NeoPass (la home y los
// eventos sin flyer). Se genera una sola vez, en el build.
export const alt = 'NeoPass: comprá tus entradas y organizá tus eventos';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0a0a0a',
        backgroundImage:
          'radial-gradient(circle at 15% 10%, rgba(79, 70, 229, 0.35), transparent 45%), radial-gradient(circle at 90% 60%, rgba(147, 51, 234, 0.22), transparent 45%)',
        color: '#fafafa',
      }}
    >
      <div style={{ display: 'flex', fontSize: 150, letterSpacing: -6 }}>
        Neo<span style={{ color: '#6366f1' }}>Pass</span>
      </div>
      <div style={{ display: 'flex', fontSize: 40, color: '#a3a3a3' }}>
        Comprá tus entradas. Organizá tus eventos.
      </div>
    </div>,
    size,
  );
}
