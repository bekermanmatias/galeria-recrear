# Galería Recrear

Galería privada para cargar, moderar y consultar fotos y videos de viajes
escolares. El frontend usa Astro y React; la API usa Node.js, TypeScript,
Express y PostgreSQL. Los binarios se guardan en Google Workspace Shared Drive
en staging y producción.

## Inicio local

```bash
docker compose up --build
```

El arranque del backend aplica las migraciones y crea el administrador inicial:

- Portal: <http://localhost:4321>
- API health: <http://localhost:3001/api/health>
- Usuario: `admin@recrear.local`
- Contraseña: `change-me-now`

Cambiar esas credenciales antes de exponer cualquier entorno compartido.

En desarrollo Docker usa almacenamiento local (`MEDIA_STORAGE=local`) para que
se pueda probar el flujo sin credenciales externas. No se debe usar ese modo en
staging o producción.

## Configurar Google Shared Drive

1. Crear un Shared Drive institucional y una carpeta raíz `Galeria-Recrear`.
2. Habilitar Google Drive API en un proyecto de Google Cloud.
3. Crear una cuenta de servicio y agregarla al Shared Drive con el permiso
   mínimo para crear y administrar archivos.
4. Configurar `MEDIA_STORAGE=drive`, `DRIVE_ROOT_FOLDER_ID` y una de
   `GOOGLE_SERVICE_ACCOUNT_JSON` o `GOOGLE_APPLICATION_CREDENTIALS`.
5. Configurar una URL segura de frontend, secreto de sesión fuerte y PostgreSQL
   gestionado para staging.

La API guarda IDs de Drive, no enlaces públicos. Todo preview, reproducción y
descarga pasa por autorización de la API.

## Comandos de backend

```bash
cd backend
npm run migrate
npm run seed
npm run build
npm test
```

La especificación funcional original está en
[docs/PLAN-FUNCIONAL.md](docs/PLAN-FUNCIONAL.md).

