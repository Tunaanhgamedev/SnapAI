// ============================================================================
// Multi-Core Cluster Launcher
// Scales SnapAI across all CPU cores on VPS/Servers for maximum concurrency
// ============================================================================
const cluster = require('cluster');
const os = require('os');

const numCPUs = process.env.WORKERS
  ? parseInt(process.env.WORKERS, 10)
  : Math.min(os.cpus().length, 8); // Max 8 workers by default

if (cluster.isPrimary || cluster.isMaster) {
  console.log('');
  console.log('  ╔══════════════════════════════════════════════════════╗');
  console.log(`  ║  ⚡ SnapBunny.ai Cluster Manager (Master PID: ${process.pid})   ║`);
  console.log(`  ║  Khởi chạy ${numCPUs} Worker Processes trên ${os.cpus().length} CPU Cores...     ║`);
  console.log('  ╚══════════════════════════════════════════════════════╝');
  console.log('');

  // Fork workers
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  // Auto-healing: revive worker if it crashes
  cluster.on('exit', (worker, code, signal) => {
    console.warn(`[Cluster Warning] Worker PID ${worker.process.pid} exited (Code: ${code}, Signal: ${signal}). Auto-restarting...`);
    cluster.fork();
  });
} else {
  // Workers share the TCP connection and port 5000
  require('./server.js');
}
