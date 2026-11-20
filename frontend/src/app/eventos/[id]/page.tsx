'use client';

import { useEffect, useRef, useState, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Ticket, CreditCard, Users, ArrowLeft } from 'lucide-react';
import toast from '@/utils/toast';
import CustomSelect from '@/components/CustomSelect';
import VenueMap from '@/components/events/VenueMap';
import DeleteEventModal from '@/components/events/DeleteEventModal';
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import { TURNSTILE_OPTIONS } from '@/utils/captcha';
import { apiFetch } from '@/utils/api';
import { getApiErrorMessage } from '@/utils/api-error';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useAutoRetry } from '@/hooks/useAutoRetry';
import BusyNotice, { type BusyKind } from '@/components/ui/BusyNotice';
import { isBusyStatus } from '@/utils/busy-retry';
import { optimizeCloudinaryUrl } from '@/utils/cloudinary';
import {
  formatCurrency,
  formatShortDateTime,
  formatWeekdayDateTime,
} from '@/utils/format';
import {
  MAX_TICKETS_PER_ORDER,
  calculateCheckoutTotals,
  updateCart,
} from '@/utils/checkout';

const getYouTubeEmbedUrl = (url: string) => {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11
    ? `https://www.youtube-nocookie.com/embed/${match[2]}?playsinline=1&rel=0`
    : null;
};

function EventContent() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useCurrentUser();
  const searchParams = useSearchParams();
  const rppFromUrl = searchParams.get('rpp');

  const [event, setEvent] = useState<any>(null);
  const [load, setLoad] = useState<'loading' | 'ready' | 'missing' | BusyKind>(
    'loading',
  );
  const { attempt, secondsLeft, schedule, succeeded, retryNow } =
    useAutoRetry();
  const [buying, setBuying] = useState(false);
  const [selectedRpp, setSelectedRpp] = useState<string>(rppFromUrl || '');
  const [cart, setCart] = useState<Record<string, number>>({});
  const [promoters, setPromoters] = useState<{ id: string; name: string }[]>(
    [],
  );
  const [captchaToken, setCaptchaToken] = useState<string>('');
  const turnstileRef = useRef<TurnstileInstance>(null);
  const [takingDown, setTakingDown] = useState(false);
  const [flyerRatio, setFlyerRatio] = useState<number | null>(null);

  // Cloudflare accepts each captcha token once: after a failed attempt the
  // widget solves a new one, and "Comprar" waits for it.
  const renewCaptcha = () => {
    setCaptchaToken('');
    turnstileRef.current?.reset();
  };

  // Too many people, a server error or no answer in time: a notice that tries
  // again by itself. Only a 404 (draft, finished or missing event) is "Evento
  // no encontrado". The promoters are optional: without them the page loads.
  useEffect(() => {
    let current = true;
    const loadEvent = async () => {
      try {
        const [res, promotersData] = await Promise.all([
          apiFetch(
            rppFromUrl ? `/events/${id}?rpp=${rppFromUrl}` : `/events/${id}`,
          ),
          apiFetch(`/events/${id}/promoters`)
            .then((r) => (r.ok ? r.json() : []))
            .catch(() => []),
        ]);
        if (!current) return;
        if (res.ok) {
          setEvent(await res.json());
          setPromoters(promotersData);
          setLoad('ready');
          succeeded();
        } else if (isBusyStatus(res.status) || res.status >= 500) {
          setLoad(isBusyStatus(res.status) ? 'busy' : 'failed');
          schedule(res.headers.get('Retry-After'));
        } else {
          setLoad('missing');
        }
      } catch {
        if (!current) return;
        setLoad('failed');
        schedule(null);
      }
    };
    void loadEvent();
    return () => {
      current = false;
    };
  }, [id, rppFromUrl, attempt, schedule, succeeded]);

  const handleQuantityChange = (
    ticketTypeId: string,
    delta: number,
    maxStock: number,
  ) => {
    setCart((prev) => updateCart(prev, ticketTypeId, delta, maxStock));
  };

  const initiateCheckout = async (email?: string) => {
    const items = Object.entries(cart).map(([ticketTypeId, quantity]) => ({
      ticketTypeId,
      quantity,
    }));
    if (items.length === 0)
      return toast.error('Seleccioná al menos una entrada');

    setBuying(true);
    try {
      const payload = {
        items,
        captchaToken,
        ...(selectedRpp && { promoterId: selectedRpp }),
      };

      const response = await apiFetch('/orders/checkout', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok && data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        toast.error(getApiErrorMessage(data, 'Error al iniciar el pago'));
        renewCaptcha();
        setBuying(false);
      }
    } catch (error) {
      console.error(error);
      toast.error('Error de conexión');
      renewCaptcha();
      setBuying(false);
    }
  };

  const handleBuy = () => {
    const items = Object.entries(cart).map(([ticketTypeId, quantity]) => ({
      ticketTypeId,
      quantity,
    }));
    if (items.length === 0)
      return toast.error('Seleccioná al menos una entrada');

    if (!user) {
      const currentUrl = encodeURIComponent(
        `${window.location.pathname}${window.location.search}`,
      );
      router.push(`/login?callbackUrl=${currentUrl}`);
    } else {
      initiateCheckout();
    }
  };

  if (load === 'loading')
    return <div className="text-center py-20">Cargando...</div>;
  if (load === 'busy' || load === 'failed')
    return (
      <BusyNotice
        kind={load}
        subject="el evento"
        secondsLeft={secondsLeft}
        onRetry={retryNow}
        className="px-4 pt-20 pb-24 md:pb-20"
      />
    );
  if (load === 'missing' || !event)
    return <div className="text-center py-20">Evento no encontrado</div>;

  const totals = calculateCheckoutTotals(
    (event.ticketBatches || []).flatMap((b: any) => b.ticketTypes || []),
    cart,
    event.buyerFeePercentage,
  );

  return (
    <div className="max-w-5xl mx-auto px-4 pt-6 pb-24 md:py-12">
      <button
        onClick={() => router.push('/eventos')}
        className="mb-6 flex items-center gap-2 text-neutral-400 hover:text-white transition-colors w-fit group"
      >
        <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
        <span className="font-medium text-sm md:text-base">Volver</span>
      </button>
      {user?.role === 'ADMIN' && (
        <>
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-red-500/5 border border-red-500/20 rounded-2xl p-4">
            <p className="text-sm text-neutral-300">
              Sos ADMIN de NeoPass: podés sacar este evento de la vista pública.
            </p>
            <button
              type="button"
              onClick={() => setTakingDown(true)}
              className="shrink-0 bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
            >
              Dar de baja
            </button>
          </div>
          <DeleteEventModal
            event={event}
            open={takingDown}
            onClose={() => setTakingDown(false)}
            onDeleted={() => {
              toast.success('Evento dado de baja');
              router.push('/eventos');
            }}
            asOrganizer={null}
          />
        </>
      )}
      <article className="bg-black/40 border border-white/10 rounded-2xl overflow-hidden">
        {/* El flyer entero y con su brillo. Mientras carga reserva el lugar
            con la proporción recomendada (16:9); si es otra, se acomoda una
            sola vez. Uno vertical se ve entero, con negro a los costados. */}
        {event.imageUrl && (
          <div
            className="bg-black"
            style={{ aspectRatio: flyerRatio ?? 16 / 9, maxHeight: '70vh' }}
          >
            <img
              src={optimizeCloudinaryUrl(event.imageUrl)}
              alt={event.title}
              onLoad={(e) => {
                const { naturalWidth, naturalHeight } = e.currentTarget;
                if (naturalWidth && naturalHeight)
                  setFlyerRatio(naturalWidth / naturalHeight);
              }}
              className="w-full h-full object-contain"
            />
          </div>
        )}

        {/* En el celular: datos, compra y después el resto. En PC la compra
            queda a la derecha y acompaña el scroll; la segunda fila es
            flexible para que una compra alta no separe los datos del resto. */}
        <div className="grid gap-10 p-5 md:p-8 lg:p-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:grid-rows-[auto_1fr] lg:gap-x-12 lg:items-start">
          <header className="min-w-0 lg:col-start-1 lg:row-start-1">
            <p
              className={`text-sm font-semibold mb-2 ${
                event.status === 'PUBLISHED'
                  ? 'text-emerald-400'
                  : 'text-neutral-400'
              }`}
            >
              {event.status === 'PUBLISHED'
                ? 'Entradas a la venta'
                : 'Próximamente'}
            </p>
            <h1 className="font-outfit text-3xl md:text-5xl font-bold leading-tight break-words">
              {event.title}
            </h1>
            {event.organizerName && (
              <p className="mt-2 text-neutral-400">
                Organiza {event.organizerName}
              </p>
            )}
            <dl className="mt-6 grid gap-4 sm:grid-cols-2 border-y border-white/10 py-5">
              <div>
                <dt className="text-sm text-neutral-500">Cuándo</dt>
                <dd className="mt-1 text-white">
                  {formatWeekdayDateTime(event.startDate)} hs
                  <span className="block text-neutral-400">
                    hasta el {formatWeekdayDateTime(event.endDate)} hs
                  </span>
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-sm text-neutral-500">Dónde</dt>
                <dd className="mt-1 text-white break-words">
                  {event.venueName}
                  <span className="block text-neutral-400">
                    {event.venueAddress}
                  </span>
                </dd>
              </div>
            </dl>
          </header>

          <section
            aria-labelledby="comprar-entradas"
            className="min-w-0 lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:sticky lg:top-24"
          >
            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 md:p-6">
              <h2
                id="comprar-entradas"
                className="font-bold text-xl mb-6 flex items-center gap-2"
              >
                <Ticket className="w-5 h-5 text-neutral-400" /> Comprar entradas
              </h2>

              {/* RRPP Selector */}
              <div className="mb-6 bg-black/40 p-4 rounded-xl border border-white/5">
                <label className="flex items-center gap-2 text-sm font-medium text-neutral-300 mb-2">
                  <Users className="w-4 h-4 text-neutral-400" />
                  Promotor (opcional)
                </label>
                <CustomSelect
                  value={selectedRpp}
                  onChange={setSelectedRpp}
                  disabled={!!rppFromUrl}
                  placeholder="Elegí un promotor..."
                  options={[
                    { value: '', label: '(Ninguno)' },
                    ...(rppFromUrl &&
                    !promoters.find((p) => p.id === rppFromUrl)
                      ? [
                          {
                            value: rppFromUrl,
                            label: 'Promotor del link',
                          },
                        ]
                      : []),
                    ...promoters.map((p) => ({ value: p.id, label: p.name })),
                  ]}
                />
                {rppFromUrl && (
                  <p className="text-[11px] text-emerald-400 mt-2 font-medium flex items-center gap-1">
                    ✓ Llegaste por el link de este promotor
                  </p>
                )}
              </div>

              <div className="space-y-4">
                {(() => {
                  // The API only sends upcoming, on sale and sold out batches.
                  const saleBatches = event.ticketBatches || [];

                  if (saleBatches.length === 0) {
                    return (
                      <div className="text-center text-neutral-500 py-4">
                        No hay entradas a la venta actualmente
                      </div>
                    );
                  }

                  return saleBatches.map((batch: any) => (
                    <div key={batch.id} className="mb-6 last:mb-0">
                      <h4 className="text-white font-bold mb-3 uppercase tracking-wide text-xs">
                        {batch.name}
                      </h4>
                      <div className="bg-black/40 border border-white/10 rounded-xl flex flex-col divide-y divide-white/5">
                        {batch.saleStatus === 'UPCOMING' && (
                          <div className="p-4 text-sm text-neutral-400">
                            Próximamente · desde{' '}
                            {formatShortDateTime(batch.publishAt)} hs
                          </div>
                        )}
                        {batch.saleStatus === 'SOLD_OUT' && (
                          <div className="p-4 text-sm font-medium text-amber-400">
                            Agotada
                          </div>
                        )}
                        {batch.saleStatus === 'ON_SALE' &&
                          batch.ticketTypes?.map((ticket: any) => {
                            const available: number = ticket.available;
                            const qty = cart[ticket.id] || 0;
                            return (
                              <div
                                key={ticket.id}
                                className="p-4 flex flex-col gap-3 hover:bg-white/[0.02] transition-colors first:rounded-t-xl last:rounded-b-xl"
                              >
                                <div className="flex justify-between items-start gap-4">
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium text-white break-words">
                                      {ticket.name}
                                    </div>
                                    <div className="text-xs text-neutral-500">
                                      Disponibles: {available}
                                    </div>
                                  </div>
                                  <div className="font-bold text-lg text-emerald-400 shrink-0">
                                    {formatCurrency(ticket.price)}
                                  </div>
                                </div>
                                <div className="flex items-center justify-between mt-1">
                                  <div className="text-sm font-medium text-neutral-400">
                                    Cantidad
                                  </div>
                                  <div className="flex items-center gap-3 bg-white/5 rounded-lg p-1">
                                    <button
                                      onClick={() =>
                                        handleQuantityChange(
                                          ticket.id,
                                          -1,
                                          available,
                                        )
                                      }
                                      className="w-8 h-8 flex items-center justify-center text-white hover:bg-white/10 rounded-md transition-colors disabled:opacity-50"
                                      disabled={qty <= 0}
                                    >
                                      -
                                    </button>
                                    <span className="w-6 text-center text-white font-bold">
                                      {qty}
                                    </span>
                                    <button
                                      onClick={() =>
                                        handleQuantityChange(
                                          ticket.id,
                                          1,
                                          available,
                                        )
                                      }
                                      className="w-8 h-8 flex items-center justify-center text-white hover:bg-white/10 rounded-md transition-colors disabled:opacity-50"
                                      disabled={
                                        qty >= available ||
                                        totals.tickets >= MAX_TICKETS_PER_ORDER
                                      }
                                    >
                                      +
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  ));
                })()}
              </div>

              {/* Checkout Button Global */}
              <div className="pt-4 mt-6 border-t border-white/10">
                <div className="space-y-2 mb-4">
                  {totals.tickets > 0 && (
                    <>
                      <div className="flex justify-between text-sm text-neutral-400">
                        <span>Subtotal</span>
                        <span>{formatCurrency(totals.subtotal)}</span>
                      </div>
                      <div className="flex justify-between text-sm text-neutral-400">
                        <span>Cargo de servicio</span>
                        <span>{formatCurrency(totals.serviceFee)}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-neutral-400">Total</span>
                    <span className="text-2xl font-bold text-emerald-400">
                      {formatCurrency(totals.total)}
                    </span>
                  </div>
                  {totals.tickets >= MAX_TICKETS_PER_ORDER && (
                    <p className="text-xs text-amber-400 text-right">
                      Podés comprar hasta {MAX_TICKETS_PER_ORDER} entradas por
                      orden.
                    </p>
                  )}
                </div>

                <div className="flex flex-col items-center md:items-end gap-4 w-full">
                  <div className="w-full flex justify-center md:justify-end relative z-50">
                    <Turnstile
                      ref={turnstileRef}
                      siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!}
                      onSuccess={(token) => setCaptchaToken(token)}
                      onError={() => setCaptchaToken('')}
                      options={TURNSTILE_OPTIONS}
                      className="w-full"
                    />
                  </div>

                  <button
                    onClick={handleBuy}
                    disabled={buying || totals.tickets === 0 || !captchaToken}
                    className="w-full md:w-auto lg:w-full px-8 bg-indigo-600 hover:bg-indigo-500 text-white py-3.5 rounded-xl font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {buying ? (
                      'Procesando...'
                    ) : (
                      <>
                        <CreditCard className="w-5 h-5" /> Comprar{' '}
                        {totals.tickets > 0 ? `(${totals.tickets})` : ''}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </section>

          <div className="min-w-0 space-y-8 lg:col-start-1 lg:row-start-2">
            <div>
              <h2 className="text-xl font-bold mb-4">Acerca del evento</h2>
              <p className="text-neutral-300 leading-relaxed whitespace-pre-wrap">
                {event.description}
              </p>
            </div>

            {event.youtubeLink && getYouTubeEmbedUrl(event.youtubeLink) && (
              <div className="w-full aspect-video relative z-30 rounded-xl overflow-hidden bg-black border border-white/10 isolate">
                <iframe
                  src={getYouTubeEmbedUrl(event.youtubeLink)!}
                  title="YouTube video player"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full border-0 outline-none"
                ></iframe>
              </div>
            )}

            <VenueMap
              latitude={event.latitude}
              longitude={event.longitude}
              venuePlaceId={event.venuePlaceId}
              venueName={event.venueName}
              venueAddress={event.venueAddress}
            />
          </div>
        </div>
      </article>
    </div>
  );
}

export default function EventoDetallePage() {
  return (
    <Suspense
      fallback={
        <div className="text-center py-20 text-white">Cargando evento...</div>
      }
    >
      <EventContent />
    </Suspense>
  );
}
