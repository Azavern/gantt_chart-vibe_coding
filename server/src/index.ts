import { createApp } from './app';
import { loadConfig } from './config';

function main(): void {
  const config = loadConfig();
  const app = createApp();

  app.listen(config.port, () => {
    console.log(`Server berjalan di http://localhost:${config.port} (health: /api/health)`);
  });
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Gagal menjalankan server: ${message}`);
  process.exit(1);
}
