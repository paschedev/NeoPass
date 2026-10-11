// La marca en texto: "Neo" y "Pass" en el color de la marca. El tamaño y el
// color de "Neo" los pone quien la usa. La imagen para compartir
// (app/opengraph-image.tsx) la dibuja igual con sus estilos, porque no lee CSS.
export default function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`font-outfit font-black tracking-tighter ${className}`}>
      Neo<span className="text-brand-500">Pass</span>
    </span>
  );
}
