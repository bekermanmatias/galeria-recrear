import { createApp } from './app.js';
import { config } from './config.js';
import { startMediaProcessingWorker } from './media-processing.js';

const app = createApp();
startMediaProcessingWorker();
app.listen(config.PORT, () => console.log(`Galería Recrear API listening on ${config.PORT}`));
