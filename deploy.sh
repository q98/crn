#!/bin/bash

# SHP Management Platform Deployment Script for 104.236.92.131
# This script sets up the application on the production server

set -e  # Exit on any error

echo "🚀 Starting SHP Management Platform deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
APP_DIR="/var/www/shp-management-platform"
SERVICE_NAME="shp-platform"
USER="www-data"
PORT=3000

echo -e "${YELLOW}📋 Deployment Configuration:${NC}"
echo "  Server: 104.236.92.131"
echo "  App Directory: $APP_DIR"
echo "  Port: $PORT"
echo "  User: $USER"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}❌ Please run this script as root (use sudo)${NC}"
    exit 1
fi

# Update system packages
echo -e "${YELLOW}📦 Updating system packages...${NC}"
apt update && apt upgrade -y

# Install Node.js 18.x if not installed
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}📦 Installing Node.js 18.x...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs
else
    echo -e "${GREEN}✅ Node.js is already installed: $(node --version)${NC}"
fi

# Install PM2 globally if not installed
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}📦 Installing PM2...${NC}"
    npm install -g pm2
else
    echo -e "${GREEN}✅ PM2 is already installed: $(pm2 --version)${NC}"
fi

# Create application directory
echo -e "${YELLOW}📁 Creating application directory...${NC}"
mkdir -p $APP_DIR
chown -R $USER:$USER $APP_DIR

# Copy application files
echo -e "${YELLOW}📋 Copying application files...${NC}"
cp -r . $APP_DIR/
chown -R $USER:$USER $APP_DIR

# Switch to app directory
cd $APP_DIR

# Install dependencies
echo -e "${YELLOW}📦 Installing dependencies...${NC}"
sudo -u $USER npm ci --only=production

# Copy production environment file
echo -e "${YELLOW}⚙️ Setting up environment...${NC}"
if [ -f ".env.production" ]; then
    sudo -u $USER cp .env.production .env
    echo -e "${GREEN}✅ Production environment file copied${NC}"
else
    echo -e "${RED}❌ .env.production file not found!${NC}"
    exit 1
fi

# Generate secure secrets
echo -e "${YELLOW}🔐 Generating secure secrets...${NC}"
NEXTAUTH_SECRET=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)

# Update environment file with secure secrets
sed -i "s/your-secure-nextauth-secret-key-change-this-immediately/$NEXTAUTH_SECRET/g" .env
sed -i "s/change-this-to-a-secure-32-byte-key-in-production/$ENCRYPTION_KEY/g" .env

echo -e "${GREEN}✅ Secure secrets generated and updated${NC}"

# Set up database
echo -e "${YELLOW}🗄️ Setting up database...${NC}"
sudo -u $USER npx prisma generate
sudo -u $USER npx prisma migrate deploy

# Seed database with admin user
echo -e "${YELLOW}👤 Creating admin user...${NC}"
sudo -u $USER node scripts/create-admin.js

# Build the application
echo -e "${YELLOW}🔨 Building application...${NC}"
sudo -u $USER npm run build

# Create PM2 ecosystem file
echo -e "${YELLOW}⚙️ Creating PM2 configuration...${NC}"
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: '$SERVICE_NAME',
    script: 'npm',
    args: 'start',
    cwd: '$APP_DIR',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: $PORT
    },
    error_file: '/var/log/shp-platform-error.log',
    out_file: '/var/log/shp-platform-out.log',
    log_file: '/var/log/shp-platform.log',
    time: true,
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    max_memory_restart: '1G'
  }]
};
EOF

chown $USER:$USER ecosystem.config.js

# Start application with PM2
echo -e "${YELLOW}🚀 Starting application...${NC}"
sudo -u $USER pm2 start ecosystem.config.js
sudo -u $USER pm2 save

# Set up PM2 to start on boot
echo -e "${YELLOW}⚙️ Setting up auto-start...${NC}"
env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp /var/www
systemctl enable pm2-$USER

# Configure firewall
echo -e "${YELLOW}🔥 Configuring firewall...${NC}"
ufw allow $PORT/tcp
ufw allow ssh
ufw --force enable

# Create nginx configuration (optional)
echo -e "${YELLOW}🌐 Creating Nginx configuration...${NC}"
cat > /etc/nginx/sites-available/shp-platform << EOF
server {
    listen 80;
    server_name 104.236.92.131;

    location / {
        proxy_pass http://localhost:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

# Enable nginx site
if command -v nginx &> /dev/null; then
    ln -sf /etc/nginx/sites-available/shp-platform /etc/nginx/sites-enabled/
    nginx -t && systemctl reload nginx
    echo -e "${GREEN}✅ Nginx configuration created and enabled${NC}"
else
    echo -e "${YELLOW}⚠️ Nginx not installed. Install it manually if you want reverse proxy${NC}"
fi

# Display deployment summary
echo -e "\n${GREEN}🎉 Deployment completed successfully!${NC}"
echo -e "\n${YELLOW}📋 Deployment Summary:${NC}"
echo "  🌐 Application URL: http://104.236.92.131:$PORT"
echo "  📁 Application Directory: $APP_DIR"
echo "  👤 Default Admin Login:"
echo "     Email: admin@example.com"
echo "     Password: admin123"
echo "  🔧 PM2 Status: $(sudo -u $USER pm2 list | grep $SERVICE_NAME)"
echo "  📊 Logs: pm2 logs $SERVICE_NAME"
echo ""
echo -e "${YELLOW}🔧 Useful Commands:${NC}"
echo "  • Check status: pm2 status"
echo "  • View logs: pm2 logs $SERVICE_NAME"
echo "  • Restart app: pm2 restart $SERVICE_NAME"
echo "  • Stop app: pm2 stop $SERVICE_NAME"
echo "  • Monitor: pm2 monit"
echo ""
echo -e "${RED}⚠️ IMPORTANT SECURITY NOTES:${NC}"
echo "  1. Change the default admin password immediately"
echo "  2. Set up SSL/TLS certificates for production"
echo "  3. Configure proper firewall rules"
echo "  4. Set up regular database backups"
echo "  5. Monitor application logs regularly"
echo ""
echo -e "${GREEN}✅ SHP Management Platform is now running on 104.236.92.131:$PORT${NC}"