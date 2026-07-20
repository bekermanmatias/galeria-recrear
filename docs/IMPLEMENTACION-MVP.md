# Implementación del MVP

## Hecho

- API TypeScript con sesiones por cookie, roles y autorización por colegio.
- Migración PostgreSQL para usuarios, colegios, catálogos, excepciones por
  colegio, lotes, versiones, medios, auditoría y sesiones.
- Lote único por contexto con versiones: una reapertura no interrumpe la última
  publicación familiar.
- Subida JPEG, PNG, HEIC, MP4 y MOV; validación de tipo y checksum SHA-256.
- Moderación, recuperación de descartes y script de purga tras 30 días.
- Adaptadores de almacenamiento local y Google Drive Shared Drive.
- Streaming privado, soporte `Range` y descarga ZIP autorizada.
- CSV para colegios, usuarios y asignaciones, con preview y commit atómico.
- Portal de login, carga, moderación, galería familiar y descargas conectados a
  la API.

## Pendiente de infraestructura

- Crear el Shared Drive, carpeta raíz y cuenta de servicio reales.
- Registrar secretos de staging: PostgreSQL, sesión y credencial Drive.
- Definir un scheduler que ejecute `tsx src/scripts/purge-rejected.ts` cada día.
- Configurar un hosting de staging con HTTPS y backups de PostgreSQL.

## Preparación futura de WhatsApp

El esquema registra `source` y `external_reference` en versiones de lote. El
bot podrá presentar las opciones de colegio, turno y actividad y enviar sus
tres códigos resueltos a una futura entrada de ingestión. n8n y el webhook no
forman parte de este MVP.
