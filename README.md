# Reveal Five

Plataforma promocional mobile-first para concursos de selección y reveal de premios. Incluye una experiencia pública animada, un panel administrativo responsive y un backend Supabase preparado para sorteos ponderados, inventario atómico y trazabilidad.

## Inicio rápido

Requiere Node 22 o superior.

```bash
npm install
npm run dev
```

La app funciona de inmediato en modo demostración. Rutas:

- `/` y `/c/reveal-five`: experiencia pública.
- `/admin`: panel administrativo de demostración.

Para conectar Supabase, copia `.env.example` como `.env.local` y completa `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`. Al existir ambas variables, la capa de datos deja el modo demo y consume las Edge Functions.

## Arquitectura

```text
React / Vite / TypeScript
        ↓
Supabase Edge Functions
        ↓
RPC PostgreSQL transaccional
```

La experiencia usa un reducer con los estados `LANDING`, `FORM`, `REGISTERING`, `SELECTING`, `LOCKING_SELECTION`, `REVEAL_ANIMATION`, `RESULTS` y `ERROR`. El frontend nunca recibe pesos ni decide el ganador en producción. `draw_prize_atomic` bloquea la participación, devuelve resultados existentes de forma idempotente, bloquea inventario y registra un snapshot auditable.

## Supabase

La guía anterior contiene el procedimiento completo. En resumen: enlaza la CLI, aplica `supabase/migrations`, carga una campaña activa con las cuatro claves que usa el frontend y despliega `register-participant` y `draw-prize`. No actives el secreto de Turnstile hasta implementar el widget del frontend.

RLS bloquea las tablas sensibles al rol anónimo. La escritura pública ocurre únicamente mediante funciones con service role. Antes de producción.

## Probabilidad e inventario

Los pesos viven en `prizes.weight`; no están en el bundle público. Pueden sumar 100 para una interfaz porcentual o utilizarse como pesos relativos. Los premios con `remaining_stock = 0` se excluyen automáticamente. `NULL` representa inventario ilimitado. El RPC usa bytes criptográficamente aleatorios de `pgcrypto`, `SELECT ... FOR UPDATE` y una única transacción para impedir entregar dos veces la última unidad.

## Turnstile y abuso

Turnstile todavía está pendiente de integración en el frontend. Cuando se implemente, `VITE_TURNSTILE_SITE_KEY` irá en Cloudflare Pages y `TURNSTILE_SECRET_KEY` solamente en Supabase; nunca intercambies ambas claves. Para una campaña pública también se recomienda añadir rate limiting en Cloudflare WAF por ruta y fingerprint no invasivo como señal secundaria; las restricciones únicas de PostgreSQL siguen siendo la fuente de verdad.

## Desarrollo y pruebas

```bash
npm run lint
npm test
npm run build
```

Prueba manualmente en 320, 360, 375, 390, 412 y 430 px, con teclado virtual abierto, Chrome Android y Safari iOS reales. También valida reconexión después del sorteo: el mismo participante debe recuperar exactamente el resultado registrado. La UI respeta `prefers-reduced-motion`, safe areas, `100dvh`, focus visible y objetivos táctiles amplios.
