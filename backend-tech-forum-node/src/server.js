require('dotenv').config();
const { app, prisma } = require('./app');

const port = Number(process.env.PORT || 1337);
const host = process.env.HOST || '0.0.0.0';
const server = app.listen(port, host, () => {
  console.log(`Tech Forum API listening at http://localhost:${port}`);
});

async function shutdown(signal) {
  console.log(`\n${signal} received. Shutting down Tech Forum API...`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
