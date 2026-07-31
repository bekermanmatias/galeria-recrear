import { createApp } from './app.js';
import { config } from './config.js';
import { startWatermarkWorker } from './media-processing.js';

const app = createApp();
app.listen(config.PORT, () => console.log(`Galería Recrear API listening on ${config.PORT}`));
