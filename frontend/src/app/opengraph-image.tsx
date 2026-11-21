import { ImageResponse } from 'next/og';
import {
  BRAND_FROM,
  BRAND_TO,
  ISOLOGO,
  WORDMARK,
} from '@/components/brand/paths';

// La vista previa general al compartir un link de NeoPass (la home y los
// eventos sin flyer): la N en su pastilla sobre «neopass». Se genera una sola
// vez, en el build.
export const alt = 'NeoPass: comprá tus entradas y organizá tus eventos';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const STOPS = `<stop offset="0" stop-color="${BRAND_FROM}"/><stop offset="1" stop-color="${BRAND_TO}"/>`;

const gradient = ({
  x1,
  y1,
  x2,
  y2,
}: Record<'x1' | 'y1' | 'x2' | 'y2', number>) =>
  `<linearGradient id="g" gradientUnits="userSpaceOnUse" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${STOPS}</linearGradient>`;

const ISOLOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ISOLOGO.width} ${ISOLOGO.height}"><defs>${gradient(ISOLOGO.gradient)}</defs><path d="${ISOLOGO.d}" fill="url(#g)"/></svg>`;

const WORDMARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WORDMARK.width} ${WORDMARK.height}"><defs>${gradient(WORDMARK.gradient)}</defs>${WORDMARK.neo
  .map((d) => `<path d="${d}" fill="url(#g)"/>`)
  .join('')}${WORDMARK.pass
  .map((d) => `<path d="${d}" fill="#fafafa"/>`)
  .join('')}</svg>`;

const dataUri = (svg: string) =>
  `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;

const ISOLOGO_WIDTH = 84;
const WORDMARK_HEIGHT = 92;

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
        color: '#fafafa',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 140,
          height: 140,
          borderRadius: 38,
          border: '1px solid rgba(255, 255, 255, 0.12)',
          backgroundImage: 'linear-gradient(180deg, #19191f, #0e0e12)',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse no usa next/image */}
        <img
          alt=""
          src={dataUri(ISOLOGO_SVG)}
          width={ISOLOGO_WIDTH}
          height={Math.round((ISOLOGO_WIDTH * ISOLOGO.height) / ISOLOGO.width)}
        />
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse no usa next/image */}
      <img
        alt=""
        src={dataUri(WORDMARK_SVG)}
        width={Math.round((WORDMARK_HEIGHT * WORDMARK.width) / WORDMARK.height)}
        height={WORDMARK_HEIGHT}
        style={{ marginTop: 44 }}
      />
      <div
        style={{
          display: 'flex',
          fontSize: 38,
          color: '#a3a3a3',
          marginTop: 36,
        }}
      >
        Comprá tus entradas. Organizá tus eventos.
      </div>
    </div>,
    size,
  );
}
