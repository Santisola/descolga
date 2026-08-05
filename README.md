# Descolgá

PWA de recordatorios que **insiste hasta que lo marcás hecho**. Dos cosas y nada más:
anotar en menos de tres segundos, y un aviso que vuelve en vez de perderse en la bandeja.

Implementación del diseño [Descolgá — diseño UX/UI moderno](https://claude.ai/design/p/3cdb9ba8-fc9a-48a2-ad2a-694c317e9251)
(13 pantallas, sistema de diseño **Nocturne**) y del PRD *Recordatorios anti-cuelgue*.

---

## Stack

| Pieza | Elección |
| --- | --- |
| Framework | Next.js 15 (App Router) + React 19 + TypeScript |
| Base de datos | Postgres (Neon) vía Drizzle ORM |
| Auth | Propia: email + contraseña (`bcryptjs`) y sesión JWT en cookie httpOnly (`jose`) |
| Push | Web Push con VAPID (`web-push`) + Service Worker |
| Scheduler | `POST /api/cron/tick` cada minuto (Vercel Cron, QStash o `npm run tick`) |
| Estilos | CSS plano: los tokens de Nocturne portados a `src/app/nocturne.css` |

---

## Arrancar

```bash
npm install
npm run vapid          # imprime las VAPID keys + SESSION_SECRET + CRON_SECRET
cp .env.example .env   # pegá ahí lo que imprimió el paso anterior
```

### Con base de datos real (Neon)

```bash
# completá DATABASE_URL en .env
npm run db:push        # aplica el esquema
npm run db:seed        # opcional: carga el escenario del diseño
npm run dev
```

### Sin base de datos

Si `DATABASE_URL` queda vacía, en desarrollo la app arranca contra **PGlite**
(Postgres compilado a WASM, en proceso, persistido en `./.pglite`). Sirve para ver
la app funcionando sin aprovisionar nada:

```bash
npm run db:seed        # con el dev server apagado: PGlite admite un solo escritor
npm run dev
```

Cuenta del seed: `nico@mail.com` / `descolga2026`.

En producción `DATABASE_URL` es obligatoria; el fallback nunca se carga ahí.

### El scheduler

Las PWA no pueden programar notificaciones locales a futuro, así que el aviso lo
manda el backend. En desarrollo, con el dev server andando:

```bash
npm run tick           # pega a /api/cron/tick cada 60 s y loguea qué salió
```

**En producción el tick lo dispara un cron externo, no Vercel.** El plan Hobby de
Vercel sólo admite cron *una vez por día* — una expresión más frecuente hace fallar
el deploy. `vercel.json` deja un tick diario como red de seguridad, y la cadencia
real la manda cualquier servicio que pegue al endpoint cada minuto:

```
POST https://<tu-app>.vercel.app/api/cron/tick
Authorization: Bearer <CRON_SECRET>
```

El endpoint acepta `GET` y `POST`, y si el servicio no permite headers custom,
también `?secret=<CRON_SECRET>` (queda en los logs de acceso: preferí el header).

Opciones que sirven en su plan gratuito:

| Servicio | Intervalo mínimo | Headers custom |
| --- | --- | --- |
| [cron-job.org](https://cron-job.org) | 1 min | Sí |
| Cloudflare Workers (Cron Triggers) | 1 min | Sí |
| GitHub Actions (`schedule`) | 5 min nominal, con demoras de 10–15 min | Sí |
| Upstash QStash | free tier: 500 mensajes/día → alcanza para cada 3 min | Sí |

Con Pro, alcanza con volver a poner `"schedule": "* * * * *"` en `vercel.json` y
borrar el cron externo.

---

## Comandos

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Build de producción (no necesita `DATABASE_URL`) |
| `npm test` | Tests de dominio contra un Postgres real en proceso |
| `npm run db:generate` | Regenera el SQL de migración desde el esquema |
| `npm run db:push` | Aplica el esquema a la base |
| `npm run db:seed` | Carga el escenario del diseño |
| `npm run tick` | Scheduler local |
| `npm run vapid` | Genera VAPID keys y secretos |

---

## Cómo funciona la insistencia

El corazón del producto está en `src/lib/scheduler.ts` y `src/lib/reminders.ts`.

**Modos de aviso** (`notify_mode`)

- `once` — un solo aviso, en `notify_at ?? due_at`.
- `insist` — re-avisa cada `insist_interval_minutes` mientras siga `pending`, hasta
  `max_repeats`.
- `persistent` — igual que `insist`, pero con `requireInteraction: true` para que en
  Android quede fija en la bandeja. En iOS eso no es confiable, así que **la
  repetición es el mecanismo**: por eso `persistent` también repite, en vez de
  depender de que la notificación se quede clavada.

**Un tick** (cada minuto)

1. Los pospuestos cuyo plazo venció vuelven a `pending`.
2. Para cada `pending`, `nextFireAt()` dice si toca avisar.
3. Si estamos dentro de las **horas de silencio** del usuario, no se toca nada: el
   recordatorio sigue vencido y sale solo cuando cierra la ventana.
4. Antes de mandar nada, el recordatorio se **reclama** con un `UPDATE` condicional
   sobre `sent_count` y `last_notified_at`. Dos ticks solapados no pueden mandar el
   mismo aviso dos veces.
5. Se despacha a todas las suscripciones vivas del usuario. Un 404/410 marca esa
   suscripción como vencida en vez de reintentarla para siempre.
6. Todo queda en `notification_log`.

**Recurrencia anclada al completado.** Al marcar hecho un recurrente no se cierra:
`next_due = completed_at + interval_days` y vuelve a `pending` con el contador de
avisos en cero. Es lo que evita el arrastre de fechas fijas en tareas de
mantenimiento (el caso de las uñas de la perra).

**Anti-molestia.** Horas de silencio por usuario, tope de repeticiones por
recordatorio, y `Posponer` a un toque — que además reinicia la cuenta de avisos,
porque posponer es un "no ahora" explícito y no debería devolverte el recordatorio
ya gastado.

---

## Acciones desde la notificación

El Service Worker (`public/sw.js`) resuelve **Hecho** y **Posponer** sin abrir la app.
La request lleva la cookie de sesión (es same-origin), pero además cada push incluye
un **token firmado de un solo propósito** por acción: en iOS una instalación que
estuvo dormida mucho tiempo puede perder la cookie, y los botones tienen que seguir
funcionando. Ver `src/lib/action-token.ts`.

Los botones de acción son de Android; iOS los ignora. Ahí el trabajo lo hace el
contador de avisos en el cuerpo de la notificación.

---

## Diferencias entre plataformas

| | Android (Chromium) | iOS / iPadOS (WebKit) |
| --- | --- | --- |
| Push sin instalar | Sí | **No** — sólo instalada en pantalla de inicio |
| `requireInteraction` | Sí, queda fija | No confiable |
| Acciones en la notificación | Sí | No |
| `share_target` | Sí (`/share`) | No |
| Suscripciones | Estables | Se pueden caer por inactividad |

La app re-registra la suscripción en **cada apertura** (`PwaBootstrap` →
`revalidatePush`) por lo último. Y cuando detecta iOS sin instalar no pide un permiso
que no existe: manda a `/instalar`.

---

## Rutas

**Pantallas** — cada una anotada con el ID del diseño que implementa.

| Ruta | Diseño |
| --- | --- |
| `/pendientes` | 1a lista agrupada · 1c quick add · 1d hoja del FAB · 1g permiso · 1j primer uso · 1k todo hecho |
| `/pendientes?filtro=insistiendo` | sólo lo que está insistiendo |
| `/r/[id]` | 1e detalle y edición · 1m panel de detalle en escritorio |
| `/ajustes` | 1l |
| `/instalar` | 1h guía de instalación en iPhone + 1f preview del aviso |
| `/avisos` | 1i permiso denegado |
| `/hechos`, `/archivados` | los filtros del sidebar de 1m |
| `/entrar`, `/crear-cuenta` | no están en el diseño; construidas con el vocabulario de Nocturne |
| `/share` | share target de Android → quick add pre-cargado |

Desde 1024px, `AppShell` pasa a la grilla sidebar / lista / detalle de 1m; abajo de
eso es una sola columna y el detalle ocupa la pantalla.

**API**

```
POST   /api/auth/registro | /api/auth/entrar | /api/auth/salir
GET    /api/reminders                     lista abiertos
POST   /api/reminders                     alta (title + chip/dueAt + insist)
PATCH  /api/reminders/:id                 editar
DELETE /api/reminders/:id                 borrar
POST   /api/reminders/:id/done            marcar hecho   (cookie o token firmado)
POST   /api/reminders/:id/snooze          posponer       (cookie o token firmado)
POST   /api/reminders/:id/reabrir         volver a pendientes
POST   /api/reminders/:id/archivar        archivar
POST   /api/push/subscribe                registrar/revalidar este dispositivo
DELETE /api/push/subscribe                quitar un dispositivo
POST   /api/push/test                     aviso de prueba
PATCH  /api/settings                      silencio, cadencia, tope, zona horaria
POST   /api/cron/tick                     scheduler (requiere CRON_SECRET)
```

---

## Modelo de datos

`src/lib/db/schema.ts`. Cuatro tablas: `users`, `reminders`, `push_subscriptions`,
`notification_log`. Las horas de silencio se guardan como **minutos desde la
medianoche local** (23:00 → 1380) y se evalúan en la zona horaria del usuario, que se
toma del dispositivo al crear la cuenta.

Todo lo que se guarda es un instante absoluto (`timestamptz`). Las etiquetas visibles
("Vence el viernes", "18:00", "jue") se formatean **en el servidor**, en la zona del
usuario, y viajan al cliente como texto: por eso la lista no tiene desajustes de
hidratación. Ver `src/lib/dates.ts` y `src/lib/view.ts`.

---

## Decisiones que el PRD dejaba abiertas

- **Auth**: propia (bcrypt + JWT en cookie httpOnly) en vez de Auth.js / better-auth /
  Clerk. Es la única de las opciones que no necesita credenciales de terceros ni un
  servicio externo. Está aislada en `src/lib/auth.ts` + `src/lib/session.ts`, así que
  cambiarla es reemplazar esos dos archivos.
- **Scheduler**: `vercel.json` con Vercel Cron por defecto. El endpoint es un POST con
  secreto, así que QStash o un `node-cron` sirven igual sin tocar código.
- **Cadencia por defecto**: cada 60 min, tope de 5 avisos, silencio 23:00–08:00.
  Editable por usuario en `/ajustes`.

## Lo que quedó fuera (v1.2 del PRD)

Entrada por voz (Web Speech API) y parsing de lenguaje natural de la fecha desde el
título. El resto del alcance de v1 y v1.1 está implementado.
