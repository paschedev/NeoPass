import type { LegalText } from './legal-text';

// Términos de uso de NeoPass, versión 1, generado desde el documento "NeoPass -
// Textos legales". Un cambio de fondo es una versión nueva (utils/legal.ts).
export const TERMS_TEXT: LegalText = {
  intro: [
    {
      kind: 'paragraph',
      content: [
        'Estos términos regulan el uso de NeoPass y la compra de entradas a través de la plataforma. Al crear una cuenta los aceptás, junto con la ',
        { text: 'Política de privacidad', href: '/privacidad' },
        '.',
      ],
    },
  ],
  sections: [
    {
      title: '1. Quiénes somos',
      blocks: [
        {
          kind: 'paragraph',
          content: [
            'NeoPass es una plataforma operada por Gaston Paschetta, CUIT 20-43060097-5, Responsable Monotributo, con domicilio en Pablo Colabianchi 735, Villa María (CP 5900), provincia de Córdoba (en adelante, "NeoPass"). Podés escribirnos a ',
            { text: 'soporte@neopass.ar', href: 'mailto:soporte@neopass.ar' },
            '. Si NeoPass pasa a ser operada por una sociedad, lo vamos a informar con una versión nueva de estos términos.',
          ],
        },
      ],
    },
    {
      title: '2. Qué hace NeoPass',
      blocks: [
        {
          kind: 'list',
          items: [
            {
              content: [
                'NeoPass es una plataforma donde organizadores de eventos (productoras, personas o locales) publican sus eventos y venden sus entradas.',
              ],
            },
            {
              content: [
                'NeoPass vende las entradas por cuenta y orden del organizador de cada evento. No organiza, no produce ni realiza los eventos, y no es dueña ni administradora de los lugares donde se hacen.',
              ],
            },
            {
              content: [
                'En la página de cada evento figura quién lo organiza. Ese organizador es quien realiza el evento y responde por él.',
              ],
            },
            {
              content: [
                'Los pagos se hacen con Mercado Pago y se dividen en el momento: el precio de la entrada va a la cuenta del organizador, y el cargo de servicio cubre el servicio de NeoPass y una parte de la comisión de Mercado Pago. NeoPass no recibe el precio de las entradas.',
              ],
            },
          ],
        },
      ],
    },
    {
      title: '3. Aceptación y cambios a estos términos',
      blocks: [
        {
          kind: 'list',
          items: [
            {
              content: [
                'Si no estás de acuerdo con estos términos, no uses la plataforma.',
              ],
            },
            {
              content: [
                'Si los cambiamos, publicamos la versión nueva con su fecha y te avisamos al entrar. Para seguir comprando vas a tener que aceptarla. Si no la aceptás, podés pedir la baja de tu cuenta sin costo.',
              ],
            },
            {
              content: [
                'Cada compra se rige por la versión vigente en el momento en que la hiciste.',
              ],
            },
          ],
        },
      ],
    },
    {
      title: '4. Tu cuenta',
      blocks: [
        {
          kind: 'list',
          items: [
            {
              content: [
                'Tenés que dar datos verdaderos y mantenerlos actualizados. Cada cuenta es personal.',
              ],
            },
            {
              content: [
                'Sos responsable de cuidar tu contraseña. Si creés que alguien entró a tu cuenta, cambiala y avisanos.',
              ],
            },
            {
              content: [
                'Para crear una cuenta y comprar entradas tenés que tener 18 años o más. La edad mínima para asistir a cada evento la fija y la controla su organizador.',
              ],
            },
            {
              content: [
                'Podemos suspender o cerrar cuentas que incumplan estos términos.',
              ],
            },
          ],
        },
      ],
    },
    {
      title: '5. La compra',
      blocks: [
        {
          kind: 'list',
          items: [
            {
              content: [
                'Antes de pagar ves el evento, el tipo de entrada, el precio, el cargo de servicio y el total.',
              ],
            },
            {
              content: [
                'El cargo de servicio es un porcentaje sobre el precio que retribuye el servicio de venta de NeoPass e incluye una parte de la comisión de Mercado Pago. Se devuelve si te arrepentís de la compra (cláusula 9) o si la compra falla por un error de NeoPass. En los demás casos no se devuelve.',
              ],
            },
            { content: ['Podés comprar hasta 10 entradas por vez.'] },
            {
              content: [
                'Cuando empezás una compra, reservamos las entradas por 10 minutos. Si no completás el pago en ese tiempo, quedan libres para otras personas.',
              ],
            },
            {
              content: [
                'La compra se confirma cuando Mercado Pago aprueba el pago. Mercado Pago o el emisor de tu tarjeta pueden rechazarlo o anularlo por seguridad, y NeoPass no interviene en esa decisión. El pago se rige también por los términos de Mercado Pago.',
              ],
            },
            {
              content: [
                'Los precios los fija el organizador y pueden variar entre tandas.',
              ],
            },
            {
              content: [
                'Revisá tu compra antes de pagar: no hacemos cambios por errores de quien compra (de evento, tipo de entrada o cantidad), sin perjuicio de tu derecho de arrepentimiento.',
              ],
            },
          ],
        },
      ],
    },
    {
      title: '6. Tus entradas',
      blocks: [
        {
          kind: 'list',
          items: [
            {
              content: [
                'Cada entrada tiene un código QR único. Te llega por correo y la encontrás en "Mis entradas".',
              ],
            },
            {
              content: [
                'El QR es la entrada: en la puerta entra el primero que lo presenta, y después ese QR deja de servir. No compartas fotos ni capturas de tus entradas. NeoPass no repone entradas que usó otra persona con tu QR.',
              ],
            },
            {
              content: [
                'Podés transferir una entrada a otra persona con cuenta en NeoPass mientras el evento no haya terminado ni se haya cancelado. Al transferirla, la entrada recibe un QR nuevo y el anterior deja de servir.',
              ],
            },
            {
              content: [
                'El organizador puede regalar entradas sin cargo. Pueden tener una hora límite de ingreso y siguen las mismas reglas.',
              ],
            },
            {
              content: [
                'Las entradas son para uso personal o para regalar con la transferencia. Está prohibido revenderlas o usarlas con fines comerciales o de promoción sin autorización del organizador. El organizador puede negar el ingreso con entradas revendidas.',
              ],
            },
          ],
        },
      ],
    },
    {
      title: '7. El evento y el organizador',
      blocks: [
        {
          kind: 'list',
          items: [
            {
              content: [
                'El organizador es quien organiza y realiza el evento, y responde en particular por:',
              ],
              items: [
                {
                  content: [
                    'realizarlo como lo anunció: fecha, hora, lugar, artistas y programa;',
                  ],
                },
                {
                  content: [
                    'las habilitaciones, los permisos y la seguridad del lugar;',
                  ],
                },
                {
                  content: [
                    'las condiciones de acceso: derecho de admisión y permanencia, edad mínima y objetos prohibidos;',
                  ],
                },
                {
                  content: [
                    'todo lo que ocurra en el lugar durante el evento.',
                  ],
                },
              ],
            },
            {
              content: [
                'La información de cada evento la carga su organizador. NeoPass no la verifica ni garantiza que el evento se realice.',
              ],
            },
            {
              content: [
                'Las consultas sobre un evento las responde su organizador. Si no lográs contactarlo, escribinos y te ayudamos.',
              ],
            },
          ],
        },
      ],
    },
    {
      title: '8. Cancelación, suspensión o cambios del evento',
      blocks: [
        {
          kind: 'list',
          items: [
            {
              content: [
                'Si un evento se cancela o se suspende sin nueva fecha, el organizador tiene que devolverte el precio de tus entradas si se lo pedís. También puede ofrecerte otra alternativa, como entradas para otra fecha u otro evento, que podés aceptar o no. Si el evento cambia de fecha, hora o lugar, tus entradas valen para la nueva fecha; si no podés o no querés ir, podés pedirle al organizador la devolución del precio.',
              ],
            },
            {
              content: [
                'Las devoluciones del precio las hace el organizador por sus propios medios, porque es quien recibió ese dinero.',
              ],
            },
            {
              content: [
                'El cargo de servicio no se devuelve en estos casos, porque retribuye un servicio que NeoPass ya prestó: procesar la compra, emitir y enviar las entradas y validarlas en la puerta.',
              ],
            },
            {
              content: [
                'NeoPass te avisa en la plataforma los cambios que el organizador cargue en su evento.',
              ],
            },
          ],
        },
      ],
    },
    {
      title: '9. Botón de arrepentimiento',
      blocks: [
        {
          kind: 'list',
          items: [
            {
              content: [
                'Podés revocar tu compra dentro de los 10 días corridos desde que la hiciste, sin dar motivos y sin costo (art. 34 de la Ley 24.240, art. 1110 del Código Civil y Comercial y Resolución 424/2020). Este derecho no se puede renunciar.',
              ],
            },
            {
              content: [
                'Lo pedís desde el "Botón de arrepentimiento", al pie de la página de inicio, o escribiendo a ',
                {
                  text: 'soporte@neopass.ar',
                  href: 'mailto:soporte@neopass.ar',
                },
                '. No necesitás iniciar sesión: escribinos desde el correo con el que compraste e indicá el evento.',
              ],
            },
            {
              content: ['Condiciones:'],
              items: [
                {
                  content: [
                    'el pedido se hace hasta 48 horas antes del inicio del evento, aunque no hayan pasado los 10 días;',
                  ],
                },
                {
                  content: [
                    'se revoca la compra completa, con todas sus entradas;',
                  ],
                },
                {
                  content: [
                    'ninguna entrada de la compra puede haberse transferido ni usado;',
                  ],
                },
                {
                  content: [
                    'no aplica a entradas regaladas, porque no tuvieron costo.',
                  ],
                },
              ],
            },
            {
              content: [
                'Dentro de las 24 horas te enviamos por correo el código de tu pedido y le avisamos al organizador.',
              ],
            },
            {
              content: [
                'El organizador te devuelve el total pagado, incluido el cargo de servicio, por el mismo medio de pago, dentro de los 5 días corridos y antes del inicio del evento. Cuando hace la devolución, las entradas de esa compra se anulan y sus QR dejan de servir. Según tu banco o tarjeta, el dinero puede tardar más en verse reflejado.',
              ],
            },
            {
              content: [
                'Si la devolución no llega en ese plazo, escribinos a ',
                {
                  text: 'soporte@neopass.ar',
                  href: 'mailto:soporte@neopass.ar',
                },
                ' con el código de tu pedido.',
              ],
            },
          ],
        },
      ],
    },
    {
      title: '10. Uso permitido',
      blocks: [
        {
          kind: 'list',
          items: [
            {
              content: ['No está permitido:'],
              items: [
                { content: ['comprar con programas automáticos o bots;'] },
                {
                  content: [
                    'crear cuentas falsas o usar medios de pago ajenos;',
                  ],
                },
                {
                  content: [
                    'intentar acceder a datos de otras personas o vulnerar la seguridad de la plataforma;',
                  ],
                },
                {
                  content: [
                    'sobrecargar o interferir con el funcionamiento del sitio;',
                  ],
                },
                { content: ['copiar el contenido o el software de NeoPass.'] },
              ],
            },
            {
              content: [
                'Si detectamos alguna de estas conductas, podemos suspender la cuenta, anular las compras hechas con fraude e iniciar las acciones legales que correspondan.',
              ],
            },
          ],
        },
      ],
    },
    {
      title: '11. Responsabilidad de NeoPass',
      blocks: [
        {
          kind: 'list',
          items: [
            {
              content: [
                'NeoPass responde por el funcionamiento de la plataforma: procesar las compras, emitir y enviar las entradas y permitir validarlas en la puerta.',
              ],
            },
            {
              content: [
                'Trabajamos para que la plataforma esté siempre disponible, pero puede haber interrupciones por mantenimiento o por fallas de servicios de terceros (servidores, conexión a internet, Mercado Pago). Te recomendamos guardar el correo con tus entradas, que sirve aunque no tengas conexión en la puerta.',
              ],
            },
            {
              content: [
                'NeoPass no responde por lo que corresponde al organizador según las cláusulas 7 y 8, ni por los servicios de terceros.',
              ],
            },
            {
              content: [
                'Nada en estos términos limita los derechos que te reconoce la Ley 24.240 de Defensa del Consumidor.',
              ],
            },
          ],
        },
      ],
    },
    {
      title: '12. Propiedad intelectual',
      blocks: [
        {
          kind: 'list',
          items: [
            {
              content: [
                'El nombre NeoPass, su logo, su diseño y su software pertenecen a sus titulares y no pueden usarse sin autorización.',
              ],
            },
            {
              content: [
                'Los flyers, textos y videos de cada evento pertenecen a su organizador o a quien corresponda.',
              ],
            },
          ],
        },
      ],
    },
    {
      title: '13. Servicios de terceros',
      blocks: [
        {
          kind: 'paragraph',
          content: [
            'La plataforma usa o enlaza servicios de terceros, como Mercado Pago, YouTube e Instagram. Cada uno se rige por sus propios términos y políticas.',
          ],
        },
      ],
    },
    {
      title: '14. Datos personales',
      blocks: [
        {
          kind: 'paragraph',
          content: [
            'Cómo tratamos tus datos está explicado en la Política de privacidad, que forma parte de estos términos.',
          ],
        },
      ],
    },
    {
      title: '15. Ley aplicable, reclamos y contacto',
      blocks: [
        {
          kind: 'list',
          items: [
            {
              content: [
                'Estos términos se rigen por las leyes de la República Argentina. Ante un conflicto, serán competentes los tribunales que correspondan según la Ley 24.240.',
              ],
            },
            {
              content: [
                'Para cualquier consulta o reclamo, escribinos a ',
                {
                  text: 'soporte@neopass.ar',
                  href: 'mailto:soporte@neopass.ar',
                },
                '.',
              ],
            },
            {
              content: [
                'También podés hacer tu reclamo ante la autoridad de defensa del consumidor desde el enlace "Defensa de las y los Consumidores. Para reclamos ingrese aquí", al pie de la página de inicio.',
              ],
            },
          ],
        },
      ],
    },
  ],
};
