// Simula la respuesta de Turnstile (Cloudflare) al validar un captcha.
export function mockTurnstile(success: boolean) {
  jest
    .mocked(fetch)
    .mockResolvedValueOnce(new Response(JSON.stringify({ success })));
}
