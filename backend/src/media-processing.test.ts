import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { afterEach, describe, expect, it } from 'vitest';

process.env.DATABASE_URL ??= 'postgres://test:test@localhost:5432/test';
const { paths } = await import('./config.js');
const { createThumbnail } = await import('./media-processing.js');

const files: string[] = [];
afterEach(async () => {
  await Promise.all(files.splice(0).map(file => fs.rm(file, { force: true }).catch(() => undefined)));
});

describe('createThumbnail', () => {
  it('creates a bounded WebP preview without modifying the source', async () => {
    await fs.mkdir(paths.uploads, { recursive: true });
    const source = path.join(paths.uploads, `thumbnail-test-${Date.now()}.jpg`);
    files.push(source);
    await sharp({ create: { width: 1600, height: 1000, channels: 3, background: '#336699' } }).jpeg({ quality: 95 }).toFile(source);

    const thumbnail = await createThumbnail(source, 'IMAGE', 'foto.jpg');
    expect(thumbnail).toBeDefined();
    files.push(thumbnail!.path);
    const metadata = await sharp(thumbnail!.path).metadata();
    expect(thumbnail!.mimeType).toBe('image/webp');
    expect(metadata.format).toBe('webp');
    expect(metadata.width).toBeLessThanOrEqual(640);
    expect(metadata.height).toBeLessThanOrEqual(640);
    await expect(fs.stat(source)).resolves.toBeDefined();
  });

});
