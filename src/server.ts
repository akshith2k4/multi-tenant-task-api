import { buildApp } from './app';
import { config } from './config';
import { registerWorkers } from './plugins/queues';
import { startSchedulers } from './jobs/dispatcher';

async function main() {
  const app = await buildApp();
  const workers = registerWorkers();
  startSchedulers();
  await app.listen({ port: config.port, host: '0.0.0.0' });
  const shutdown = async () => {
    await app.close();
    await Promise.all(workers.map((worker) => worker.close()));
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
