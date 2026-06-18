# AuraOS — AWS EC2 Production Deployment Guide

## Architecture Overview

```
Internet
  │
  │  :443 (HTTPS) / :80 (HTTP)
  ▼
┌──────────────────────────────────────────────┐
│  AWS EC2  •  Ubuntu 24.04 LTS  •  t3.medium  │
│                                              │
│  ┌──────────────────────────────────────┐    │
│  │  Nginx Reverse Proxy  (:80)          │    │
│  │  • SSL termination (via certbot)     │    │
│  │  • Security headers                  │    │
│  │  • Gzip compression                  │    │
│  │  • /api/* → backend:3000             │    │
│  │  • /socket.io/* → backend:3000 (WS)  │    │
│  │  • /* → frontend:80                  │    │
│  └──────┬──────────────┬────────────────┘    │
│         │              │                     │
│  ┌──────▼──────┐  ┌───▼──────────────┐      │
│  │  Frontend   │  │  Backend (:3000)  │      │
│  │  (nginx:80) │  │  Node.js + TS     │      │
│  │  React SPA  │  │  Express API      │      │
│  └─────────────┘  └──────┬───────────┘      │
│                          │                   │
│                   ┌──────▼───────────┐      │
│                   │  PostgreSQL 15   │      │
│                   │  (internal only) │      │
│                   └──────────────────┘      │
└──────────────────────────────────────────────┘
```

## Why This Architecture?

### Why Nginx Is the Only Public Entry Point

**Single attack surface.** Only one container binds to host ports. Every request — whether it's an API call, WebSocket connection, or static asset — passes through the same nginx instance. This means:

1. **Security headers are applied uniformly.** `X-Frame-Options`, `Content-Security-Policy`, `X-Content-Type-Options`, and all other headers are added once in [`nginx/nginx.conf`](../../nginx/nginx.conf) and apply to every response.
2. **Rate limiting can be added in one place.** If you add `limit_req` or `limit_conn` directives, they protect all backend services without changing any application code.
3. **SSL termination happens once.** Certbot/LetsEncrypt certificates are configured in a single nginx server block. No need to manage TLS in Node.js or the frontend nginx.

### Why Backend Has No Public Ports

The backend container exposes port 3000 **only on the internal Docker network**, not to the host. In [`docker-compose.yml`](../../docker-compose.yml), the backend service has no `ports:` directive — only the nginx service has `ports: - "80:80"`.

- **Prevents direct access bypass.** An attacker cannot hit `http://<ec2-ip>:3000/api/v1/admin` directly — they must go through the reverse proxy, which applies security headers and (in future) rate limiting.
- **CORS is simpler.** With only `http://localhost` (or your domain) as `CORS_ORIGIN`, there's no confusion about which origins are allowed.
- **No port conflicts.** Multiple backend instances could run on different internal ports without clashing.

### Why PostgreSQL Stays Internal

The `postgres` service in docker-compose has no host port mapping in production. The database is accessible **only** from the backend container via Docker's internal DNS (`postgres:5432`).

- **Zero attack surface.** No password brute-force attacks are possible from the internet because there is no network path to PostgreSQL.
- **No TLS needed for DB connections.** Traffic between backend and PostgreSQL never leaves the Docker bridge network, so it doesn't need to be encrypted (though SCRAM-SHA-256 authentication is still used).
- **Accidental exposure is impossible.** Even if `pg_hba.conf` were misconfigured to `trust` all connections, nobody outside Docker can reach the port.

> **Note:** The current [`docker-compose.yml`](../../docker-compose.yml) maps `5433:5432` for local development convenience. For production, either remove this port mapping or use a production-specific override file (see [Production Adjustments](#production-adjustments) below).

---

## Step 1: Create the EC2 Instance

### Instance Configuration

| Setting | Recommendation |
|---------|---------------|
| **AMI** | Ubuntu Server 24.04 LTS (HVM), SSD Volume Type |
| **Instance Type** | `t3.medium` (2 vCPU, 4 GB RAM) — good starting point |
| **Storage** | 30 GB gp3 (general purpose SSD) |
| **Key Pair** | Create or select an existing key pair for SSH access |

**Why t3.medium?** The four containers (nginx, frontend, backend, postgres) together use about 1-1.5 GB RAM at idle and 2-3 GB under load. t3.medium provides 4 GB with burstable CPU — enough headroom for the application plus system overhead. You can start with t3.small (2 GB) and scale up if needed.

### Security Group Rules

Create a security group named `auraos-production` with these **inbound** rules:

| Type | Protocol | Port | Source | Purpose |
|------|----------|------|--------|---------|
| SSH | TCP | 22 | `0.0.0.0/0` (or your office IP) | Administrative access |
| HTTP | TCP | 80 | `0.0.0.0/0` | Web traffic (redirects to HTTPS) |
| HTTPS | TCP | 443 | `0.0.0.0/0` | Secure web traffic |

**Do NOT add rules for ports 3000, 3001, 5432, or 5433.** These services run inside Docker and are not exposed to the host network. Adding these rules would create unnecessary attack surface.

**Outbound rules:** Leave the default (all traffic allowed). Docker needs outbound access to pull images, and the app may need to reach external APIs (payment gateways, email, WhatsApp).

> **Security best practice:** Restrict SSH (port 22) to your specific IP address or office CIDR range. Use `0.0.0.0/0` only temporarily — consider using AWS Systems Manager Session Manager for keyless, audited SSH access.

---

## Step 2: Connect via SSH

```bash
# Replace with your key path and EC2 public IP
ssh -i ~/.ssh/auraos-key.pem ubuntu@<ec2-public-ip>

# Or if using a specific SSH config entry:
ssh auraos-production
```

---

## Step 3: Install Docker & Docker Compose

```bash
# Update package list
sudo apt update && sudo apt upgrade -y

# Install prerequisites
sudo apt install -y ca-certificates curl gnupg lsb-release

# Add Docker's official GPG key
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Add Docker repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine + Docker Compose plugin
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io \
  docker-buildx-plugin docker-compose-plugin

# Add ubuntu user to docker group (no sudo needed for docker commands)
sudo usermod -aG docker $USER
newgrp docker

# Verify
docker --version         # Docker version 26.x or later
docker compose version    # Docker Compose version v2.x or later
```

**Why Docker Compose plugin (not standalone)?** The `docker compose` (v2) plugin is built into Docker Engine, receives updates alongside Docker, and uses the same Compose file format. The standalone `docker-compose` (v1) is deprecated.

---

## Step 4: Clone the Repository

```bash
# Clone into /opt/auraos (standard location for production apps)
sudo mkdir -p /opt/auraos
sudo chown $USER:$USER /opt/auraos
git clone https://github.com/your-org/auraos.git /opt/auraos
cd /opt/auraos
```

---

## Step 5: Configure Environment Variables

```bash
# Copy the production example
cp .env.production.example .env

# Edit .env with production values
nano .env
```

### Critical Variables to Change

| Variable | Production Value | Why |
|----------|-----------------|-----|
| `NODE_ENV` | `production` | Enables production optimizations, disables verbose errors |
| `JWT_SECRET` | Generate with `openssl rand -hex 64` | Must be at least 32 random characters |
| `JWT_REFRESH_SECRET` | Generate with `openssl rand -hex 64` | Must be at least 32 random characters |
| `DATABASE_URL` | (keep default) | Uses Docker internal DNS (`postgres:5432`) — no change needed |
| `CORS_ORIGIN` | `https://your-domain.com` | Must match your actual domain for CORS to work |
| `APP_URL` | `https://your-domain.com` | Used in password reset emails |
| `SMTP_*` | Real SMTP credentials | Required for password reset + email notifications |
| `SUPER_ADMIN_EMAILS` | Your email(s) | Comma-separated list of platform admin emails |

### Generate Secure Secrets

```bash
# Generate cryptographically random JWT secrets
echo "JWT_SECRET: $(openssl rand -hex 64)"
echo "JWT_REFRESH_SECRET: $(openssl rand -hex 64)"
```

### Production Adjustments

For production, create a `docker-compose.prod.yml` override file to remove the PostgreSQL host port mapping:

```yaml
# docker-compose.prod.yml
services:
  postgres:
    ports: []  # Remove host port mapping — internal only
```

Then use both files:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

---

## Step 6: Start AuraOS

```bash
cd /opt/auraos

# Build images and start all services in detached mode
docker compose up --build -d

# Watch the logs to confirm everything is healthy
docker compose logs -f

# Check container status
docker compose ps
```

Expected output — all services should show `(healthy)`:

```
NAME              STATUS
auraos-nginx      Up (healthy)
auraos-frontend   Up (healthy)
auraos-backend    Up (healthy)
auraos-postgres   Up (healthy)
```

### Verify the Deployment

```bash
# Health check (should return JSON with status "ok")
curl http://localhost/api/v1/health

# Test login (replace with your domain)
curl -X POST http://localhost/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@demo-kitchen.local","password":"demo123"}'

# Test frontend (should return HTML with "AuraOS POS")
curl -s http://localhost/ | grep -o "AuraOS POS"
```

---

## Step 7: Configure SSL (HTTPS) with Certbot

```bash
# Install certbot
sudo apt install -y certbot

# Obtain a certificate using the standalone method
# (Stop nginx temporarily since certbot needs port 80)
docker compose stop nginx
sudo certbot certonly --standalone -d your-domain.com
docker compose start nginx

# Certificates are stored at:
#   /etc/letsencrypt/live/your-domain.com/fullchain.pem
#   /etc/letsencrypt/live/your-domain.com/privkey.pem
```

After obtaining certificates, update [`nginx/nginx.conf`](../../nginx/nginx.conf) to add an HTTPS server block (see [SSL nginx configuration](#ssl-nginx-configuration) below).

### Auto-Renewal

Certbot certificates expire after 90 days. Set up a cron job for auto-renewal:

```bash
# Add to crontab (sudo crontab -e)
0 3 * * * certbot renew --quiet --post-hook "docker compose -f /opt/auraos/docker-compose.yml restart nginx"
```

This runs daily at 3 AM, renews certificates that are close to expiry, and restarts the nginx container to pick up the new certificates.

---

## Daily Operations

### Starting AuraOS

```bash
cd /opt/auraos
docker compose up -d
```

### Stopping AuraOS

```bash
cd /opt/auraos
docker compose down
```

### Restarting a Specific Service

```bash
# Restart just the backend
docker compose restart backend

# Restart everything
docker compose restart
```

### Viewing Logs

```bash
# All services, follow mode (real-time)
docker compose logs -f

# Specific service, last 100 lines
docker compose logs --tail 100 backend

# Timestamps enabled
docker compose logs -t backend
```

### Running Database Migrations

```bash
# Migrations run automatically on first startup via the migrate script.
# To run them manually after schema changes:
docker compose exec backend npm run migrate
```

### Checking Resource Usage

```bash
# Container-level CPU/RAM
docker stats

# Host-level
htop
df -h
```

---

## Updating AuraOS

### Standard Update Workflow

```bash
cd /opt/auraos

# 1. Pull latest code
git pull origin main

# 2. Rebuild images with new code and restart
docker compose up --build -d

# 3. Check that everything came up healthy
docker compose ps

# 4. Verify
curl -s http://localhost/api/v1/health | jq
```

### Zero-Downtime Update (Rolling Restart)

For minimal downtime, restart services one at a time:

```bash
# Pull latest code first
git pull origin main

# Rebuild images
docker compose build

# Restart services in dependency order
docker compose up -d postgres          # Already running; no-op
docker compose up -d backend           # Restarts backend
docker compose up -d frontend          # Restarts frontend
docker compose up -d nginx             # Restarts nginx
```

### Pulling Pre-Built Images (Future CI/CD)

When the CI pipeline publishes images to a registry (ECR/Docker Hub):

```bash
docker compose pull     # Pull latest images
docker compose up -d    # Recreate containers with new images
```

---

## Backup & Recovery

### PostgreSQL Backup

```bash
# Full database dump (runs inside the postgres container)
docker compose exec postgres pg_dump \
  -U auraos_user \
  -d auraos \
  --clean --if-exists \
  > /opt/backups/auraos_$(date +%Y%m%d_%H%M%S).sql

# Compressed backup
docker compose exec postgres pg_dump \
  -U auraos_user \
  -d auraos \
  --clean --if-exists \
  | gzip > /opt/backups/auraos_$(date +%Y%m%d_%H%M%S).sql.gz
```

### Automated Daily Backup (Cron)

```bash
# Create backup directory
mkdir -p /opt/backups

# Add to crontab (crontab -e)
0 2 * * * docker compose -f /opt/auraos/docker-compose.yml exec -T postgres \
  pg_dump -U auraos_user -d auraos --clean --if-exists \
  | gzip > /opt/backups/auraos_$(date +\%Y\%m\%d).sql.gz

# Keep only last 30 days of backups
0 3 * * * find /opt/backups -name "auraos_*.sql.gz" -mtime +30 -delete
```

### Restore from Backup

```bash
# Restore a compressed backup
gunzip -c /opt/backups/auraos_20260612_020000.sql.gz | \
  docker compose exec -T postgres psql -U auraos_user -d auraos
```

### Volume Backup (EBS Snapshot)

For disaster recovery, configure AWS Backup to take daily snapshots of the EC2 EBS volume. This captures the entire Docker volume (`postgres_data`) plus all application code and configuration.

---

## Monitoring

### Built-in Health Checks

All four containers have Docker health checks defined in [`docker-compose.yml`](../../docker-compose.yml):

| Service | Health Check | Interval |
|---------|-------------|----------|
| postgres | `pg_isready -U auraos_user -d auraos` | 10s |
| backend | `wget http://localhost:3000/api/v1/health` | 15s |
| frontend | (nginx serves static files — always healthy if running) | — |
| nginx | `wget http://localhost/proxy-health` | 30s |

Check health status at any time:

```bash
docker compose ps
# Look for "(healthy)" in the STATUS column
```

### CloudWatch Monitoring

Install the CloudWatch agent for system-level metrics (CPU, memory, disk, network):

```bash
# Download and install CloudWatch agent
wget https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb
sudo dpkg -i amazon-cloudwatch-agent.deb

# Configure (basic metrics)
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-config-wizard
```

### Log Rotation

Docker containers accumulate logs indefinitely. Configure log rotation to prevent disk exhaustion:

```yaml
# Add to each service in docker-compose.yml
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
```

### Alerting

Consider setting up CloudWatch Alarms for:
- **CPU utilization > 80%** for 5 minutes → scale up instance type
- **Status check failed** → instance or container unhealthy
- **Disk usage > 80%** → expand EBS volume or clean up logs

---

## SSL Nginx Configuration

Add this HTTPS server block to [`nginx/nginx.conf`](../../nginx/nginx.conf) after obtaining certificates:

```nginx
# HTTPS server block (add after the existing HTTP block)
server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate     /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # Modern SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;

    # ... include the same location blocks as the HTTP server ...
    # (security headers, /api/, /socket.io/, / frontend)
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$host$request_uri;
}
```

For the SSL certificates to be accessible inside the nginx container, you'll need to mount them as a volume in `docker-compose.yml`:

```yaml
nginx:
  # ... existing config ...
  volumes:
    - /etc/letsencrypt:/etc/letsencrypt:ro
```

---

## Security Checklist

- [ ] SSH restricted to specific IP (not `0.0.0.0/0`)
- [ ] `JWT_SECRET` and `JWT_REFRESH_SECRET` are unique, randomly generated values
- [ ] `POSTGRES_HOST_AUTH_METHOD` is set to `scram-sha-256` (not `trust`)
- [ ] PostgreSQL has no host port mapping in production
- [ ] Backend has no host port mapping
- [ ] Only ports 80 and 443 are open to the internet
- [ ] SSL/TLS certificates are configured with auto-renewal
- [ ] `.env` file permissions are `600` (owner read/write only)
- [ ] Automatic security updates are enabled (`sudo apt install unattended-upgrades`)
- [ ] Regular backups are configured and tested

---

## Scaling Beyond a Single EC2 Instance

The current architecture works well for single-instance deployment. If you need to scale beyond one EC2 instance:

1. **Move PostgreSQL to RDS.** Replace the `postgres` service with an RDS PostgreSQL endpoint. Update `DATABASE_URL` in the backend environment.
2. **Move file storage to S3.** If the app stores uploads (menu images, etc.), use S3 with presigned URLs instead of the local filesystem.
3. **Add a load balancer.** Place an Application Load Balancer (ALB) in front of multiple EC2 instances running the application containers.
4. **Use ECS Fargate or EKS.** For container orchestration, ECS Fargate eliminates the need to manage EC2 instances entirely.

These are future considerations — the documented single-instance setup is sufficient for most restaurants and small chains.

---

## Troubleshooting

### Container fails to start

```bash
# Check logs for the failing service
docker compose logs <service-name>

# Common issues:
# - Port already in use: sudo lsof -i :80
# - Missing .env file: Ensure .env exists in /opt/auraos
# - Database connection refused: Check that postgres is healthy first
```

### Database migration fails

```bash
# Run migrations manually
docker compose exec backend npm run migrate

# If migrations hang, check database connectivity
docker compose exec backend wget -qO- http://postgres:5432 || echo "DB unreachable"
```

### Disk space exhausted

```bash
# Check disk usage
df -h

# Clean up unused Docker resources
docker system prune -a --volumes

# Remove old backups
find /opt/backups -name "*.sql.gz" -mtime +30 -delete
```

### SSL certificate expired

```bash
# Force renewal
sudo certbot renew --force-renewal

# Restart nginx to pick up new certs
docker compose restart nginx