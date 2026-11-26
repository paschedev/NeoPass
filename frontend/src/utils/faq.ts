// Las preguntas frecuentes. Las usan su página, su ficha para Google y la
// guía para buscadores con IA (/llms.txt). Cada respuesta sale de los términos
// o del documento de ventas: si cambia una regla, se cambia acá y en el texto
// legal a la vez.

export type FaqItem = { question: string; answer: string };
export type FaqSection = { id: string; title: string; items: FaqItem[] };

export const FAQ_SECTIONS: FaqSection[] = [
  {
    id: 'compras',
    title: 'Si comprás entradas',
    items: [
      {
        question: '¿Cómo recibo mis entradas?',
        answer:
          'Cada entrada tiene un código QR único. Te llega por correo y también la encontrás en «Mis entradas». El QR entra una sola vez: no compartas fotos ni capturas.',
      },
      {
        question: '¿Puedo pasarle mi entrada a otra persona?',
        answer:
          'Sí. La transferís a alguien con cuenta en NeoPass mientras el evento no haya terminado ni se haya cancelado. La entrada recibe un QR nuevo y el anterior deja de servir.',
      },
      {
        question: '¿Cuántas entradas puedo comprar?',
        answer:
          'Hasta 10 por compra. Al empezar la compra te las reservamos 10 minutos para que completes el pago.',
      },
      {
        question: '¿Cómo pago?',
        answer:
          'Con Mercado Pago. La compra se confirma cuando Mercado Pago aprueba el pago, y ahí te llegan las entradas.',
      },
      {
        question: '¿Qué es el cargo de servicio?',
        answer:
          'Es un porcentaje sobre el precio que cubre el servicio de venta de NeoPass y una parte de la comisión de Mercado Pago. Lo ves antes de pagar, junto al precio y el total.',
      },
      {
        question: '¿Qué pasa si se cancela el evento?',
        answer:
          'Si se cancela o se suspende sin nueva fecha, el organizador te devuelve el precio de tus entradas si se lo pedís. Si cambia la fecha, el horario o el lugar, tus entradas valen igual, y si no podés ir le podés pedir la devolución. En estos casos el cargo de servicio no se devuelve.',
      },
      {
        question: '¿Me puedo arrepentir de la compra?',
        answer:
          'Sí. Tenés 10 días corridos desde la compra, hasta 48 horas antes del evento. Lo pedís con el botón de arrepentimiento, al pie de la página de inicio, o escribiendo a soporte@neopass.ar. Se devuelve la compra completa, cargo de servicio incluido, si ninguna entrada se transfirió ni se usó.',
      },
    ],
  },
  {
    id: 'organizadores',
    title: 'Si organizás eventos',
    items: [
      {
        question: '¿Cuánto cuesta usar NeoPass?',
        answer:
          'Sin abono ni costo de alta. El cargo de servicio lo paga quien compra.',
      },
      {
        question: '¿Cuándo y cómo cobro?',
        answer:
          'La plata de cada venta entra directo en tu cuenta de Mercado Pago: NeoPass no la retiene. El plazo lo elegís en tu cuenta de Mercado Pago, y cuanto antes cobrás, más cobra Mercado Pago por venta. Ese costo se reparte a medias entre quien compra y vos.',
      },
      {
        question: '¿Cómo funcionan los RRPP?',
        answer:
          'Cada RRPP vende con su link y vos ves cuánto vendió y cuánto le debés. La comisión puede ser un porcentaje o un monto fijo, registrás cada pago y el saldo queda al día. Si querés, le das QR free con un tope.',
      },
      {
        question: '¿Puedo sumar a mi equipo?',
        answer:
          'Sí. Sumás co-organizadores y elegís qué puede hacer cada uno: ventas, tandas, QR free, público o staff. Cobrar, publicar y cancelar es solo tuyo, y cada cambio queda con nombre y hora.',
      },
      {
        question: '¿Cómo controlo la puerta?',
        answer:
          'Invitás scanners y tu staff escanea las entradas con su celular, sin instalar nada. El mismo QR no entra dos veces y ves el ingreso en vivo durante el evento.',
      },
      {
        question: '¿Cómo empiezo?',
        answer:
          'Creás tu cuenta y son tres pasos: vinculás tu Mercado Pago, creás tu evento con flyer, lugar y tandas, y sumás a tu equipo con RRPP, scanners y co-organizadores.',
      },
    ],
  },
];
