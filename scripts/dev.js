const { spawn } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');

function getAvailablePort(startPort) {
  return new Promise((resolve, reject) => {
    const tryPort = (port) => {
      const tester = net.createServer();

      tester.once('error', (error) => {
        if (error.code === 'EADDRINUSE') {
          return tryPort(port + 1);
        }

        tester.close(() => reject(error));
      });

      tester.once('listening', () => {
        tester.close(() => resolve(port));
      });

      tester.listen(port);
    };

    tryPort(startPort);
  });
}

async function main() {
  const apiPort = await getAvailablePort(Number(process.env.PORT || 5000));

  const server = spawn('npm run dev --prefix server', {
    cwd: rootDir,
    shell: true,
    stdio: 'inherit',
    env: { ...process.env, PORT: String(apiPort) }
  });

  const client = spawn('npm run dev --prefix client -- --host 0.0.0.0', {
    cwd: rootDir,
    shell: true,
    stdio: 'inherit',
    env: {
      ...process.env,
      PORT: String(apiPort),
      VITE_API_TARGET: `http://localhost:${apiPort}`
    }
  });

  const shutdown = () => {
    server.kill('SIGINT');
    client.kill('SIGINT');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  server.on('exit', (code) => {
    if (code !== 0 && !client.killed) {
      client.kill('SIGINT');
      process.exit(code ?? 1);
    }
  });

  client.on('exit', (code) => {
    if (code !== 0 && !server.killed) {
      server.kill('SIGINT');
      process.exit(code ?? 1);
    }
  });
}

main().catch((error) => {
  console.error('Unable to start the application stack:', error);
  process.exitCode = 1;
});
