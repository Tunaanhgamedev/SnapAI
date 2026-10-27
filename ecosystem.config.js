// ============================================================================
// PM2 Production Process Manager Configuration
// Run with: pm2 start ecosystem.config.js
// ============================================================================
module.exports = {
  apps: [
    {
      name: 'snapbunny-backend',
      script: './backend/server.js',
      instances: 'max', // Auto-scale to all available CPU cores
      exec_mode: 'cluster',
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 5000
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 5000
      }
    }
  ]
};
