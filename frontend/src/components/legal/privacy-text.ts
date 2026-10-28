import type { LegalText } from './legal-text';

// Política de privacidad de NeoPass, versión 1, generada desde el documento "NeoPass -
// Textos legales". Un cambio de fondo es una versión nueva (utils/legal.ts).
export const PRIVACY_TEXT: LegalText = {
  intro: [
    {
      kind: 'paragraph',
      content: [
        'Usamos tus datos para que puedas comprar, recibir y usar tus entradas, y para que los organizadores puedan hacer sus eventos. No los vendemos ni los usamos para publicidad. Esta política cumple con la Ley 25.326 de Protección de los Datos Personales.',
      ],
    },
  ],
  sections: [
    {
      title: '1. Responsable',
      blocks: [
        {
          kind: 'paragraph',
          content: [
            'El responsable de la base de datos es Gaston Paschetta, CUIT 20-43060097-5, con domicilio en Pablo Colabianchi 735, Villa María (CP 5900), provincia de Córdoba. Contacto: ',
            { text: 'soporte@neopass.ar', href: 'mailto:soporte@neopass.ar' },
            '.',
          ],
        },
      ],
    },
    {
      title: '2. Qué datos guardamos',
      blocks: [
        {
          kind: 'list',
          items: [
            {
              content: [
                { text: 'Tu cuenta:', bold: true },
                ' nombre y apellido, correo, contraseña (guardada de forma irreversible), la versión de estos textos que aceptaste con su fecha y, si la subís, tu foto de perfil.',
              ],
            },
            {
              content: [
                { text: 'Si sos organizador:', bold: true },
                ' teléfono, nombre de tu productora y los datos de la cuenta de Mercado Pago que vinculás.',
              ],
            },
            {
              content: [
                { text: 'Tus compras:', bold: true },
                ' qué entradas compraste, para qué evento, cuánto pagaste y el estado del pago. Los datos de tu tarjeta los maneja Mercado Pago; NeoPass no los recibe ni los guarda.',
              ],
            },
            {
              content: [
                { text: 'Tus entradas:', bold: true },
                ' sus códigos, las transferencias que hiciste o recibiste y la fecha y hora en que se escanearon en la puerta.',
              ],
            },
            {
              content: [
                { text: 'Datos que otros cargan sobre vos:', bold: true },
                ' si un organizador te regala una entrada, guardamos el nombre y el correo que cargó. Si alguien te transfiere una entrada, queda registrada la transferencia.',
              ],
            },
            {
              content: [
                { text: 'Datos técnicos:', bold: true },
                ' tu dirección IP y datos de tu navegador, que usamos de forma transitoria para proteger la plataforma de abusos.',
              ],
            },
          ],
        },
        {
          kind: 'paragraph',
          content: [
            'Los datos que cada formulario marca como obligatorios son necesarios para usar NeoPass: sin ellos no podés crear tu cuenta, comprar ni vender. La foto de perfil es opcional. Si los datos son falsos o inexactos, puede que no podamos entregarte tus entradas ni atender tus pedidos.',
          ],
        },
      ],
    },
    {
      title: '3. Para qué los usamos',
      blocks: [
        {
          kind: 'list',
          items: [
            { content: ['Crear y administrar tu cuenta.'] },
            {
              content: [
                'Procesar tus compras, emitir tus entradas y enviártelas por correo.',
              ],
            },
            { content: ['Validar tus entradas en la puerta del evento.'] },
            {
              content: [
                'Enviarte los códigos para confirmar tu correo o recuperar tu contraseña, y avisos sobre tus entradas y eventos dentro de la plataforma.',
              ],
            },
            { content: ['Prevenir fraudes y usos indebidos.'] },
            {
              content: [
                'Cumplir obligaciones legales, contables e impositivas, y atender tus consultas.',
              ],
            },
          ],
        },
      ],
    },
    {
      title: '4. Con quién los compartimos',
      blocks: [
        {
          kind: 'list',
          items: [
            {
              content: [
                { text: 'El organizador del evento', bold: true },
                ' para el que comprás o recibís entradas recibe tu nombre, tu correo, tus entradas y tu ingreso. Los usa para organizar el evento, controlar el acceso y avisarte cambios, cancelaciones o devoluciones. Desde ese momento él también es responsable de esos datos, y solo puede enviarte publicidad si se lo autorizás.',
              ],
            },
            {
              content: [
                { text: 'El equipo del organizador', bold: true },
                ' (co-organizadores y personas que escanean entradas) accede a esos datos solo con los permisos que el organizador le da.',
              ],
            },
            {
              content: [
                { text: 'Proveedores', bold: true },
                ' que prestan servicios a NeoPass y solo usan tus datos para eso:',
              ],
            },
          ],
        },
        {
          kind: 'table',
          header: ['Proveedor', 'Para qué', 'Dónde'],
          rows: [
            ['Mercado Pago', 'Procesar los pagos', 'Argentina'],
            ['Neon', 'Base de datos', 'EE. UU.'],
            ['Railway', 'Servidores de la plataforma', 'EE. UU.'],
            ['Vercel', 'Sitio web', 'EE. UU.'],
            ['Resend', 'Envío de correos', 'EE. UU.'],
            ['Cloudinary', 'Fotos de perfil y flyers', 'EE. UU.'],
            [
              'Cloudflare',
              'Verificación contra bots y reenvío del correo de soporte',
              'EE. UU.',
            ],
            [
              'Google (Gmail)',
              'Bandeja donde leemos el correo de soporte',
              'EE. UU.',
            ],
          ],
        },
        {
          kind: 'list',
          items: [
            {
              content: [
                { text: 'Autoridades', bold: true },
                ', cuando una ley o una orden judicial lo exija.',
              ],
            },
          ],
        },
        {
          kind: 'list',
          items: [
            {
              content: [
                { text: 'Datos de organizadores y equipos:', bold: true },
                ' el nombre de la productora de cada organizador se muestra en sus eventos. Si formás parte del equipo de un organizador, él y sus co-organizadores ven tu nombre y tu correo.',
              ],
            },
          ],
        },
      ],
    },
    {
      title: '5. Transferencia internacional',
      blocks: [
        {
          kind: 'paragraph',
          content: [
            'Varios de esos proveedores guardan datos en Estados Unidos. Al aceptar esta política prestás tu consentimiento expreso para esa transferencia, en los términos del artículo 12 de la Ley 25.326 y su reglamentación. Elegimos proveedores que aplican medidas de seguridad reconocidas.',
          ],
        },
      ],
    },
    {
      title: '6. Cuánto tiempo los guardamos',
      blocks: [
        {
          kind: 'list',
          items: [
            { content: ['Mientras tu cuenta exista.'] },
            {
              content: [
                'Si pedís la baja, borramos o anonimizamos tus datos personales. Los registros de tus compras los conservamos hasta 10 años, por las obligaciones contables e impositivas.',
              ],
            },
          ],
        },
      ],
    },
    {
      title: '7. Cómo los protegemos',
      blocks: [
        {
          kind: 'list',
          items: [
            {
              content: [
                'Toda la comunicación con la plataforma viaja cifrada.',
              ],
            },
            {
              content: [
                'Las contraseñas se guardan de forma irreversible y las credenciales de Mercado Pago de los organizadores, cifradas.',
              ],
            },
            {
              content: [
                'Cada persona accede solo a sus propios datos, y los organizadores solo a los de sus eventos.',
              ],
            },
          ],
        },
      ],
    },
    {
      title: '8. Tus derechos',
      blocks: [
        {
          kind: 'list',
          items: [
            {
              content: [
                'Podés pedir acceso a tus datos, y que los corrijamos, actualicemos o borremos. También podés retirar tu consentimiento.',
              ],
            },
            {
              content: [
                'Tu nombre, tu foto y tu correo los podés cambiar desde Configuración. Para lo demás, escribinos a ',
                {
                  text: 'soporte@neopass.ar',
                  href: 'mailto:soporte@neopass.ar',
                },
                ' desde el correo de tu cuenta.',
              ],
            },
            {
              content: [
                'Respondemos los pedidos de acceso dentro de los 10 días corridos, y los de corrección o borrado dentro de los 5 días hábiles.',
              ],
            },
            {
              content: [
                'El titular de los datos personales tiene la facultad de ejercer el derecho de acceso a los mismos en forma gratuita a intervalos no inferiores a seis meses, salvo que se acredite un interés legítimo al efecto conforme lo establecido en el artículo 14, inciso 3 de la Ley Nº 25.326.',
              ],
            },
            {
              content: [
                'La AGENCIA DE ACCESO A LA INFORMACIÓN PÚBLICA, en su carácter de Órgano de Control de la Ley Nº 25.326, tiene la atribución de atender las denuncias y reclamos que interpongan quienes resulten afectados en sus derechos por incumplimiento de las normas vigentes en materia de protección de datos personales.',
              ],
            },
          ],
        },
      ],
    },
    {
      title: '9. Datos de otras personas',
      blocks: [
        {
          kind: 'paragraph',
          content: [
            'Si cargás datos de otra persona, por ejemplo el correo de alguien a quien le regalás o transferís una entrada, declarás que tenés su autorización para hacerlo.',
          ],
        },
      ],
    },
    {
      title: '10. Navegador y servicios de terceros',
      blocks: [
        {
          kind: 'list',
          items: [
            {
              content: [
                'En tu navegador guardamos solo tu sesión. No usamos cookies de publicidad ni de medición.',
              ],
            },
            {
              content: [
                'La verificación contra bots de Cloudflare, los videos de YouTube (en su modo de privacidad mejorada) y el pago con Mercado Pago pueden usar sus propias tecnologías, según sus políticas.',
              ],
            },
          ],
        },
      ],
    },
    {
      title: '11. Menores',
      blocks: [
        {
          kind: 'paragraph',
          content: [
            'Para tener una cuenta en NeoPass hay que tener 18 años o más. Si detectamos la cuenta de una persona menor, la cerramos. La edad mínima para asistir a cada evento la fija su organizador.',
          ],
        },
      ],
    },
    {
      title: '12. Cambios a esta política',
      blocks: [
        {
          kind: 'paragraph',
          content: [
            'Si la cambiamos, publicamos la versión nueva con su fecha y te avisamos al entrar a la plataforma.',
          ],
        },
      ],
    },
  ],
};
