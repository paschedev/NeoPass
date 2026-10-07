'use client';

import { useCallback, useEffect, type ComponentProps } from 'react';
import { useRouter } from 'next/navigation';
import { Scanner, type IDetectedBarcode } from '@yudiel/react-qr-scanner';
import { ScanLine } from 'lucide-react';
import ScanHistory from '@/components/scanner/ScanHistory';
import ScanResultPanel, {
  TONE_STYLES,
} from '@/components/scanner/ScanResultPanel';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useDoorScanner } from '@/hooks/useDoorScanner';
import { canScan } from '@/utils/roles';
import { scanTone } from '@/utils/scan-result';

// Fuera del componente: props nuevas en cada render reinician la lectura de
// la librería, que vuelve a leer el QR que tiene enfrente.
const FORMATS: ComponentProps<typeof Scanner>['formats'] = ['qr_code'];
const CAMERA_CLASSES = { container: 'w-full h-full', video: 'object-cover' };

export default function EscanearPage() {
  const router = useRouter();
  const { user } = useCurrentUser();
  const { state, history, onDetect, dismiss, retry, showResult } =
    useDoorScanner();

  useEffect(() => {
    if (!canScan(user)) router.push('/panel');
  }, [user, router]);

  const handleScan = useCallback(
    (codes: IDetectedBarcode[]) => onDetect(codes.map((c) => c.rawValue)),
    [onDetect],
  );

  const styles =
    state.kind === 'result' ? TONE_STYLES[scanTone(state.result.status)] : null;

  return (
    <div
      className={`min-h-[80vh] pb-24 md:pb-8 flex flex-col items-center justify-center transition-colors duration-500 ${
        styles ? styles.bgDark : 'bg-transparent'
      }`}
    >
      <div className="max-w-md mx-auto w-full px-4 flex flex-col items-center relative z-10">
        <h1 className="font-outfit text-3xl font-bold mb-2 text-center text-white">
          Scanner de accesos
        </h1>
        <p className="text-neutral-300 mb-8 text-center">
          Apuntá la cámara al código QR de la entrada
        </p>

        <div
          className={`relative w-full aspect-square rounded-3xl overflow-hidden border-4 shadow-2xl transition-all duration-300 ${
            styles ? `${styles.border} scale-105` : 'border-white/10 bg-black'
          }`}
        >
          {/* La librería no suena: suena NeoPass cuando hay un resultado. */}
          <Scanner
            onScan={handleScan}
            formats={FORMATS}
            classNames={CAMERA_CLASSES}
            allowMultiple
            sound={false}
          />

          {state.kind === 'scanning' ? (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <ScanLine
                className="w-48 h-48 text-white/30 animate-pulse"
                strokeWidth={1}
              />
            </div>
          ) : (
            <ScanResultPanel state={state} onNext={dismiss} onRetry={retry} />
          )}
        </div>

        <ScanHistory history={history} />

        {process.env.NODE_ENV === 'development' && (
          <div className="mt-8 flex flex-col items-center w-full">
            <p className="text-xs text-neutral-500 uppercase tracking-widest font-bold mb-3">
              Modo prueba (simulación)
            </p>
            <div className="flex gap-2 w-full">
              <button
                onClick={() =>
                  showResult({
                    status: 'VALID',
                    message: 'VÁLIDO',
                    event: 'Fiesta de Primavera',
                    type: 'General',
                  })
                }
                className="flex-1 bg-emerald-900/30 hover:bg-emerald-800/50 text-emerald-400 border border-emerald-500/30 py-2 rounded-xl font-medium transition-all text-xs"
              >
                Válido
              </button>
              <button
                onClick={() =>
                  showResult({
                    status: 'USED',
                    message: 'YA INGRESÓ',
                    usedAt: new Date(Date.now() - 8_000).toISOString(),
                    usedBy: 'Juan Pérez',
                    usedByYou: false,
                  })
                }
                className="flex-1 bg-amber-900/30 hover:bg-amber-800/50 text-amber-400 border border-amber-500/30 py-2 rounded-xl font-medium transition-all text-xs"
              >
                Usado
              </button>
              <button
                onClick={() =>
                  showResult({ status: 'INVALID', message: 'INVÁLIDO' })
                }
                className="flex-1 bg-red-900/30 hover:bg-red-800/50 text-red-400 border border-red-500/30 py-2 rounded-xl font-medium transition-all text-xs"
              >
                Inválido
              </button>
              <button
                onClick={() =>
                  showResult(
                    { status: 'NO_CONNECTION', message: 'NO SE PUDO VALIDAR' },
                    true,
                  )
                }
                className="flex-1 bg-red-900/30 hover:bg-red-800/50 text-red-400 border border-red-500/30 py-2 rounded-xl font-medium transition-all text-xs"
              >
                Sin señal
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
