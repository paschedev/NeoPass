# NeoPass

> Plataforma Full-Stack integral para la gestión de eventos, venta de entradas y validación de accesos mediante código QR.

NeoPass es un sistema en producción diseñado para facilitar la administración completa de eventos, abarcando desde la creación y venta de tickets hasta el control de acceso en puerta, ofreciendo una experiencia segura y fluida tanto para organizadores como para asistentes.

🌍 **Sitio Web Oficial:** [NeoPass.ar](https://www.neopass.ar)

---

## 🚀 Arquitectura y Stack Tecnológico

El proyecto está construido bajo una arquitectura de monorepo, asegurando una integración robusta, mantenible y altamente escalable entre las interfaces de usuario y los servicios core del sistema.

### Frontend (Cliente Web)
- **Frameworks:** Next.js 16, React 19
- **Estilos y UI:** TailwindCSS v4, Framer Motion
- **Enfoque:** Aplicación web optimizada (mobile-first) para asistentes, red de promotores (RRPP) y personal de control de accesos (escáner).

### Backend (API REST)
- **Framework:** NestJS 11
- **Base de Datos & Caché:** PostgreSQL, Redis
- **ORM:** Prisma ORM
- **Autenticación y Seguridad:** JWT, Passport
- **Procesamiento Asíncrono:** BullMQ (Gestión de colas de tareas)

### Integraciones de Terceros
- **Pasarela de Pagos:** MercadoPago (Procesamiento de transacciones seguras)
- **Comunicaciones:** Resend (Envío de emails transaccionales y tickets)

---

## 🧩 Módulos y Funcionalidades Principales

El ecosistema de NeoPass se compone de diversos módulos clave que cubren todo el ciclo de vida operativo de los eventos:

1. **Gestión de Eventos:**
   - Creación, configuración y administración integral de eventos.
   - Definición de capacidades, fechas, ubicaciones y control de estados (publicado, pausado, finalizado).

2. **Sistema de Tickets y Entradas:**
   - Creación de múltiples categorías o lotes de tickets con precios dinámicos.
   - Control estricto de stock.
   - Generación algorítmica de códigos QR únicos y seguros por cada entrada.

3. **Checkout y Órdenes de Compra:**
   - Flujo de compra optimizado para minimizar el abandono del carrito.
   - Integración nativa con MercadoPago.
   - Registro transaccional de órdenes, permitiendo seguimiento de pagos aprobados, pendientes o rechazados.

4. **Control de Accesos (Escaneo QR):**
   - Módulo web dedicado para el personal de puerta o seguridad.
   - Validación de entradas en tiempo real para evitar fraudes, duplicaciones o ingresos no autorizados.
   - Panel de estadísticas de ingreso en vivo.

5. **Panel de Administración y RRPP:**
   - Dashboards analíticos para organizadores con métricas de ventas.
   - Gestión de asistentes, perfiles y configuraciones del sistema.
   - Módulo exclusivo para Relaciones Públicas (RRPP) que permite rastrear referidos, ventas generadas y comisiones.

6. **Notificaciones y Comunicaciones:**
   - Envío automatizado de entradas digitales (PDF/QR) por correo electrónico tras la confirmación del pago.
   - Flujos de recuperación de contraseñas y validación de cuentas.
   - Uso de BullMQ y Redis para encolar envíos masivos sin degradar el rendimiento de la API.

---

*Nota: Este repositorio refleja la estructura de un sistema actualmente en producción. Por políticas de seguridad y propiedad intelectual, abstenerse de implementar el sistema sin autorización previa.*

**Link del proyecto:**
* [NeoPass](https://www.neopass.ar/)