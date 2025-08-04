# Quick Deployment to 104.236.92.131

## Simple Setup

1. **Upload files to server:**
   ```bash
   scp -r . root@104.236.92.131:/tmp/shp-platform
   ```

2. **SSH into server:**
   ```bash
   ssh root@104.236.92.131
   ```

3. **Run deployment script:**
   ```bash
   cd /tmp/shp-platform
   chmod +x quick-deploy.sh
   ./quick-deploy.sh
   ```

## Access Your App

- **URL:** http://104.236.92.131:3000
- **Login:** admin@example.com
- **Password:** admin123

## Management Commands

```bash
# Check status
pm2 status

# View logs
pm2 logs shp-platform

# Restart app
pm2 restart shp-platform

# Stop app
pm2 stop shp-platform
```

## Alternative: Docker Method

If you prefer Docker:

```bash
# Build and run
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

That's it! Your SHP Management Platform will be running on 104.236.92.131:3000