#!/bin/bash

# Quick Deploy Script for SHP Management Platform on 104.236.92.131
# Simple setup to get the app running fast

set -e

echo "🚀 Quick deploying SHP Management Platform to 104.236.92.131..."

# Update system
sudo apt update

# Install Node.js 18 if not present
if ! command -v node &> /dev/null; then
    echo "📦 Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# Install PM2 globally
sudo npm install -g pm2

# Create app directory
sudo mkdir -p /var/www/shp-platform
sudo chown -R $USER:$USER /var/www/shp-platform

# Copy files
cp -r . /var/www/shp-platform/
cd /var/www/shp-platform

# Install dependencies
npm install

# Setup environment
cp .env.production .env

# Update environment for the IP
sed -i 's/http:\/\/localhost:3002/http:\/\/104.236.92.131:3000/g' .env
sed -i 's/your-secure-nextauth-secret-key-change-this-immediately/shp-secret-$(date +%s)/g' .env
sed -i 's/change-this-to-a-secure-32-byte-key-in-production/shp-encrypt-key-$(date +%s)/g' .env

# Setup database
npx prisma generate
npx prisma migrate deploy

# Create admin user
node scripts/create-admin.js

# Build app
npm run build

# Start with PM2
pm2 start npm --name "shp-platform" -- start
pm2 save
pm2 startup

# Open firewall
sudo ufw allow 3000

echo "✅ App is running on http://104.236.92.131:3000"
echo "📧 Login: admin@example.com"
echo "🔑 Password: admin123"
echo "📊 Monitor: pm2 monit"