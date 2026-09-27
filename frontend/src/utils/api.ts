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

  const response = await fetch(finalUrl, {
    cache: 'no-store',
    ...options,
    headers,
  });

  if (
    response.status === 401 &&
    !url.includes('/auth/login') &&
    !url.includes('/auth/register')
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
