'use client';

import { useSvgId } from './Isologo';

// Las "telas": hojas curvas que entran por una esquina, con el filo iluminado,
// pliegues suaves y grano. Son SVG quietos y decorativos: se pintan una vez y
// no reciben clics. Las ubica quien las usa (posición y ancho con className).

const COLOR = {
  hi: '#eef2ff',
  curl: '#a5b4fc',
  mid: '#4f46e5',
  deep: '#1e1b4b',
  base: '#0b0a1a',
  fold: '#c7d2fe',
  line: 'rgba(255, 255, 255, 0.7)',
};

function Grano({ id }: { id: string }) {
  return (
    <filter
      id={id}
      x="0"
      y="0"
      width="100%"
      height="100%"
      colorInterpolationFilters="sRGB"
    >
      <feTurbulence
        type="fractalNoise"
        baseFrequency="0.9"
        numOctaves={2}
        stitchTiles="stitch"
        result="ruido"
      />
      <feColorMatrix
        in="ruido"
        values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.55 -0.12"
      />
    </filter>
  );
}

type Forma = {
  edge: string;
  sheet: string;
  back: string;
  curl: string;
  folds: { d: string; opacity?: number }[];
  sheetGradient: [number, number, number, number];
  curlGradient: [number, number, number, number];
  backGradient: [number, number, number, number];
  foldGradient: [number, number, number, number];
};

// Entra por arriba a la derecha.
const SUPERIOR: Forma = {
  edge: 'M280 0C360 150 470 250 600 330C760 430 880 520 1000 640',
  sheet: 'M280 0C360 150 470 250 600 330C760 430 880 520 1000 640L1000 0Z',
  back: 'M236 0C318 168 440 282 582 372C742 472 872 566 1000 692L1000 0Z',
  curl: 'M280 0C360 150 470 250 600 330C760 430 880 520 1000 640L1000 556C880 448 770 370 640 290C520 214 420 118 366 0Z',
  folds: [
    { d: 'M1000 40C900 150 800 280 735 420C790 360 900 220 1000 120Z' },
    {
      d: 'M1000 260C930 300 870 350 830 400C890 380 950 360 1000 350Z',
      opacity: 0.7,
    },
  ],
  sheetGradient: [600, 340, 950, 20],
  curlGradient: [600, 334, 642, 266],
  backGradient: [560, 400, 640, 300],
  foldGradient: [1000, 0, 700, 420],
};

// Entra por abajo a la izquierda.
const INFERIOR: Forma = {
  edge: 'M0 300C130 360 230 440 330 540C430 640 560 740 700 800',
  sheet: 'M0 300C130 360 230 440 330 540C430 640 560 740 700 800L0 800Z',
  back: 'M0 250C140 320 250 410 355 515C460 620 600 730 760 800L0 800Z',
  curl: 'M0 300C130 360 230 440 330 540C430 640 560 740 700 800L610 800C480 720 370 640 280 560C190 480 100 410 0 380Z',
  folds: [
    { d: 'M0 500C100 560 190 650 250 800L190 800C140 680 70 600 0 560Z' },
  ],
  sheetGradient: [330, 545, 40, 790],
  curlGradient: [330, 540, 285, 590],
  backGradient: [380, 500, 330, 560],
  foldGradient: [0, 800, 360, 520],
};

const coords = ([x1, y1, x2, y2]: [number, number, number, number]) => ({
  gradientUnits: 'userSpaceOnUse' as const,
  x1,
  y1,
  x2,
  y2,
});

function Tela({ forma, className }: { forma: Forma; className: string }) {
  const id = useSvgId('tela');

  return (
    <svg
      viewBox="0 0 1000 800"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={`${id}-s`} {...coords(forma.sheetGradient)}>
          <stop offset="0" stopColor={COLOR.mid} />
          <stop offset="0.3" stopColor={COLOR.deep} />
          <stop offset="1" stopColor={COLOR.base} />
        </linearGradient>
        <linearGradient id={`${id}-c`} {...coords(forma.curlGradient)}>
          <stop offset="0" stopColor={COLOR.hi} stopOpacity="0.95" />
          <stop offset="0.22" stopColor={COLOR.curl} stopOpacity="0.75" />
          <stop offset="1" stopColor={COLOR.mid} stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}-b`} {...coords(forma.backGradient)}>
          <stop offset="0" stopColor={COLOR.deep} stopOpacity="0.9" />
          <stop offset="1" stopColor={COLOR.base} stopOpacity="0.9" />
        </linearGradient>
        <linearGradient id={`${id}-f`} {...coords(forma.foldGradient)}>
          <stop offset="0" stopColor={COLOR.fold} stopOpacity="0" />
          <stop offset="0.55" stopColor={COLOR.fold} stopOpacity="0.16" />
          <stop offset="1" stopColor={COLOR.fold} stopOpacity="0" />
        </linearGradient>
        <clipPath id={`${id}-k`}>
          <path d={forma.sheet} />
        </clipPath>
        <Grano id={`${id}-g`} />
      </defs>
      <path d={forma.back} fill={`url(#${id}-b)`} />
      <path d={forma.sheet} fill={`url(#${id}-s)`} />
      {forma.folds.map(({ d, opacity }) => (
        <path key={d} d={d} fill={`url(#${id}-f)`} opacity={opacity} />
      ))}
      <path d={forma.curl} fill={`url(#${id}-c)`} />
      <g clipPath={`url(#${id}-k)`}>
        <rect
          width="1000"
          height="800"
          filter={`url(#${id}-g)`}
          opacity="0.5"
        />
      </g>
      <path
        d={forma.edge}
        fill="none"
        stroke={COLOR.line}
        strokeWidth="1.2"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export function TelaSuperior({ className = '' }: { className?: string }) {
  return <Tela forma={SUPERIOR} className={className} />;
}

export function TelaInferior({ className = '' }: { className?: string }) {
  return <Tela forma={INFERIOR} className={className} />;
}
