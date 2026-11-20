const LOAD_TIMEOUT_MS = 15_000;

export async function apiFetch(url: string, options: RequestInit = {}) {
  // Solo aplicar prefijo si la ruta empieza con '/' (relativa a nuestra API)
  const isRelativeUrl = url.startsWith('/');
  let baseUrl = process.env.NEXT_PUBLIC_API_URL;
  if (typeof window !== 'undefined') {
    if (!baseUrl) {
      baseUrl = `http://${window.location.hostname}:3001`;
    } else if (baseUrl.includes('localhost')) {
      baseUrl = baseUrl.replace('localhost', window.location.hostname);
    }
  } else if (!baseUrl) {
    baseUrl = 'http://localhost:3001';
  }

  const finalUrl = isRelativeUrl ? `${baseUrl}${url}` : url;

  const token =
    typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  const headers = new Headers(options.headers || {});

  // Inyectar Token de autorización si existe
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // Manejar Content-Type automáticamente si hay body y no es FormData
  if (
    options.body &&
    !(options.body instanceof FormData) &&
    !headers.has('Content-Type')
  ) {
    headers.set('Content-Type', 'application/json');
  }

  // A load that takes too long gives up, so the page can offer to try again
  // instead of "Cargando..." for minutes. Not a purchase or a scan: cutting
  // one would leave us not knowing whether it went through.
  const method = (options.method ?? 'GET').toUpperCase();
  const signal =
    options.signal ??
    (method === 'GET' ? AbortSignal.timeout(LOAD_TIMEOUT_MS) : undefined);

  const response = await fetch(finalUrl, {
    cache: 'no-store',
    ...options,
    signal,
    headers,
  });

  // En Ingresar, Registro y Google un 401 es un dato mal ingresado (o una
  // credencial de Google vencida), no una sesión vencida.
  if (
    response.status === 401 &&
    !url.includes('/auth/login') &&
    !url.includes('/auth/register') &&
    !url.includes('/auth/google')
  ) {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login?expired=1';
    }
    throw new Error('Unauthorized');
  }

  return response;
}
