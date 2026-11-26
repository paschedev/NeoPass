// Datos para Google (schema.org) en una etiqueta <script>. El < se escapa: el
// título y la descripción de un evento los escribe el organizador, y un
// "</script>" cerraría la etiqueta y dejaría inyectar código en la página.
export default function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, '\\u003c'),
      }}
    />
  );
}
