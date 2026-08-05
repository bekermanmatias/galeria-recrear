import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { createReadStream, createWriteStream, existsSync } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import { google } from 'googleapis';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { config, paths } from './config.js';
import { AppError } from './errors.js';

export interface FolderContext { departureFolder: string; lotFolder: string; version: number; }
export interface UploadInput { path: string; filename: string; mimeType: string; parentId: string; }
export interface RemoteStream { stream: NodeJS.ReadableStream; mimeType?: string; size?: number; totalSize?: number; status: number; contentRange?: string; }
export interface MediaStorage {
  createVersionFolder(context: FolderContext, contentFolder?: 'originales' | 'marcados'): Promise<string>;
  uploadOriginal(input: UploadInput): Promise<string>;
  download(fileId: string, target: string): Promise<void>;
  stream(fileId: string, range?: string): Promise<RemoteStream>;
  trash(fileId: string): Promise<void>;
}
const ensureDirectory = (directory: string) => fs.mkdir(directory, { recursive: true });
function safeLocalPath(fileId: string) { const file = path.resolve(paths.localMedia, fileId); if (!file.startsWith(path.resolve(paths.localMedia))) throw new AppError(400,'INVALID_FILE','Archivo invalido'); return file; }
function parseRange(header: string | undefined, total: number) { if (!header) return null; const match = /^bytes=(\d*)-(\d*)$/i.exec(header); if (!match) return null; const start = match[1] ? Number(match[1]) : 0; const end = match[2] ? Math.min(Number(match[2]), total - 1) : total - 1; if (!Number.isInteger(start) || !Number.isInteger(end) || start > end || start >= total) throw new AppError(416,'RANGE_NOT_SATISFIABLE','Rango de video invalido'); return { start, end }; }

class LocalStorage implements MediaStorage {
  async createVersionFolder(context: FolderContext, contentFolder: 'originales' | 'marcados' = 'originales') { const folder = path.join(paths.localMedia,'Salidas',context.departureFolder,context.lotFolder,`v${context.version}`,contentFolder); await ensureDirectory(folder); return folder; }
  async uploadOriginal(input: UploadInput) { const id=crypto.randomUUID(); await ensureDirectory(input.parentId); const target=path.join(input.parentId,id); await fs.copyFile(input.path,target); await fs.writeFile(`${target}.json`,JSON.stringify({mimeType:input.mimeType,filename:input.filename})); return path.relative(paths.localMedia,target); }
  async download(fileId: string, target: string) { await ensureDirectory(path.dirname(target)); await fs.copyFile(safeLocalPath(fileId), target); }
  async stream(fileId: string, range?: string): Promise<RemoteStream> { const target=safeLocalPath(fileId); if(!existsSync(target)) throw new AppError(404,'MEDIA_NOT_FOUND','Archivo no encontrado'); const metadata=JSON.parse(await fs.readFile(`${target}.json`,'utf8')) as {mimeType?:string}; const stat=await fs.stat(target); const parsed=parseRange(range,stat.size); if(parsed) return {stream:createReadStream(target,parsed),mimeType:metadata.mimeType,size:parsed.end-parsed.start+1,totalSize:stat.size,status:206,contentRange:`bytes ${parsed.start}-${parsed.end}/${stat.size}`}; return {stream:createReadStream(target),mimeType:metadata.mimeType,size:stat.size,totalSize:stat.size,status:200}; }
  async trash(fileId: string) { const target=safeLocalPath(fileId); if(existsSync(target)) await fs.rm(target,{force:true}); if(existsSync(`${target}.json`)) await fs.rm(`${target}.json`,{force:true}); }
}

class GoogleDriveStorage implements MediaStorage {
  private drive;
  constructor() {
    if(!config.DRIVE_ROOT_FOLDER_ID) throw new Error('DRIVE_ROOT_FOLDER_ID es obligatorio para MEDIA_STORAGE=drive');
    const credentials=config.GOOGLE_SERVICE_ACCOUNT_JSON?JSON.parse(config.GOOGLE_SERVICE_ACCOUNT_JSON):undefined;
    const hasServiceAccount=Boolean(credentials || config.GOOGLE_APPLICATION_CREDENTIALS);
    const hasOAuth=Boolean(config.GOOGLE_OAUTH_CLIENT_ID && config.GOOGLE_OAUTH_CLIENT_SECRET && config.GOOGLE_OAUTH_REFRESH_TOKEN);
    if (hasServiceAccount && hasOAuth) throw new Error('Configura una cuenta de servicio o OAuth de usuario, no ambas');
    if (!hasServiceAccount && !hasOAuth) throw new Error('Faltan credenciales de Google Drive');
    const auth=hasOAuth ? (() => { const oauth=new google.auth.OAuth2(config.GOOGLE_OAUTH_CLIENT_ID,config.GOOGLE_OAUTH_CLIENT_SECRET); oauth.setCredentials({refresh_token:config.GOOGLE_OAUTH_REFRESH_TOKEN}); return oauth; })() : new google.auth.GoogleAuth({credentials,keyFile:config.GOOGLE_APPLICATION_CREDENTIALS,scopes:['https://www.googleapis.com/auth/drive']});
    this.drive=google.drive({version:'v3',auth});
  }
  private driveFailure(error: unknown): never { const remote = error as { code?: number; response?: { status?: number } }; const status = remote.response?.status ?? remote.code; if (status === 401 || status === 403) throw new AppError(503,'DRIVE_AUTH_ERROR','Google Drive rechazo las credenciales.'); throw error; }
  private async childFolder(parentId:string,name:string) { try { const found=await this.drive.files.list({q:`'${parentId}' in parents and name = '${name.replace(/'/g,"\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,fields:'files(id)',supportsAllDrives:true,includeItemsFromAllDrives:true}); if(found.data.files?.[0]?.id)return found.data.files[0].id; const created=await this.drive.files.create({requestBody:{name,mimeType:'application/vnd.google-apps.folder',parents:[parentId]},fields:'id',supportsAllDrives:true}); if(!created.data.id)throw new Error('Drive no devolvio el ID de carpeta'); return created.data.id; } catch (error) { return this.driveFailure(error); } }
  async createVersionFolder(context:FolderContext, contentFolder: 'originales' | 'marcados' = 'originales') { let folder=config.DRIVE_ROOT_FOLDER_ID!; for(const name of ['Salidas',context.departureFolder,context.lotFolder,`v${context.version}`,contentFolder]) folder=await this.childFolder(folder,name); return folder; }
  async uploadOriginal(input:UploadInput) { try { const created=await this.drive.files.create({requestBody:{name:input.filename,parents:[input.parentId]},media:{mimeType:input.mimeType,body:createReadStream(input.path)},fields:'id',supportsAllDrives:true}); if(!created.data.id)throw new Error('Drive no devolvio el ID de archivo'); return created.data.id; } catch(error) { return this.driveFailure(error); } }
  async download(fileId:string,target:string) { try { await ensureDirectory(path.dirname(target)); const response=await this.drive.files.get({fileId,alt:'media',supportsAllDrives:true},{responseType:'stream'}); await pipeline(response.data as NodeJS.ReadableStream, createWriteStream(target)); } catch(error) { return this.driveFailure(error); } }
  async stream(fileId:string,range?:string):Promise<RemoteStream> { try { const meta=await this.drive.files.get({fileId,fields:'mimeType,size',supportsAllDrives:true}); const response=await this.drive.files.get({fileId,alt:'media',supportsAllDrives:true},{responseType:'stream',headers:range?{Range:range}:undefined}); const contentRange=String(response.headers['content-range'] ?? ''); const total=meta.data.size?Number(meta.data.size):undefined; const size=Number(response.headers['content-length'] ?? total); const isPartial=response.status===206 && Boolean(contentRange); return {stream:response.data,mimeType:meta.data.mimeType ?? undefined,size,totalSize:total,status:isPartial?206:200,contentRange:isPartial?contentRange:undefined}; } catch(error) { return this.driveFailure(error); } }
  async trash(fileId:string) { try { await this.drive.files.update({fileId,requestBody:{trashed:true},supportsAllDrives:true}); } catch(error) { return this.driveFailure(error); } }
}

class S3Storage implements MediaStorage {
  private client: S3Client;
  private bucket: string;

  constructor() {
    if (!config.S3_ENDPOINT || !config.S3_ACCESS_KEY || !config.S3_SECRET_KEY || !config.S3_BUCKET) {
      throw new Error('Faltan credenciales de S3/R2 en la configuración');
    }
    this.bucket = config.S3_BUCKET;
    this.client = new S3Client({
      endpoint: config.S3_ENDPOINT,
      region: 'auto',
      credentials: {
        accessKeyId: config.S3_ACCESS_KEY,
        secretAccessKey: config.S3_SECRET_KEY,
      },
    });
  }

  async createVersionFolder(context: FolderContext, contentFolder: 'originales' | 'marcados' = 'originales') {
    return `Salidas/${context.departureFolder}/${context.lotFolder}/v${context.version}/${contentFolder}`;
  }

  async uploadOriginal(input: UploadInput) {
    const id = crypto.randomUUID();
    const key = `${input.parentId}/${id}`;
    
    // Convert ASCII only for metadata filename
    const safeFilename = Buffer.from(input.filename, 'utf-8').toString('ascii');

    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: createReadStream(input.path),
      ContentType: input.mimeType,
      Metadata: {
        filename: safeFilename
      }
    }));
    return key;
  }

  async download(fileId: string, target: string) {
    await ensureDirectory(path.dirname(target));
    const response = await this.client.send(new GetObjectCommand({
      Bucket: this.bucket,
      Key: fileId
    }));
    
    if (!response.Body) throw new Error('Cuerpo de respuesta vacío desde S3');
    await pipeline(response.Body as NodeJS.ReadableStream, createWriteStream(target));
  }

  async stream(fileId: string, range?: string): Promise<RemoteStream> {
    try {
      const response = await this.client.send(new GetObjectCommand({
        Bucket: this.bucket,
        Key: fileId,
        Range: range
      }));

      if (!response.Body) throw new Error('Cuerpo de respuesta vacío desde S3');

      const isPartial = response.$metadata.httpStatusCode === 206;
      
      // Parse content length from ContentRange if partial, or use ContentLength
      let size = response.ContentLength ?? 0;
      let totalSize = size;
      
      if (isPartial && response.ContentRange) {
        const match = /\/(\d+)$/.exec(response.ContentRange);
        if (match) totalSize = Number(match[1]);
      }

      return {
        stream: response.Body as NodeJS.ReadableStream,
        mimeType: response.ContentType,
        size,
        totalSize,
        status: isPartial ? 206 : 200,
        contentRange: response.ContentRange
      };
    } catch (error: any) {
      if (error.name === 'NoSuchKey') {
        throw new AppError(404, 'MEDIA_NOT_FOUND', 'Archivo no encontrado');
      }
      throw error;
    }
  }

  async trash(fileId: string) {
    await this.client.send(new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: fileId
    }));
  }
}

let storage: MediaStorage | undefined;
export function getStorage():MediaStorage { if (!storage) storage=config.MEDIA_STORAGE==='s3'?new S3Storage():config.MEDIA_STORAGE==='drive'?new GoogleDriveStorage():new LocalStorage(); return storage; }
