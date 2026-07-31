import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { transaction } from './db.js';
import { paths } from './config.js';
import { getStorage } from './storage.js';

const watermarkPath = fileURLToPath(new URL('./assets/marca_agua.png', import.meta.url));
const MAX_ATTEMPTS = 3;
let running = false;
let timer: NodeJS.Timeout | undefined;
type Job = { id:string; attempts:number; media_asset_id:string; drive_file_id:string; mime_type:string; original_name:string; kind:'IMAGE'|'VIDEO'; version_number:number; departure_folder:string; lot_folder:string; };
const safeName=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/-+/g,'-').replace(/^[-.]+|[-.]+$/g,'') || 'archivo';
const outputName=(name:string,extension:string)=>safeName(name).replace(/\.[^.]+$/,'')+'-recrear.'+extension;
const tempFile=(suffix:string)=>path.join(paths.uploads,'watermark-'+crypto.randomUUID()+suffix);
function runFfmpeg(input:string,output:string){const filter="[1:v][0:v]scale2ref=w='min(220,max(72,main_w*0.12))':h=-1[wm][base];[base][wm]overlay=x=W-w-W*0.025:y=H-h-H*0.025";return new Promise<void>((resolve,reject)=>{const child=spawn('ffmpeg',['-y','-i',input,'-i',watermarkPath,'-filter_complex',filter,'-map','0:v:0','-map','0:a?','-c:v','libx264','-crf','18','-preset','medium','-c:a','aac','-movflags','+faststart',output],{stdio:['ignore','ignore','pipe']});let error='';child.stderr.on('data',chunk=>{error+=String(chunk);});child.on('error',reject);child.on('close',code=>code===0?resolve():reject(new Error('FFmpeg no pudo crear el video marcado ('+code+'): '+error.slice(-500))));});}
async function watermarkImage(input:string,mime:string){const normalized=sharp(input).rotate();const metadata=await normalized.metadata();const width=metadata.width,height=metadata.height;if(!width||!height)throw new Error('No se pudieron leer las dimensiones de la imagen');const watermarkWidth=Math.max(72,Math.min(220,Math.round(width*.12)));const mark=await sharp(watermarkPath).resize({width:watermarkWidth,withoutEnlargement:true}).png().toBuffer();const markMeta=await sharp(mark).metadata();const margin=Math.max(8,Math.round(width*.025));const target=tempFile(mime==='image/png'?'.png':'.jpg');const composed=sharp(input).rotate().composite([{input:mark,left:Math.max(0,width-(markMeta.width??watermarkWidth)-margin),top:Math.max(0,height-(markMeta.height??watermarkWidth)-margin)}]);if(mime==='image/png')await composed.png({compressionLevel:9}).toFile(target);else await composed.jpeg({quality:92,chromaSubsampling:'4:4:4'}).toFile(target);return {path:target,mimeType:mime==='image/png'?'image/png':'image/jpeg',name:outputName(path.basename(input),mime==='image/png'?'png':'jpg')};}
export async function processLocalMedia(input: string, kind: 'IMAGE'|'VIDEO', originalName: string, mimeType: string) {
  console.time(`Watermark ${originalName}`);
  try {
    if (kind === 'VIDEO') {
      const output = tempFile('.mp4');
      await runFfmpeg(input, output);
      return { path: output, mimeType: 'video/mp4', name: outputName(originalName, 'mp4') };
    } else {
      const rendered = await watermarkImage(input, mimeType);
      return { path: rendered.path, mimeType: rendered.mimeType, name: outputName(originalName, rendered.mimeType === 'image/png' ? 'png' : 'jpg') };
    }
  } finally {
    console.timeEnd(`Watermark ${originalName}`);
  }
}
