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

## Guía de despliegue desde cero

Esta guía publica el sistema con **Supabase** como backend (PostgreSQL y Edge Functions) y **Cloudflare Pages** como alojamiento del frontend. Está escrita pensando en una primera instalación. Haz los pasos en orden: el frontend publicado necesita que el backend ya exista.

> [!IMPORTANT]
> El despliegue descrito deja operativa la experiencia pública del concurso. La ruta `/admin` todavía usa un acceso de demostración: cualquier correo y contraseña permiten entrar y sus datos son de ejemplo. No la uses como panel administrativo real hasta completar los pendientes de seguridad indicados al final del README.

### 1. Crear las cuentas y preparar el equipo

Necesitas:

- Una cuenta de [GitHub](https://github.com/) y este repositorio subido allí.
- Una cuenta de [Supabase](https://supabase.com/).
- Una cuenta de [Cloudflare](https://dash.cloudflare.com/).
- [Node.js 22 LTS o posterior](https://nodejs.org/) instalado. `npm` se instala junto con Node.js.
- Git instalado si todavía no tienes el repositorio en tu equipo.

Comprueba Node y npm desde PowerShell, Terminal o CMD:

```bash
node --version
npm --version
```

La versión de Node debe empezar por `v22` o ser superior. Después, abre una terminal dentro de la carpeta del proyecto e instala exactamente las dependencias registradas en `package-lock.json`:

```bash
npm ci
```

Comprueba que el proyecto original está sano antes de configurar servicios externos:

```bash
npm run lint
npm test
npm run build
```

Los tres comandos deben terminar sin errores. El último crea la carpeta `dist`, que será el contenido publicado por Cloudflare.

### 2. Crear el proyecto de Supabase

1. Entra en el [panel de Supabase](https://supabase.com/dashboard) y pulsa **New project**.
2. Elige una organización, escribe un nombre reconocible, por ejemplo `reveal-five`, y genera una contraseña de base de datos larga y única.
3. Guarda esa contraseña en un gestor de contraseñas. No la añadas al repositorio.
4. Elige la región más cercana a la mayoría de participantes.
5. Crea el proyecto y espera a que termine su aprovisionamiento.
6. Abre **Project Settings > General** y copia el **Reference ID** del proyecto. En los comandos siguientes se representa como `<PROJECT_REF>`.

### 3. Instalar y conectar la CLI de Supabase

No hace falta instalar la CLI globalmente. Ejecútala mediante `npx`, desde la raíz de este repositorio:

```bash
npx supabase@latest login
```

El comando abre el navegador o solicita un token de acceso. Al terminar, enlaza esta carpeta con el proyecto que acabas de crear:

```bash
npx supabase@latest link --project-ref <PROJECT_REF>
```

Sustituye `<PROJECT_REF>` por el valor real, sin los símbolos `<` y `>`. Si solicita la contraseña de la base de datos, usa la que guardaste en el paso anterior.

### 4. Crear las tablas, políticas y función de sorteo

La migración incluida en `supabase/migrations/202608120001_initial_schema.sql` crea el modelo completo, activa Row Level Security (RLS) y añade el sorteo transaccional. Aplícala con:

```bash
npx supabase@latest db push
```

Cuando la CLI muestre la migración pendiente, confirma su aplicación. Luego verifica en el panel de Supabase:

1. Abre **Table Editor**.
2. Deben aparecer `campaigns`, `participants`, `refrigerators`, `prizes`, `participations` y `admin_action_logs`.
3. Abre **Database > Functions** y comprueba que existe `draw_prize_atomic`.

Si `db push` falla, no continúes todavía. Lee el primer error de la terminal, comprueba que enlazaste el proyecto correcto y vuelve a ejecutar el comando cuando lo hayas corregido. Una migración aplicada queda registrada por Supabase y no se duplica al repetir `db push`.

### 5. Cargar una campaña inicial

El sistema necesita exactamente una campaña activa, las cuatro refrigeradoras que actualmente muestra la interfaz y al menos un premio con peso mayor que cero. En Supabase abre **SQL Editor > New query**, pega este bloque y pulsa **Run** una sola vez:

```sql
do $$
declare
  v_campaign_id uuid;
begin
  insert into public.campaigns (slug, name, status, starts_at)
  values ('reveal-five', 'Reveal Five', 'active', now())
  returning id into v_campaign_id;

  insert into public.refrigerators
    (campaign_id, public_key, label, sort_order)
  values
    (v_campaign_id, 'violet', 'Refrigeradora violeta', 1),
    (v_campaign_id, 'cyan',   'Refrigeradora cian', 2),
    (v_campaign_id, 'coral',  'Refrigeradora coral', 3),
    (v_campaign_id, 'gold',   'Refrigeradora dorada', 4);

  insert into public.prizes
    (campaign_id, name, description, claim_instructions, weight,
     initial_stock, remaining_stock)
  values
    (v_campaign_id, 'Premio principal', 'Descripción del premio principal',
     'Contacta al equipo de la campaña para reclamarlo.', 5, 10, 10),
    (v_campaign_id, 'Premio secundario', 'Descripción del premio secundario',
     'Contacta al equipo de la campaña para reclamarlo.', 25, 100, 100),
    (v_campaign_id, 'Premio de participación', 'Descripción del premio de participación',
     'Sigue las instrucciones de la campaña.', 70, null, null);
end $$;
```

Estos nombres, existencias y probabilidades son ejemplos: cámbialos antes de una campaña real. `weight` es un peso relativo; los valores `5`, `25` y `70` equivalen inicialmente a 5 %, 25 % y 70 %. Si se agota un premio, queda fuera del sorteo y los pesos restantes se normalizan automáticamente. `null` en existencias significa inventario ilimitado.

Para verificar la carga, ejecuta en otra consulta:

```sql
select id, slug, name, status from public.campaigns;
select public_key, label, active from public.refrigerators order by sort_order;
select name, weight, remaining_stock, active from public.prizes;
```

Debe haber una sola fila con estado `active`. La función de registro actual busca una única campaña activa; si existen dos, el registro fallará. Para repetir una campaña, es preferible poner la anterior en `finished` y crear otra con un `slug` distinto.

### 6. Desplegar las Edge Functions

Desde la raíz del repositorio ejecuta:

```bash
npx supabase@latest functions deploy register-participant
npx supabase@latest functions deploy draw-prize
```

Supabase proporciona automáticamente a las funciones `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`; no copies la service role key al frontend ni a Cloudflare Pages. Es una credencial con permisos elevados y debe permanecer solo en el servidor.

En el panel abre **Edge Functions** y comprueba que aparecen las dos funciones. Si haces cambios futuros en sus archivos, vuelve a desplegar la función modificada con el mismo comando.

### 7. Obtener las variables públicas de Supabase

En el panel de Supabase abre la sección **Connect** o **Project Settings > API Keys** (el nombre puede variar ligeramente según la versión del panel) y localiza:

- **Project URL**, con forma `https://xxxxxxxx.supabase.co`.
- La clave pública **Publishable key** o la clave heredada **anon public**.

Ambas están diseñadas para usarse en el navegador; la protección real depende de RLS y de las Edge Functions. Nunca uses aquí `service_role` ni una secret key.

Crea un archivo `.env.local` en la raíz del proyecto a partir del ejemplo:

```bash
# macOS o Linux
cp .env.example .env.local
```

En PowerShell usa:

```powershell
Copy-Item .env.example .env.local
```

Edita `.env.local`:

```dotenv
VITE_SUPABASE_URL=https://TU_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=TU_CLAVE_PUBLICA
VITE_TURNSTILE_SITE_KEY=
```

No subas `.env.local` a Git. Toda variable que empieza por `VITE_` termina dentro del código público del navegador, por lo que jamás debe contener secretos.

### 8. Probar localmente contra Supabase

Inicia el frontend:

```bash
npm run dev
```

Abre la dirección que muestra Vite, normalmente `http://localhost:5173`. Completa el formulario con datos de prueba, elige una refrigeradora y confirma que aparece un premio. Después revisa en Supabase **Table Editor**:

- `participants` debe contener el registro de prueba.
- `participations` debe tener estado `awarded` y referencias a una refrigeradora y un premio.
- Si el premio tenía inventario limitado, `remaining_stock` debe haber disminuido en uno.

Usa otro correo y otra identificación en cada intento: la base de datos impide participar dos veces en una campaña con la misma identificación o correo. Para diagnosticar una función, abre **Edge Functions**, selecciona su nombre y consulta **Logs**.

### 9. Subir el código a GitHub

Si este repositorio todavía no está en GitHub, crea allí un repositorio vacío y sigue los comandos que GitHub muestra para enlazarlo. En un repositorio ya enlazado basta con guardar y publicar los cambios:

```bash
git add README.md
git commit -m "docs: add deployment guide"
git push origin main
```

Comprueba en GitHub que `.env.local` **no** aparece entre los archivos. No continúes si accidentalmente publicaste una clave secreta: elimínala del repositorio y rótala desde el proveedor correspondiente.

### 10. Crear el sitio en Cloudflare Pages

1. Entra al panel de Cloudflare.
2. Abre **Workers & Pages** y selecciona **Create application**.
3. Elige **Pages** y la opción para importar un repositorio Git existente.
4. Autoriza GitHub, selecciona este repositorio y comienza la configuración.
5. Usa estos valores:

| Campo | Valor |
| --- | --- |
| Production branch | `main` |
| Framework preset | `Vite` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | `/` o vacío |

6. En **Environment variables** añade, tanto para **Production** como para **Preview**:

| Variable | Valor |
| --- | --- |
| `VITE_SUPABASE_URL` | La Project URL de Supabase |
| `VITE_SUPABASE_ANON_KEY` | La clave pública de Supabase |

7. No añadas todavía `VITE_TURNSTILE_SITE_KEY`; la interfaz aún no genera ni envía el token de Turnstile.
8. Pulsa **Save and Deploy** y espera a que termine la compilación.

Cloudflare asignará una URL parecida a `https://nombre-del-proyecto.pages.dev`. Cada nuevo commit en `main` generará un despliegue de producción; las ramas y pull requests pueden generar vistas previas.

Si el build falla, abre el despliegue y revisa **Build logs**. Los errores más frecuentes son una versión incorrecta de Node, variables mal escritas o un comando/directorio distinto a los de la tabla. Si necesitas fijar la versión de Node en Cloudflare, añade la variable de compilación `NODE_VERSION` con valor `22` y vuelve a desplegar.

### 11. Verificar el despliegue público

Haz una prueba completa desde la URL `pages.dev`:

1. Abre `/` y confirma que carga la portada.
2. Abre `/c/reveal-five` directamente y recarga la página para comprobar la navegación de la SPA.
3. Registra un participante de prueba y completa el sorteo.
4. Confirma el resultado en las tablas y logs de Supabase.
5. Revisa la consola y la pestaña Network de las herramientas del navegador: no debe haber respuestas 4xx/5xx de las Edge Functions.
6. Prueba al menos un teléfono real y una ventana privada.

Si al recargar una ruta interna Cloudflare responde 404, comprueba que no exista un archivo `_redirects` incompatible y que el proyecto se haya creado como Pages con salida estática `dist`. Cloudflare Pages aplica su comportamiento SPA cuando no existe una página HTML coincidente.

### 12. Añadir un dominio propio (opcional)

En el proyecto de Pages abre **Custom domains > Set up a custom domain**, escribe el dominio o subdominio y sigue las indicaciones DNS. Si el DNS ya está administrado por Cloudflare, normalmente creará el registro necesario. Espera a que el certificado figure como activo y repite las pruebas usando el dominio definitivo.

### 13. Turnstile: dejarlo desactivado hasta completar la integración

La Edge Function `draw-prize` valida Turnstile únicamente cuando existe el secreto `TURNSTILE_SECRET_KEY`. Sin embargo, el frontend actual no renderiza el widget ni envía `turnstileToken`. Por eso, **no configures todavía** ni `TURNSTILE_SECRET_KEY` en Supabase ni `VITE_TURNSTILE_SITE_KEY` en Cloudflare: hacerlo bloquearía todos los sorteos con `BOT_CHECK_FAILED`.

Cuando se implemente el widget en el frontend y se envíe su token, crea un widget en Cloudflare Turnstile, autoriza los dominios de producción y preview, añade la site key pública a Pages y guarda el secreto solo en Supabase:

```bash
npx supabase@latest secrets set TURNSTILE_SECRET_KEY=TU_SECRETO
npx supabase@latest functions deploy draw-prize
```

### 14. Actualizaciones y operación diaria

Para publicar cambios del frontend:

```bash
npm run lint
npm test
npm run build
git add .
git commit -m "describe el cambio"
git push origin main
```

Para cambios de base de datos, crea una migración nueva dentro de `supabase/migrations` y ejecuta `npx supabase@latest db push`; no edites manualmente una migración que ya se aplicó en producción. Para cambios de Edge Functions, despliega nuevamente solo las funciones afectadas.

Antes de una campaña real configura alertas y revisa periódicamente los logs, el inventario, los límites del plan y las copias de seguridad disponibles en tu plan de Supabase. Conserva además una exportación independiente de los datos que legalmente debas guardar.

### Solución rápida de problemas

| Síntoma | Causa probable | Qué revisar |
| --- | --- | --- |
| La app muestra datos demo | Falta una de las dos variables de Supabase | Nombres exactos `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`; vuelve a desplegar después de cambiarlas |
| `REGISTER_FAILED` | Error de escritura o esquema incompleto | Que `db push` terminó y que `register-participant` está desplegada |
| `ALREADY_PARTICIPATED` | Correo o identificación repetidos | Usa datos de prueba nuevos o consulta el registro existente |
| Registro falla sin un error claro | No hay exactamente una campaña activa | Consulta `campaigns` y deja una sola fila `active` dentro de fechas válidas |
| `INVALID_REFRIGERATOR` | Las claves no coinciden o la refrigeradora está inactiva | Usa `violet`, `cyan`, `coral` y `gold`, y comprueba `active = true` |
| `NO_PRIZES_AVAILABLE` | Todos los pesos son cero o no queda inventario | Activa premios con `weight > 0` y stock disponible |
| `BOT_CHECK_FAILED` | Se activó el secreto sin integrar el widget | Retira temporalmente el secreto o completa la integración cliente-servidor |
| `permission denied for function draw_prize_atomic` | Falta el permiso de ejecución para la Edge Function | Actualiza el repositorio y ejecuta `npx supabase@latest db push` para aplicar la migración correctiva |
| `function gen_random_bytes(integer) does not exist` | La función no encuentra `pgcrypto` en el esquema de extensiones | Actualiza el repositorio y ejecuta `npx supabase@latest db push` |
| Cloudflare compila pero la app no conecta | Variables ausentes en el entorno correcto | Configúralas en Production/Preview y lanza un nuevo deployment |
| Una ruta interna da 404 al recargar | Configuración SPA incorrecta | Confirma preset Vite, salida `dist` y ausencia de reglas de redirects incompatibles |

No expongas contraseñas, access tokens, la clave `service_role` ni `TURNSTILE_SECRET_KEY` en capturas, commits, variables `VITE_*` o incidencias públicas.

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

La guía anterior contiene el procedimiento completo. En resumen: enlaza la CLI, aplica `supabase/migrations`, carga una campaña activa con las cuatro claves que usa el frontend y despliega `register-participant` y `draw-prize`. No actives el secreto de Turnstile hasta implementar el widget del frontend, como explica el paso 13.

RLS bloquea las tablas sensibles al rol anónimo. La escritura pública ocurre únicamente mediante funciones con service role. Antes de producción, sustituye la política administrativa genérica por claims de rol (`app_metadata.role = 'admin'`) adecuados a la organización y activa MFA para administradores.

## Probabilidad e inventario

Los pesos viven en `prizes.weight`; no están en el bundle público. Pueden sumar 100 para una interfaz porcentual o utilizarse como pesos relativos. Los premios con `remaining_stock = 0` se excluyen automáticamente. `NULL` representa inventario ilimitado. El RPC usa bytes criptográficamente aleatorios de `pgcrypto`, `SELECT ... FOR UPDATE` y una única transacción para impedir entregar dos veces la última unidad.

## Turnstile y abuso

Turnstile todavía está pendiente de integración en el frontend. Cuando se implemente, `VITE_TURNSTILE_SITE_KEY` irá en Cloudflare Pages y `TURNSTILE_SECRET_KEY` solamente en Supabase; nunca intercambies ambas claves. Para una campaña pública también se recomienda añadir rate limiting en Cloudflare WAF por ruta y fingerprint no invasivo como señal secundaria; las restricciones únicas de PostgreSQL siguen siendo la fuente de verdad.

## Cloudflare Pages

- Build command: `npm run build`
- Output: `dist`
- Production branch: `main`
- Preview branch: `develop`
- Añade las dos variables de Supabase `VITE_*`; añade la de Turnstile únicamente después de completar su integración.
- Configura fallback SPA de rutas a `index.html` si el preset de Vite no lo aplica.

El workflow de GitHub valida lint, pruebas y build. Cloudflare puede conectarse al mismo repositorio para previews y producción automáticos.

## Panel y exportación

La UI de `/admin` muestra métricas, premios, pesos e inventario. El login actual es un estado de demostración; para producción debe conectarse a Supabase Auth. La exportación CSV se debe implementar desde una Edge Function autenticada, nunca consultando participantes con la clave anónima. Las tablas y políticas ya separan lectura administrativa de acceso público.

## Desarrollo y pruebas

```bash
npm run lint
npm test
npm run build
```

Prueba manualmente en 320, 360, 375, 390, 412 y 430 px, con teclado virtual abierto, Chrome Android y Safari iOS reales. También valida reconexión después del sorteo: el mismo participante debe recuperar exactamente el resultado registrado. La UI respeta `prefers-reduced-motion`, safe areas, `100dvh`, focus visible y objetivos táctiles amplios.

## Assets

El hero activo está en `public/assets/refrigerators-hero-top-freezer.png`; las variantes anteriores permanecen en la misma carpeta. Es un render publicitario sin texto ni marcas, basado en refrigeradoras metálicas de congelador superior y puerta completa lateral. Para producción conviene generar derivados AVIF/WebP responsive y mantener los PNG como fuentes.

## Pendientes antes de una campaña real

- Conectar el login del panel con Supabase Auth, roles y MFA.
- Añadir UI CRUD y Edge Functions administrativas con audit logs.
- Implementar exportación CSV autenticada.
- Insertar widget Turnstile y enviar su token real.
- Configurar textos legales, fechas, assets y mecanismo de reclamación.
- Ejecutar pruebas de concurrencia contra una base staging y QA en dispositivos físicos.
