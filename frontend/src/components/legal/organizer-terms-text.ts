import type { LegalText } from './legal-text';

// Términos para organizadores de NeoPass, versión 1, generado desde el documento "NeoPass -
// Textos legales". Un cambio de fondo es una versión nueva (utils/legal.ts).
export const ORGANIZER_TERMS_TEXT: LegalText = {
  intro: [
    {
      kind: 'paragraph',
      content: [
        'Estos términos regulan la relación entre NeoPass y quien publica eventos y vende entradas en la plataforma (el "organizador"). Se suman a los ',
        { text: 'Términos de uso', href: '/terminos' },
        ' y los aceptás al registrarte como organizador.',
      ],
    },
  ],
  sections: [
    {
      title: '1. El servicio y el mandato',
      blocks: [
        {
          kind: 'list',
          items: [
            {
              content: [
                'NeoPass te permite publicar eventos, vender sus entradas, emitirlas y enviarlas con QR, validarlas en la puerta, sumar a tu equipo, regalar entradas y ver tus ventas y tu público.',
              ],
            },
            {
              content: [
                'NeoPass vende las entradas por tu cuenta y orden. Frente al público, el proveedor del evento sos vos.',
              ],
            },
          ],
        },
      ],
    },
    {
      title: '2. Requisitos',
      blocks: [
        {
          kind: 'list',
          items: [
            {
              content: [
                'Tenés que dar datos verdaderos y mantenerlos actualizados.',
              ],
            },
            {
              content: [
                'Para vender tenés que vincular una cuenta de Mercado Pago a tu nombre o al de tu productora, y mantenerla activa.',
              ],
            },
            {
              content: [
                'Declarás que tenés capacidad legal y las facultades necesarias para organizar cada evento que publicás.',
              ],
            },
          ],
        },
      ],
    },
    {
      title: '3. Tu responsabilidad por el evento',
      blocks: [
        {
          kind: 'list',
          items: [
            {
              content: [
                'Sos el único y exclusivo responsable de cada evento que publicás, en particular de:',
              ],
              items: [
                { content: ['realizarlo como lo anunciaste;'] },
                {
                  content: [
                    'las habilitaciones y permisos del lugar y de la actividad;',
                  ],
                },
                {
                  content: [
                    'la seguridad, los seguros y el respeto de la capacidad del lugar;',
                  ],
                },
                {
                  content: [
                    'los derechos de autor y de ejecución pública de la música (SADAIC, AADI-CAPIF u otras entidades);',
                  ],
                },
                {
                  content: [
                    'tus obligaciones laborales, impositivas y previsionales;',
                  ],
                },
                {
                  content: [
                    'la atención de las consultas y reclamos del público;',
                  ],
                },
                {
                  content: [
                    'los daños a personas o bienes relacionados con el evento.',
                  ],
                },
              ],
            },
            {
              content: [
                'La información del evento (fecha, hora, lugar, edad mínima y condiciones de acceso) tiene que ser veraz y completa, y tenés que mantenerla actualizada en la plataforma.',
              ],
            },
            {
              content: [
                'Declarás que tenés los derechos sobre los flyers, textos y videos que publicás. No podés publicar contenido ilegal, engañoso u ofensivo, y NeoPass puede quitarlo.',
              ],
            },
          ],
        },
      ],
    },
    {
      title: '4. Precios, cobro y cargo de servicio',
      blocks: [
        {
          kind: 'list',
          items: [
            {
              content: [
                'Vos fijás los precios, las tandas y la cantidad de entradas.',
              ],
            },
            {
              content: [
                'El cargo de servicio es del 12 % sobre el precio de las entradas, salvo que acordemos otro porcentaje por escrito. Lo paga el comprador, junto con su parte de la comisión de Mercado Pago.',
              ],
            },
            {
              content: [
                'Cada compra se paga con Mercado Pago y se divide en el momento: NeoPass recibe el cargo de servicio menos su parte de la comisión, y vos el resto del pago, del que Mercado Pago descuenta su comisión completa.',
              ],
            },
            {
              content: [
                'Así, la comisión de Mercado Pago se reparte en tres partes iguales entre el comprador, NeoPass y vos. Cada parte se calcula con la comisión real que Mercado Pago te cobra según el plazo de cobro que elegiste en tu cuenta. Hasta que una venta tuya la muestre, usamos la del cobro en el momento, que es la más alta.',
              ],
            },
            {
              content: [
                'Como se calcula con tu última comisión conocida, en una venta podés absorber un poco más o un poco menos que tu parte. Si absorbiste menos, la diferencia queda como saldo a favor de NeoPass y se descuenta de tus ventas siguientes, hasta el 10 % del valor de las entradas de cada venta. Si absorbiste más, la diferencia reduce ese saldo pero no se te devuelve.',
              ],
            },
            {
              content: [
                'En tus ventas ves lo que se descontó por este ajuste, y te avisamos en la plataforma cuando cambia tu plazo de cobro.',
              ],
            },
            {
              content: [
                'Si ofrecés cuotas sin interés, su costo es tuyo y no entra en este reparto. Un evento sin cargo de servicio no tiene reparto: la comisión de Mercado Pago queda toda a tu cargo.',
              ],
            },
            {
              content: [
                'Las retenciones impositivas sobre tu cobro son a tu cargo.',
              ],
            },
            {
              content: [
                'Los contracargos, desconocimientos de compra y devoluciones que Mercado Pago debite de tu cuenta también son a tu cargo.',
              ],
            },
            {
              content: [
                'Vos facturás las entradas al público y NeoPass factura su cargo de servicio.',
              ],
            },
          ],
        },
      ],
    },
    {
      title: '5. Cancelación, suspensión y cambios del evento',
      blocks: [
        {
          kind: 'list',
          items: [
            {
              content: [
                'Si cancelás o suspendés un evento, o cambiás su fecha, hora o lugar, tenés que cargarlo en la plataforma lo antes posible para que el público reciba el aviso.',
              ],
            },
            {
              content: [
                'Si cancelás o suspendés un evento sin nueva fecha, tenés que devolver el precio a quien lo pida. Podés ofrecer además alternativas, como entradas para otra fecha u otro evento, que el público puede aceptar o no. Si cambiás la fecha, la hora o el lugar, las entradas valen para la nueva fecha y tenés que devolver el precio a quien no pueda o no quiera asistir y lo pida. Lo que ofrezcas tenés que comunicarlo con claridad y cumplirlo.',
              ],
            },
            {
              content: [
                'Las devoluciones las hacés por tus propios medios. NeoPass no devuelve el precio, que nunca recibió, ni el cargo de servicio, que retribuye un servicio ya prestado.',
              ],
            },
          ],
        },
      ],
    },
    {
      title: '6. Arrepentimiento',
      blocks: [
        {
          kind: 'list',
          items: [
            {
              content: [
                'El público puede arrepentirse de su compra según la cláusula 9 de los Términos de uso: dentro de los 10 días corridos desde la compra y hasta 48 horas antes del evento.',
              ],
            },
            {
              content: [
                'Si alguien lo pide, te avisamos con su nombre, su correo y el monto.',
              ],
            },
            {
              content: [
                'Tenés que devolverle el total pagado dentro de los 5 días corridos, y siempre antes del inicio del evento, con una devolución total desde Mercado Pago. Al hacerla, las entradas de esa compra se anulan y el lugar vuelve a quedar disponible para la venta. La parte del cargo de servicio la asume NeoPass.',
              ],
            },
            {
              content: [
                'Si no devolvés en ese plazo, NeoPass puede pausar la venta de tus eventos y suspender tu cuenta hasta que lo resuelvas.',
              ],
            },
          ],
        },
      ],
    },
    {
      title: '7. Datos del público',
      blocks: [
        {
          kind: 'list',
          items: [
            {
              content: [
                'Recibís el nombre y el correo de quienes compran o reciben entradas para tu evento, y los datos de su ingreso.',
              ],
            },
            {
              content: [
                'Solo podés usarlos para organizar el evento, controlar el acceso y comunicar cambios, cancelaciones y devoluciones. Para enviar publicidad necesitás el consentimiento expreso de cada persona, que obtenés vos.',
              ],
            },
            {
              content: [
                'Respecto de esos datos sos responsable según la Ley 25.326: tenés que protegerlos, no cederlos ni venderlos, borrarlos cuando ya no los necesites y atender los pedidos de acceso, rectificación y supresión que te hagan.',
              ],
            },
            {
              content: [
                'Cada descarga de la lista del público queda registrada en el historial del evento.',
              ],
            },
          ],
        },
      ],
    },
    {
      title: '8. Tu equipo',
      blocks: [
        {
          kind: 'list',
          items: [
            {
              content: [
                'Los co-organizadores, RRPP y personas que escanean entradas los sumás vos, con los permisos que les des, y actúan bajo tu responsabilidad.',
              ],
            },
            {
              content: [
                'Las comisiones de los RRPP las pactás y pagás vos. NeoPass solo te ayuda a registrarlas.',
              ],
            },
          ],
        },
      ],
    },
    {
      title: '9. Suspensión de eventos y cuentas',
      blocks: [
        {
          kind: 'list',
          items: [
            {
              content: [
                'NeoPass puede pausar la venta, ocultar o dar de baja un evento, o suspender tu cuenta, si hay información falsa o engañosa, contenido ilegal, indicios de fraude, reclamos reiterados del público, devoluciones incumplidas o cualquier otro incumplimiento de estos términos.',
              ],
            },
            {
              content: [
                'Te vamos a avisar y, cuando sea posible, te vamos a dar la oportunidad de corregirlo antes.',
              ],
            },
          ],
        },
      ],
    },
    {
      title: '10. Indemnidad',
      blocks: [
        {
          kind: 'list',
          items: [
            {
              content: [
                'Te comprometés a mantener indemne a NeoPass y a sus titulares frente a cualquier reclamo, multa, sanción o condena, incluidos honorarios y costas, que se origine en tu evento, en tu incumplimiento de estos términos o de la ley, o en el uso que hagas de los datos del público. Esto incluye cualquier devolución del cargo de servicio que una autoridad o un juez le ordene a NeoPass por la cancelación, la suspensión o el cambio de tu evento.',
              ],
            },
            {
              content: [
                'Si un comprador o una autoridad le reclama a NeoPass algo que te corresponde, tenés que colaborar con la respuesta y reintegrarle a NeoPass lo que deba pagar por ese motivo.',
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
                'NeoPass responde por el funcionamiento de la plataforma y no garantiza una cantidad de ventas.',
              ],
            },
            {
              content: [
                'Puede haber interrupciones por mantenimiento o por fallas de terceros, como Mercado Pago o los servidores.',
              ],
            },
            {
              content: [
                'Frente a vos, la responsabilidad de NeoPass por fallas de la plataforma se limita al cargo de servicio cobrado en el evento afectado, salvo dolo o culpa grave de NeoPass.',
              ],
            },
          ],
        },
      ],
    },
    {
      title: '12. Duración y baja',
      blocks: [
        {
          kind: 'list',
          items: [
            { content: ['Podés dejar de usar NeoPass cuando quieras.'] },
            {
              content: [
                'Si tenés eventos con entradas vendidas, tus obligaciones con el público siguen hasta que esos eventos terminen y resuelvas sus devoluciones.',
              ],
            },
          ],
        },
      ],
    },
    {
      title: '13. Cambios, ley aplicable y jurisdicción',
      blocks: [
        {
          kind: 'list',
          items: [
            {
              content: [
                'Si cambiamos estos términos, te avisamos y vas a tener que aceptar la versión nueva para seguir publicando y vendiendo.',
              ],
            },
            {
              content: [
                'Se rigen por las leyes de la República Argentina. Ante un conflicto entre vos y NeoPass, serán competentes los tribunales ordinarios de la ciudad de Villa María, provincia de Córdoba.',
              ],
            },
          ],
        },
      ],
    },
    {
      title: '14. Notificaciones y relación entre las partes',
      blocks: [
        {
          kind: 'list',
          items: [
            {
              content: [
                'Las comunicaciones al correo de tu cuenta y las que recibís dentro de la plataforma son válidas.',
              ],
            },
            {
              content: [
                'Vos y NeoPass son partes independientes: más allá del mandato para vender tus entradas, no existe entre las partes una sociedad ni una relación laboral.',
              ],
            },
            {
              content: [
                'NeoPass puede ceder estos términos a una sociedad que constituyan sus titulares. Te vamos a avisar antes.',
              ],
            },
          ],
        },
      ],
    },
  ],
};
