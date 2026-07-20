# Galería Recrear: relevamiento y plan de implementación

Fecha del relevamiento: 20 de julio de 2026.

## 1. Resumen ejecutivo

Sí, es posible completar la aplicación con backend Node.js, PostgreSQL y
Google Drive para fotos y videos.

La arquitectura recomendada es:

- PostgreSQL guarda usuarios, permisos, colegios, lotes/álbumes, estados de
  moderación y metadatos de cada archivo.
- Google Drive guarda únicamente los binarios originales y sus derivados
  (miniaturas o previews), siempre privados.
- El backend Node.js es la única puerta de acceso a Drive: valida la sesión y
  los permisos antes de subir, visualizar o descargar un archivo.
- El frontend conserva la experiencia actual, pero reemplaza los mocks por una
  API autenticada.

Google Drive es una opción viable para un MVP y para un volumen moderado. No es
un CDN ni un servicio especializado de streaming: si se espera mucha
concurrencia, reproducción intensiva de video o cientos de miles de archivos,
conviene dejar una interfaz de almacenamiento intercambiable para poder migrar
después a Google Cloud Storage, S3 o similar.

## 2. Estado actual del repositorio

### Stack existente

| Capa | Estado |
| --- | --- |
| Frontend | Astro 4 + React 18 + TypeScript; build estático correcto |
| Estilos | Tailwind instalado, aunque gran parte de la UI usa estilos inline |
| Backend | Express 5 en CommonJS con un único `GET /api` |
| Base de datos | PostgreSQL 15 declarado en Docker Compose; no está conectado |
| Infraestructura local | Dockerfiles y Docker Compose para frontend, backend y DB |
| Pruebas | No existen pruebas automatizadas |

El comando `npm run build` del frontend termina correctamente. Sólo informa dos
imports sin uso (`Filter` y `Square`).

### Funcionalidad visible por rol

#### Administrador

- Moderación visual de lotes pendientes.
- Descarte/restauración visual de fotos y aprobación simulada.
- Galería global con filtros por colegio, turno, actividad y fechas.
- CRUD local de colegios, actividades, turnos y usuarios.
- Carga manual de fotos.

#### Coordinador

- Selección de colegio, fecha, turno y actividad.
- Arrastrar/seleccionar múltiples imágenes, previsualizarlas y quitarlas.
- Barra de progreso y envío a revisión simulados.
- La galería del coordinador es todavía un placeholder.

#### Familia/usuario

- Colegios asociados, búsqueda, filtro y orden de álbumes.
- Apertura de álbum, lightbox y selección múltiple.
- Botones de descarga individual/masiva presentes, sin implementación.

### Qué está mockeado o incompleto

| Área | Situación actual | Trabajo necesario |
| --- | --- | --- |
| Sesión | Usuario fijo según la ruta | Login, logout, recuperación e identidad real |
| Autorización | `/admin`, `/coordinator` y `/parent` son públicas | RBAC y validación por colegio en backend |
| Datos maestros | Arrays dentro de componentes | CRUD persistente y validado |
| Carga | Sólo imágenes y un temporizador | Subida real, reintentos, videos y progreso real |
| Moderación | Estado local; aprobar no modifica el lote | Workflow persistente y auditable |
| Galerías | Imágenes de `picsum.photos` | Consultas paginadas y contenido privado de Drive |
| Descargas | Botones sin acción | Descarga autorizada y ZIP para lotes/selección |
| Backend | Respuesta “Hello” | API, servicios, repositorios, seguridad y errores |
| PostgreSQL | Contenedor sin tablas | Modelo, migraciones, seeds, backups |
| Google Drive | Sin integración | Proyecto Google Cloud, credenciales y Shared Drive |
| Operación | Sin health checks, logs ni métricas | Observabilidad y recuperación |

También se detectó texto con mojibake (`Ã`, `Â`, `â`) en varios componentes,
la ruta `/` repite el portal de `/parent`, y algunos `URL.createObjectURL` de
previews no se liberan. Son ajustes chicos, pero deben entrar en la primera fase.

## 3. Alcance funcional propuesto

### Roles

| Operación | Administrador | Coordinador | Familia |
| --- | :---: | :---: | :---: |
| Administrar usuarios y catálogos | Sí | No | No |
| Asignar coordinadores/familias a colegios | Sí | No | No |
| Subir material | Sí | Sólo colegios asignados | No |
| Ver lotes pendientes | Sí | Sólo propios | No |
| Descartar/restaurar material | Sí | Antes de enviar | No |
| Aprobar/rechazar lotes | Sí | No | No |
| Ver material aprobado | Todo | Colegios asignados | Colegios asignados |
| Descargar material | Sí | Según política | Según política |

Regla central: la interfaz puede ocultar acciones, pero todas las decisiones de
autorización se repiten obligatoriamente en el backend.

### Ciclo de vida de un lote

```text
BORRADOR -> SUBIENDO -> PENDIENTE_MODERACION -> APROBADO
                   \                         -> RECHAZADO
                    -> ERROR
```

- El coordinador crea un borrador y carga archivos.
- Cada archivo tiene su propio estado para poder reintentar sin repetir el lote.
- Al enviar el lote, deja de ser editable por el coordinador.
- El administrador puede rechazar archivos individuales y aprobar el resto.
- Sólo lotes aprobados y archivos aprobados aparecen a las familias.
- El borrado debe ser lógico primero; la eliminación/trash de Drive se realiza
  mediante una tarea controlada y auditable.

## 4. Arquitectura objetivo

```text
Astro + React
    |
    | HTTPS + cookie segura / JSON
    v
API Node.js + TypeScript
    |-- autenticación y RBAC
    |-- colegios, catálogos, álbumes y moderación
    |-- streaming/descargas y trabajos de archivos
    |
    +--> PostgreSQL (fuente de verdad y permisos)
    |
    +--> Google Drive API (binarios privados)
    |
    +--> worker opcional (miniaturas, ZIP, limpieza y reintentos)
```

### Backend recomendado

Se puede evolucionar el Express existente sin reescribir el frontend:

- Node.js LTS + TypeScript y Express 5 organizado por módulos.
- Prisma o Drizzle para migraciones y consultas tipadas. Prisma es una buena
  opción inicial por velocidad de implementación.
- Zod para validar body, params, query y variables de ambiente.
- Argon2id para contraseñas; cookies `HttpOnly`, `Secure` y `SameSite` para la
  sesión. Los refresh tokens deben rotarse y almacenarse hasheados.
- `googleapis` para Drive, usando streams y cargas reanudables.
- `sharp` para miniaturas; `ffprobe`/FFmpeg sólo si se generan posters o se
  transcodifican videos.
- Pino para logs estructurados; OpenAPI para documentar el contrato.
- Vitest/Jest + Supertest y una base PostgreSQL de prueba.

Redis/BullMQ no es obligatorio para el primer corte. Se vuelve recomendable
cuando haya generación asíncrona de ZIP, procesamiento de video o reintentos de
muchos archivos.

### Estructura sugerida del backend

```text
backend/src/
  app.ts
  server.ts
  config/
  middleware/       # sesión, RBAC, errores, rate limit
  modules/
    auth/
    users/
    schools/
    activities/
    shifts/
    albums/
    media/
    moderation/
    downloads/
  infrastructure/
    db/
    drive/
    jobs/
  tests/
```

## 5. Modelo de datos inicial

Usar UUID, timestamps con zona horaria (`timestamptz`) y borrado lógico donde
importe conservar auditoría.

### Tablas principales

#### `users`

- `id`, `full_name`, `email` único, `password_hash`.
- `role`: `ADMIN`, `COORDINATOR`, `PARENT`.
- `status`: `INVITED`, `ACTIVE`, `SUSPENDED`.
- `created_at`, `updated_at`, `last_login_at`.

#### `schools`

- `id`, `name`, `code` único, `start_date`, `end_date`, `active`.
- `created_at`, `updated_at`, `deleted_at`.

#### `school_memberships`

- `school_id`, `user_id`, `membership_type` (`COORDINATOR`, `PARENT`).
- Clave única por colegio, usuario y tipo.

Esta relación reemplaza los coordinadores escritos como texto y determina qué
colegios puede consultar cada usuario.

#### `activities` y `shifts`

- `id`, `name`, `code` único, `active`.
- Los turnos pueden incluir opcionalmente `start_time`, `end_time` y orden.

#### `albums`

- `id`, `school_id`, `activity_id`, `shift_id`, `event_date`.
- `status`: `DRAFT`, `UPLOADING`, `PENDING`, `APPROVED`, `REJECTED`, `ERROR`.
- `created_by`, `submitted_at`, `reviewed_by`, `reviewed_at`.
- `review_comment`, `drive_folder_id`, `created_at`, `updated_at`.
- Índice por `(school_id, status, event_date desc)`.

#### `media_assets`

- `id`, `album_id`, `kind` (`IMAGE`, `VIDEO`).
- `status`: `UPLOADING`, `READY`, `APPROVED`, `REJECTED`, `ERROR`, `DELETED`.
- `original_name`, `mime_type`, `size_bytes`, `sha256`.
- `drive_file_id` único, `thumbnail_drive_file_id` opcional.
- `width`, `height`, `duration_seconds` opcionales.
- `sort_order`, `uploaded_by`, `moderated_by`, `moderated_at`.
- `created_at`, `updated_at`, `deleted_at`.

#### `sessions`, `password_reset_tokens` y `audit_log`

- Sesiones revocables y tokens de recuperación de un solo uso.
- Auditoría de login, permisos, moderación, descargas masivas y eliminaciones.

#### Opcional: `download_jobs`

Para ZIP grandes: estado, solicitante, selección de archivos, resultado,
expiración y error. Para lotes chicos se puede generar el ZIP por streaming.

### Relaciones

```text
users --< school_memberships >-- schools
schools --< albums >-- activities
                    >-- shifts
albums  --< media_assets
users   --< albums.created_by / reviewed_by
```

## 6. Google Drive: diseño recomendado

### Autenticación con Google

Para una organización con Google Workspace, la opción más limpia es:

1. Crear un proyecto en Google Cloud y habilitar Drive API.
2. Crear una cuenta de servicio sólo para esta aplicación.
3. Crear un Shared Drive propiedad de la organización.
4. Agregar la cuenta de servicio al Shared Drive con el rol mínimo necesario.
5. Guardar la credencial en un secret manager, nunca en Git ni en la imagen.

Una cuenta de servicio no tiene cuota propia de almacenamiento y no puede ser
dueña de archivos. Por eso debe escribir en un Shared Drive o actuar en nombre
de un usuario mediante OAuth/delegación. Para este caso, Shared Drive evita
ligar el sistema a la cuenta personal de un empleado.

Si no hay Google Workspace/Shared Drives, la alternativa es OAuth 2.0 con una
cuenta institucional y refresh token cifrado. Funciona, pero agrega dependencia
operativa de esa cuenta y exige cuidar la renovación/revocación del token.

Documentación oficial:

- [Descripción de Shared Drives](https://developers.google.com/workspace/drive/api/guides/about-shareddrives)
- [Autenticación server-to-server](https://developers.google.com/identity/protocols/oauth2/service-account)
- [Scopes de Drive](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)

### Privacidad

- No marcar archivos ni carpetas con permiso `anyone`.
- No guardar ni exponer URLs públicas como mecanismo de autorización.
- Guardar el `drive_file_id` sólo en el backend/DB.
- Exponer contenido mediante `GET /api/v1/media/:id/content`; el backend valida
  el usuario y luego hace streaming desde Drive.
- Para video, el proxy debe soportar solicitudes HTTP `Range` para permitir
  seek y reproducción progresiva.
- Respuestas con `Cache-Control: private`; registrar descargas cuando aplique.
- Separar datos por colegio en PostgreSQL. Las carpetas de Drive ayudan a
  operar, pero no reemplazan las reglas de acceso de la aplicación.

### Organización de carpetas

```text
Galeria-Recrear/
  {school-code}/
    {event-date}/
      {album-uuid}/
        originals/
        previews/
```

Los nombres son para navegación humana. La aplicación debe trabajar con IDs de
Drive, ya que los nombres se pueden repetir o modificar.

### Subida

- Un archivo por request permite progreso y reintento individual.
- Validar extensión, MIME declarado, firma real (magic bytes), tamaño y
  pertenencia del coordinador al colegio.
- Usar upload reanudable, especialmente para videos y archivos mayores a 5 MB.
- Crear primero `media_assets` con estado `UPLOADING`, subir a Drive y recién
  después pasar a `READY` con el ID retornado.
- Si Drive termina y la actualización de DB falla, un job de reconciliación
  detecta y corrige el huérfano. No existe transacción distribuida entre ambos.
- Calcular `sha256` para detectar duplicados y verificar integridad.
- Aplicar límites configurables de cantidad/tamaño por lote y formatos
  permitidos. Ejemplo inicial sujeto a negocio: imágenes de hasta 25 MB y videos
  de hasta 500 MB.

Drive recomienda cargas reanudables para archivos grandes y también como opción
general cuando puede haber cortes de red:
[subida de archivos](https://developers.google.com/workspace/drive/api/guides/manage-uploads).

### Lectura, previews y descargas

- Listar álbumes y archivos desde PostgreSQL, no consultando carpetas de Drive
  en cada pantalla.
- Las grillas consumen miniaturas, no originales.
- Las imágenes grandes y videos se sirven bajo demanda mediante el proxy.
- La descarga individual transmite `files.get` con `alt=media`.
- La descarga múltiple genera un ZIP por streaming; para lotes grandes crea un
  trabajo asíncrono con vencimiento.

Referencia oficial para descargar binarios:
[descarga de archivos](https://developers.google.com/workspace/drive/api/guides/manage-downloads).

### Límites y advertencias operativas

- Shared Drive tiene un máximo documentado de 500.000 ítems y Google recomienda
  mantenerse por debajo del límite.
- Un usuario puede subir/copiar hasta 750 GB por 24 horas.
- Drive API aplica cuotas por proyecto/usuario y requiere backoff ante `403` o
  `429`.
- Desde mayo de 2026 Google documenta también cuotas de egreso y cambios de
  facturación previstos; deben revisarse antes de producción.

Fuentes: [límites de Shared Drive](https://support.google.com/a/users/answer/7338880)
y [cuotas de Drive API](https://developers.google.com/workspace/drive/api/guides/limits).

Por estos límites, el storage debe quedar detrás de una interfaz como
`MediaStorage`, con implementaciones `GoogleDriveStorage` hoy y, si hiciera
falta, `GcsStorage`/`S3Storage` mañana.

## 7. API propuesta

Prefijo: `/api/v1`. Todas las listas deben tener paginación y límites máximos.

### Autenticación

```text
POST   /auth/login
POST   /auth/refresh
POST   /auth/logout
GET    /auth/me
POST   /auth/forgot-password
POST   /auth/reset-password
```

### Administración

```text
GET/POST         /users
GET/PATCH/DELETE /users/:id
GET/POST         /schools
GET/PATCH/DELETE /schools/:id
PUT/DELETE       /schools/:id/members/:userId
GET/POST         /activities
PATCH/DELETE     /activities/:id
GET/POST         /shifts
PATCH/DELETE     /shifts/:id
```

`DELETE` debe desactivar o realizar borrado lógico si el registro tiene
historial asociado.

### Lotes, media y moderación

```text
POST   /albums
GET    /albums
GET    /albums/:id
PATCH  /albums/:id
POST   /albums/:id/media
DELETE /albums/:id/media/:mediaId
POST   /albums/:id/submit
POST   /albums/:id/approve
POST   /albums/:id/reject
PATCH  /media/:id/moderation
GET    /media/:id/thumbnail
GET    /media/:id/content
GET    /media/:id/download
POST   /downloads
GET    /downloads/:id
```

La creación/edición de álbum sólo se permite en borradores y a un usuario
autorizado. La API acepta filtros de colegio, estado, fechas, actividad y turno.

Los errores deben usar un contrato estable con `code`, `message` y `requestId`.
Por ejemplo, un acceso a un colegio no asignado devuelve
`FORBIDDEN_SCHOOL` y estado HTTP 403.

## 8. Integración del frontend

- Crear un cliente API único con manejo de errores, expiración de sesión y
  cancelación de requests.
- Incorporar TanStack Query o una capa equivalente para cache, mutaciones e
  invalidación. Evitar duplicar estado del servidor en cada componente.
- Reemplazar constantes locales por endpoints de catálogos.
- Proteger rutas y redirigir por rol, manteniendo la autorización real en API.
- Incorporar estados de loading, vacío, error, reintento y confirmaciones.
- Paginación/infinite scroll en galerías; no cargar todos los originales.
- Ampliar el selector a `image/*,video/*`, mostrar poster e indicador de tipo.
- Usar progreso real por archivo y permitir reintento/cancelación.
- Implementar descarga de seleccionados y de álbum completo.
- Unificar `/` con login o redirección; reservar `/parent` para el portal.
- Corregir codificación UTF-8 y liberar object URLs al quitar/desmontar previews.

## 9. Seguridad y privacidad mínima para producción

El material puede incluir menores, por lo que la privacidad no debe quedar para
una fase posterior.

- HTTPS obligatorio, secretos fuera del repositorio y rotación de credenciales.
- Contraseñas con Argon2id y política de recuperación segura.
- Cookies seguras, protección CSRF si la autenticación usa cookies y CORS con
  allowlist exacta.
- Rate limiting en login, recuperación, previews y descargas.
- Validación de payloads y archivos; límites de body/request.
- Consultas siempre filtradas por colegio y rol; pruebas negativas de acceso.
- Archivos Drive privados y sin enlaces “anyone with the link”.
- Auditoría de accesos administrativos y descargas masivas.
- Backups automáticos de PostgreSQL con prueba periódica de restauración.
- Política definida de retención, baja de colegios, eliminación y recuperación.
- Antivirus opcional pero recomendable para uploads; como mínimo allowlist de
  tipos, magic bytes y rechazo de ejecutables.
- Headers de seguridad, ocultar stack traces y usar IDs de request.

Antes del lanzamiento se debe validar la política de consentimiento, retención
y acceso a imágenes de menores con el responsable legal/privacidad aplicable.

## 10. Plan por fases

Las duraciones son orientativas para una persona y deben ajustarse después de
resolver las decisiones abiertas.

### Fase 0 — decisiones y saneamiento (1–2 días)

- Confirmar autenticación, pertenencia de familias, política de descargas,
  límites de archivos y disponibilidad de Google Workspace.
- Corregir UTF-8, imports, duplicación de rutas y previews locales.
- Crear `.env.example`, validación de ambiente y health checks.

Criterio de salida: alcance cerrado, frontend limpio y ambientes reproducibles.

### Fase 1 — base del backend y PostgreSQL (3–5 días)

- Migrar backend a TypeScript y estructura modular.
- Incorporar ORM, migraciones, seed y modelo inicial.
- Errores normalizados, logs, OpenAPI y pruebas base.
- Health/readiness checks reales para API y DB.

Criterio de salida: API levanta desde cero, migra DB y pasa pruebas en CI.

### Fase 2 — identidad, roles y catálogos (4–6 días)

- Login/logout/refresh/reset e invitaciones.
- Middleware de rol y pertenencia a colegio.
- CRUD de usuarios, colegios, actividades, turnos y asignaciones.
- Conectar pantallas administrativas.

Criterio de salida: los datos persisten y un rol no puede acceder a recursos de
otro rol/colegio, comprobado por tests.

### Fase 3 — Drive y carga real (5–8 días)

- Configurar Google Cloud, Shared Drive y secretos.
- Implementar `MediaStorage` y `GoogleDriveStorage`.
- Crear lotes, subir imagen/video, progreso, validaciones y reintentos.
- Miniaturas de imagen y poster de video según alcance.
- Conectar carga de coordinador y carga manual.

Criterio de salida: un lote sobrevive reinicios y sus binarios privados quedan
trazados en DB y Drive sin exponer credenciales.

### Fase 4 — moderación y galerías (4–7 días)

- Lista real de pendientes y moderación por archivo/lote.
- Galería admin, coordinador y familia con paginación y filtros.
- Proxy privado de thumbnails, imágenes y video con Range.
- Auditoría de workflow.

Criterio de salida: una familia sólo ve material aprobado de sus colegios.

### Fase 5 — descargas y operación (3–6 días)

- Descarga individual, selección y álbum completo.
- ZIP por streaming; job asíncrono si el tamaño lo requiere.
- Backoff, reconciliación Drive/DB, limpieza y retención.
- Métricas, alertas y backups restaurables.

Criterio de salida: errores parciales son reintentables y existe procedimiento
documentado para recuperar DB y reconciliar Drive.

### Fase 6 — endurecimiento y lanzamiento (3–5 días)

- Pruebas E2E de los tres roles y pruebas de autorización negativas.
- Revisión de seguridad, límites, rendimiento y accesibilidad.
- CI/CD, ambientes staging/producción y checklist de rollback.
- Prueba piloto con uno o dos colegios.

Estimación inicial total: 4 a 7 semanas para un MVP sólido con una persona,
según el nivel de video, descarga masiva, invitaciones y despliegue.

## 11. Orden recomendado de entrega vertical

Para obtener valor temprano, cada incremento debe atravesar UI, API, DB y tests:

1. Login + usuarios + colegios.
2. Coordinador crea un lote y sube una imagen real.
3. Administrador modera ese lote.
4. Familia autorizada ve y descarga esa imagen.
5. Recién entonces agregar carga múltiple, videos, ZIP y mejoras operativas.

Esto valida temprano la parte más riesgosa: permisos privados y consistencia
entre PostgreSQL y Drive.

## 12. Decisiones abiertas antes de implementar

1. ¿Existe Google Workspace con Shared Drive o se usará una cuenta común?
2. ¿Cómo se crean familias: invitación por email, carga masiva o alta manual?
3. ¿Una familia puede pertenecer a varios colegios y por cuánto tiempo?
4. ¿Los coordinadores ven y descargan material aprobado o sólo cargan?
5. ¿Qué formatos, tamaños y duración máxima de video se aceptan?
6. ¿Se necesita streaming adaptativo/transcodificación o alcanza el archivo
   original con reproducción progresiva?
7. ¿Se permite descargar a las familias? ¿Debe quedar auditado?
8. ¿Cuánto tiempo se conserva el material y quién autoriza su eliminación?
9. ¿Volumen esperado por día, por colegio y usuarios simultáneos?
10. ¿Dónde se desplegarán API, frontend, PostgreSQL y workers?

Las respuestas pueden cambiar componentes concretos, pero no invalidan la
arquitectura base. La decisión más importante es Shared Drive versus OAuth con
cuenta humana; debe cerrarse antes de la Fase 3.

## 13. Definición de “100% funcional” para el MVP

Se considera listo cuando:

- Los tres roles inician y cierran sesión con permisos verificables.
- Los catálogos y asignaciones persisten en PostgreSQL.
- Coordinador/admin suben fotos y videos reales con progreso y reintento.
- Admin modera y sólo lo aprobado se publica.
- Familia ve únicamente colegios autorizados.
- Preview, video y descargas pasan siempre por autorización del backend.
- No hay archivos públicos en Drive ni secretos en el repositorio.
- Existen migraciones, seeds, tests críticos, logs, health checks, backup y
  procedimiento de restauración.
- El sistema se despliega de forma repetible en staging y producción.
