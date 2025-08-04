module.exports = {
  apps: [{
    name: 'shp-management-platform',
    script: 'npm',
    args: 'start',
    cwd: '/var/www/shp-management-platform',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000,
      DATABASE_URL: 'file:./production.db'
    },
    // Logging
    error_file: '/var/log/shp-platform-error.log',
    out_file: '/var/log/shp-platform-out.log',
    log_file: '/var/log/shp-platform.log',
    time: true,
    
    // Restart policy
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    max_memory_restart: '1G',
    
    // Health monitoring
    watch: false,
    ignore_watch: ['node_modules', 'logs', '*.log'],
    
    // Advanced settings
    kill_timeout: 5000,
    wait_ready: true,
    listen_timeout: 10000,
    
    // Environment specific
    node_args: '--max-old-space-size=1024'
  }],
  
  deploy: {
    production: {
      user: 'root',
      host: '104.236.92.131',
      ref: 'origin/main',
      repo: 'git@github.com:your-username/shp-management-platform.git',
      path: '/var/www/shp-management-platform',
      'pre-deploy-local': '',
      'post-deploy': 'npm ci --only=production && npx prisma generate && npx prisma migrate deploy && npm run build && pm2 reload ecosystem.config.js --env production',
      'pre-setup': 'apt update && apt install -y nodejs npm'
    }
  }
};