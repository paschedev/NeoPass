import Link from 'next/link';

// Lo que se ve con un link que no existe o un evento que ya no está
// publicado (terminó, se canceló o se borró). Responde 404: así Google deja
// de mostrarlo.
export default function NotFound() {
  return (
    <div className="container mx-auto px-4 pt-20 pb-24 md:pb-12 flex flex-col items-center text-center">
      <p className="text-sm font-semibold text-indigo-400 mb-3">Error 404</p>
      <h1 className="font-outfit text-3xl md:text-5xl font-bold text-white">
        No encontramos esta página
      </h1>
      <p className="mt-4 max-w-md text-neutral-400">
        Puede que el evento ya haya terminado o que el link esté incompleto.
      </p>
      <div className="mt-8 flex flex-col sm:flex-row gap-3">
        <Link
          href="/eventos"
          className="bg-white text-black px-6 py-3 rounded-xl font-medium hover:bg-neutral-200 transition-colors"
        >
          Ver eventos
        </Link>
        <Link
          href="/"
          className="bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-xl font-medium transition-colors border border-white/10"
        >
          Ir al inicio
        </Link>
      </div>
    </div>
  );
}
