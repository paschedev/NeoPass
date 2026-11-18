import { getGoogleClientId } from './google-sign-in';

// Borde con Google Identity Services: todo lo que habla con su script pasa
// por acá, y los tests simulan el componente que lo usa.

type ButtonText = 'continue_with' | 'signin_with' | 'signup_with';

type GoogleAccountsId = {
  initialize: (config: {
    client_id: string;
    callback: (response: { credential?: string }) => void;
    ux_mode: 'popup';
    auto_select: boolean;
    cancel_on_tap_outside: boolean;
    use_fedcm_for_button: boolean;
  }) => void;
  renderButton: (
    parent: HTMLElement,
    options: {
      type: 'standard';
      theme: 'filled_black';
      size: 'large';
      text: ButtonText;
      shape: 'pill';
      logo_alignment: 'center';
      width: number;
      locale: string;
    },
  ) => void;
};

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleAccountsId } };
  }
}

const SCRIPT_URL = 'https://accounts.google.com/gsi/client';

let loading: Promise<GoogleAccountsId> | null = null;

function loadScript(): Promise<GoogleAccountsId> {
  const ready = window.google?.accounts?.id;
  if (ready) return Promise.resolve(ready);
  loading ??= new Promise<GoogleAccountsId>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => {
      const id = window.google?.accounts?.id;
      if (id) resolve(id);
      else reject(new Error('Google Identity Services did not load'));
    };
    script.onerror = () => {
      // Un bloqueador o la red: el próximo botón lo vuelve a intentar.
      loading = null;
      script.remove();
      reject(new Error('Google Identity Services did not load'));
    };
    document.head.appendChild(script);
  });
  return loading;
}

// Google acepta una sola configuración por página: la credencial va al botón
// que se montó último (hay uno por pantalla).
let receiver: ((credential: string) => void) | null = null;
let initialized = false;

export async function renderGoogleButton(
  parent: HTMLElement,
  {
    text,
    width,
    onCredential,
  }: {
    text: ButtonText;
    width: number;
    onCredential: (credential: string) => void;
  },
): Promise<() => void> {
  const id = await loadScript();
  if (!initialized) {
    id.initialize({
      client_id: getGoogleClientId(),
      callback: ({ credential }) => {
        if (credential) receiver?.(credential);
      },
      ux_mode: 'popup',
      auto_select: false,
      cancel_on_tap_outside: true,
      use_fedcm_for_button: true,
    });
    initialized = true;
  }
  receiver = onCredential;
  id.renderButton(parent, {
    type: 'standard',
    theme: 'filled_black',
    size: 'large',
    text,
    shape: 'pill',
    logo_alignment: 'center',
    width: Math.round(Math.min(400, Math.max(200, width))),
    locale: 'es-419',
  });
  return () => {
    if (receiver === onCredential) receiver = null;
  };
}
