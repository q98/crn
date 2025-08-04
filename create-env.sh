#!/bin/bash

# Environment File Generator for SHP Management Platform
# Creates .env file with secure secrets for 104.236.92.131

set -e

echo "🔧 Creating environment file for 104.236.92.131..."

# Generate secure secrets
echo "🔐 Generating secure secrets..."
NEXTAUTH_SECRET=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)

# Create .env file
cat > .env << EOF
# Environment variables for SHP Management Platform
# Generated on $(date)
# Server: 104.236.92.131

# Database connection string
DATABASE_URL="file:./production.db"

# NextAuth.js Configuration
NEXTAUTH_SECRET="$NEXTAUTH_SECRET"
NEXTAUTH_URL="http://104.236.92.131:3000"

# Encryption key for credential vault (32 bytes for AES-256)
ENCRYPTION_KEY="$ENCRYPTION_KEY"

# IP2WHOIS API Configuration (optional)
IP2WHOIS_API_KEY="your-ip2whois-api-key-here"
IP2WHOIS_API_URL="https://api.ip2whois.com/v2"

# Production settings
NODE_ENV="production"
PORT=3000

# Security
SECURE_COOKIES=true
HTTPS_ONLY=false

# Logging
LOG_LEVEL="info"
EOF

echo "✅ Environment file created successfully!"
echo "📁 File: .env"
echo "🌐 Server: 104.236.92.131:3000"
echo "🔐 Secrets generated and configured"
echo ""
echo "⚠️  Keep these secrets secure and never commit them to version control!"
echo ""
echo "🚀 You can now deploy with: ./quick-deploy.sh"