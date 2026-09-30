import hotToast, { type ToastOptions } from 'react-hot-toast';

// El texto hace de id: el mismo aviso repetido reemplaza al anterior en vez de apilarse.
// Un id explícito (el de un toast.loading) tiene prioridad.
const toast = {
  error: (message: string, options?: ToastOptions) =>
    hotToast.error(message, { id: message, ...options }),
  success: (message: string, options?: ToastOptions) =>
    hotToast.success(message, { id: message, ...options }),
  loading: (message: string, options?: ToastOptions) =>
    hotToast.loading(message, options),
};

export default toast;
