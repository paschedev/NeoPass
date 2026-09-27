'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Scanner } from '@yudiel/react-qr-scanner';
import { CheckCircle2, XCircle, ScanLine, AlertTriangle } from 'lucide-react';
import { apiFetch } from '@/utils/api';
import { getApiErrorMessage } from '@/utils/api-error';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { canScan } from '@/utils/roles';
import { isRepeatedScan, LastScan } from '@/utils/scan-cooldown';

export default function EscanearPage() {
  const [scanResult, setScanResult] = useState<{
    success: boolean;
    status?: string;
    message: string;
    event?: string;
    type?: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const lastScan = useRef<LastScan | null>(null);
  const router = useRouter();
  const { user } = useCurrentUser();

  useEffect(() => {
    if (!canScan(user)) router.push('/panel');
  }, [user, router]);

  const handleScan = async (result: any) => {
    if (!result || !result[0] || loading) return;
    const qrCode = result[0].rawValue;

    const now = Date.now();
    if (isRepeatedScan(qrCode, lastScan.current, now)) return;
    lastScan.current = { code: qrCode, at: now };

    setLoading(true);
    try {
      const response = await apiFetch('/tickets/check-in', {
        method: 'POST',
        body: JSON.stringify({ qrCode }),
      });

      const data = await response.json();
      if (response.ok) {
        setScanResult({
          success: data.success,
          status: data.status,
          message: data.message,
          event: data.event,
          type: data.type,
        });
      } else {
        setScanResult({
          success: false,
          status: 'INVALID',
          message: getApiErrorMessage(data, 'Error del servidor'),
        });
      }
    } catch (error) {
      setScanResult({
        success: false,
        status: 'INVALID',
        message: 'Error de conexión',
      });
    } finally {
      setLoading(false);
      // Auto dismiss after 3 seconds
      setTimeout(() => setScanResult(null), 3000);
    }
  };

  const getStyles = (status?: string) => {
    switch (status) {
      case 'VALID':
        return {
          bgDark: 'bg-emerald-950',
          border: 'border-emerald-500',
          shadow: 'shadow-emerald-500/50',
          bgSolid: 'bg-emerald-500/95',
          Icon: CheckCircle2,
        };
      case 'USED':
        return {
          bgDark: 'bg-amber-950',
          border: 'border-amber-500',
          shadow: 'shadow-amber-500/50',
          bgSolid: 'bg-amber-500/95',
          Icon: AlertTriangle,
        };
      case 'INVALID':
      case 'WRONG_EVENT':
      default:
        return {
          bgDark: 'bg-red-950',
          border: 'border-red-500',
          shadow: 'shadow-red-500/50',
          bgSolid: 'bg-red-500/95',
          Icon: XCircle,
        };
    }
  };

  const styles = scanResult ? getStyles(scanResult.status) : null;

  // Funciones de prueba para simular el escáner sin depender del flujo de la cámara o backend
  const simulateSuccess = () => {
    setScanResult({
      success: true,
      status: 'VALID',
      message: 'VÁLIDO',
      event: 'Fiesta de Primavera',
      type: 'General',
    });
    setTimeout(() => setScanResult(null), 3000);
  };

  const simulateError = () => {
    setScanResult({ success: false, status: 'INVALID', message: 'INVÁLIDO' });
    setTimeout(() => setScanResult(null), 3000);
  };

  const simulateUsed = () => {
    setScanResult({ success: false, status: 'USED', message: 'USADO' });
    setTimeout(() => setScanResult(null), 3000);
  };

  return (
    <div
      className={`min-h-[80vh] flex flex-col items-center justify-center transition-colors duration-500 ${
        scanResult ? styles!.bgDark : 'bg-transparent'
      }`}
    >
      <div className="max-w-md mx-auto w-full px-4 flex flex-col items-center relative z-10">
        <h1 className="font-outfit text-3xl font-bold mb-2 text-center text-white">
          Escáner de Accesos
        </h1>
        <p className="text-neutral-300 mb-8 text-center">
          Apuntá la cámara al código QR de la entrada
        </p>

        <div
          className={`relative w-full aspect-square rounded-3xl overflow-hidden border-4 shadow-2xl transition-all duration-300 ${
            scanResult
              ? `${styles!.border} ${styles!.shadow} scale-105`
              : 'border-white/10 bg-black'
          }`}
        >
          <Scanner
            onScan={handleScan}
            formats={['qr_code']}
            classNames={{ container: 'w-full h-full', video: 'object-cover' }}
          />

          {/* Overlay scanning effect */}
          {!scanResult && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <ScanLine
                className="w-48 h-48 text-white/30 animate-pulse"
                strokeWidth={1}
              />
            </div>
          )}

          {/* Flash Feedback Overlay */}
          {scanResult && styles && (
            <div
              className={`absolute inset-0 flex flex-col items-center justify-center animate-in fade-in zoom-in duration-300 text-white ${styles.bgSolid}`}
            >
              {styles.Icon && <styles.Icon className="w-32 h-32 mb-4" />}
              <h2 className="text-4xl font-black text-center px-4 tracking-tight leading-tight">
                {scanResult.message}
              </h2>
              {scanResult.event && (
                <p className="text-xl opacity-90 mt-4 text-center px-4 font-medium bg-black/20 py-2 rounded-full">
                  {scanResult.event} - {scanResult.type}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Testing Mode Buttons (development only) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-8 flex flex-col items-center w-full">
            <p className="text-xs text-neutral-500 uppercase tracking-widest font-bold mb-3">
              Modo Prueba (Simulación)
            </p>
            <div className="flex gap-2 w-full">
              <button
                onClick={simulateSuccess}
                className="flex-1 bg-emerald-900/30 hover:bg-emerald-800/50 text-emerald-400 border border-emerald-500/30 py-2 rounded-xl font-medium transition-all text-xs"
              >
                Válido
              </button>
              <button
                onClick={simulateUsed}
                className="flex-1 bg-amber-900/30 hover:bg-amber-800/50 text-amber-400 border border-amber-500/30 py-2 rounded-xl font-medium transition-all text-xs"
              >
                Usado
              </button>
              <button
                onClick={simulateError}
                className="flex-1 bg-red-900/30 hover:bg-red-800/50 text-red-400 border border-red-500/30 py-2 rounded-xl font-medium transition-all text-xs"
              >
                Inválido
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
