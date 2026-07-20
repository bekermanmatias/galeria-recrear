# Google Drive: credenciales y transición a producción

La aplicación mantiene los archivos privados en Drive y guarda solamente sus
IDs en PostgreSQL. El frontend nunca recibe enlaces públicos de Google Drive.

## Desarrollo o staging: carpeta de una cuenta personal

Usar una cuenta exclusiva para la galería, no la cuenta personal de un miembro
del equipo. Esa cuenta será propietaria de los archivos y consumirá su cuota de
Drive. La cuenta gratuita suele tener 15 GB compartidos entre Drive, Gmail y
Google Fotos, por lo que es una alternativa temporal, especialmente si se
cargan videos.

### 1. Crear la carpeta raíz e identificarla

1. Ingresar con la cuenta técnica de la galería a Google Drive.
2. Crear la carpeta `Galeria-Recrear`.
3. Abrirla y copiar el texto que aparece después de `/folders/` en su URL.

Ejemplo:

```text
https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOp
                                            ^^^^^^^^^^^^^^^
```

Ese valor es `DRIVE_ROOT_FOLDER_ID`. No compartir públicamente la carpeta ni
sus archivos.

### 2. Crear las credenciales OAuth

1. Abrir [Google Cloud Console](https://console.cloud.google.com/).
2. Crear un proyecto, por ejemplo `galeria-recrear-staging`.
3. En **APIs y servicios > Biblioteca**, habilitar **Google Drive API**.
4. En **APIs y servicios > Pantalla de consentimiento OAuth**, configurar la
   aplicación. Para pruebas con Gmail, elegir audiencia externa y agregar la
   cuenta técnica como usuario de prueba.
5. En **Credenciales > Crear credenciales > ID de cliente OAuth**, crear un
   cliente de tipo **Aplicación web**.
6. Agregar esta URI de redirección autorizada:

   ```text
   https://developers.google.com/oauthplayground
   ```

7. Copiar el **Client ID** y el **Client secret**. Corresponden a
   `GOOGLE_OAUTH_CLIENT_ID` y `GOOGLE_OAUTH_CLIENT_SECRET`.

### 3. Obtener el refresh token

1. Abrir [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/).
2. Abrir el engranaje, activar **Use your own OAuth credentials** y pegar el
   Client ID y Client secret creados antes.
3. En el panel izquierdo, ingresar el scope:

   ```text
   https://www.googleapis.com/auth/drive
   ```

4. Elegir **Authorize APIs**, iniciar sesión con la cuenta técnica y aceptar.
5. Elegir **Exchange authorization code for tokens**.
6. Copiar el valor `Refresh token`. Es `GOOGLE_OAUTH_REFRESH_TOKEN`.

El token permite al backend operar en nombre de esa cuenta. Tratarlo como una
contraseña: no incluirlo en Git, tickets, capturas ni chats. Si se revoca desde
la cuenta de Google, generar uno nuevo.

### 4. Configurar el entorno

En `backend/.env` para Docker local:

```env
MEDIA_STORAGE=drive
DRIVE_ROOT_FOLDER_ID=1AbCdEfGhIjKlMnOp

GOOGLE_APPLICATION_CREDENTIALS=
GOOGLE_SERVICE_ACCOUNT_JSON=

GOOGLE_OAUTH_CLIENT_ID=...apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=...
GOOGLE_OAUTH_REFRESH_TOKEN=...
```

No configurar al mismo tiempo credenciales OAuth y de cuenta de servicio. Tras
guardar el archivo, recrear el backend:

```powershell
docker compose up -d backend
```

La primera carga creará automáticamente la jerarquía de carpetas debajo de la
carpeta raíz.

> Si la pantalla OAuth permanece en modo de prueba, Google puede requerir
> reautorizar credenciales de prueba periódicamente. No usar esta configuración
> como solución definitiva de producción.

## Producción: Google Workspace Shared Drive

En producción se reemplaza OAuth de usuario por una cuenta de servicio sobre
un Shared Drive institucional. Así los archivos no quedan atados a una persona
y la organización conserva propiedad, cuota y recuperación de acceso.

1. Crear el Shared Drive institucional y la carpeta raíz `Galeria-Recrear`.
2. Crear o seleccionar el proyecto Google Cloud de la empresa y habilitar
   Google Drive API.
3. Crear una cuenta de servicio y agregar su email al Shared Drive con el rol
   **Content manager / Administrador de contenido** como mínimo.
4. Crear su clave JSON y guardarla en un gestor de secretos del entorno de
   producción, nunca en el repositorio.
5. Cambiar las variables por:

```env
MEDIA_STORAGE=drive
DRIVE_ROOT_FOLDER_ID=id-de-la-carpeta-raiz-del-shared-drive

GOOGLE_APPLICATION_CREDENTIALS=
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}

GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
GOOGLE_OAUTH_REFRESH_TOKEN=
```

6. Desplegar y realizar una carga de prueba con un coordinador. Verificar
   carga, preview, reproducción, descarga individual, ZIP y purga.

La aplicación detecta una configuración mixta y no inicia el almacenamiento de
Drive si se informan ambos métodos de autenticación.

## Referencias oficiales

- [Autenticación y propiedad de archivos](https://developers.google.com/workspace/drive/api/guides/create-file)
- [Shared Drives y cuentas de servicio](https://developers.google.com/workspace/drive/api/guides/about-shareddrives)
- [Scopes de Drive API](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)
- [OAuth para aplicaciones web](https://developers.google.com/identity/protocols/oauth2/web-server)
