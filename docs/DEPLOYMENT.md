# Atom CLI - Deployment System

Centralized deployment management for Atom microservices across multiple products and servers.

## Overview

The deployment system manages the relationship between:
- **Services**: Individual microservices (auth, payments, notifications, etc.)
- **Products**: Customer-facing products that use these services
- **Servers**: Infrastructure where services are deployed

All configuration is stored in `bin/config/deployment-registry.yaml`.

---

## Quick Start

### 1. List all deployments
```bash
sudo atom deploy --list
```

### 2. List where a specific service is deployed
```bash
sudo atom deploy common_auth_agent --list
```

### 3. List all services for a product
```bash
sudo atom deploy --product wity --list
```

### 4. Deploy a service to a product
```bash
sudo atom deploy common_auth_agent --product wity
```

### 5. Deploy a service everywhere it's configured
```bash
sudo atom deploy common_auth_agent --all
```

### 6. Deploy all services for a product
```bash
sudo atom deploy --product wity --all-services
```

---

## Command Reference

### Listing Commands

| Command | Description |
|---------|-------------|
| `atom deploy --list` | Show all products, servers, and services |
| `atom deploy <service> --list` | Show where a service is deployed |
| `atom deploy --product <product> --list` | Show all services for a product |

### Deployment Commands

| Command | Description |
|---------|-------------|
| `atom deploy <service> --product <product>` | Deploy service to specific product |
| `atom deploy <service> --all` | Deploy service to all products that use it |
| `atom deploy --product <product> --all-services` | Deploy all services for a product |

### Optional Flags

| Flag | Description |
|------|-------------|
| `--restart` | Restart service via PM2 after deployment |
| `--dry-run` | Show what would be deployed without executing |
| `--debug` | Show verbose SSH output |
| `--parallel` | Deploy to multiple servers in parallel (future) |

---

## Deployment Registry

### Location
`bin/config/deployment-registry.yaml`

### Structure

```yaml
# Define all services
services:
  service-name:
    repo: git@github.com:org/service-name.git
    branch: master
    env:  # Optional: Service-level environment defaults
      NODE_ENV: production
      LOG_LEVEL: info

# Define products and their infrastructure
products:
  product-name:
    servers:
      - hostname: server-hostname
        path: /path/to/services/
        ssh_key: ~/.ssh/deploy-key  # Optional: SSH key path
        username: ubuntu            # Optional: SSH username (default: ubuntu)
    env:  # Optional: Product-level environment variables
      DATABASE_URL: mongodb://prod-db:27017/myapp
      REDIS_URL: redis://prod-redis:6379
    services:
      - service-1
      - service-2:
          env:  # Optional: Service-specific env for this product
            API_KEY: prod-key-xyz
```

### Environment Variable Precedence

Environment variables are merged with this precedence (highest to lowest):
1. **Product → Service-specific env** (highest priority)
2. **Product-level env**
3. **Service-level env** (lowest priority)

---

## How Deployment Works

### What happens when you deploy:

1. **SSH Connection**: Connects to target server using SSH key
2. **Git Operations**:
   - If service doesn't exist: `git clone`
   - If service exists: `git pull` and `git reset --hard origin/<branch>`
3. **Dependencies**: Runs `npm install`
4. **Environment**: Writes `.env` file with merged environment variables
5. **Service Restart** (optional): Restarts via PM2 if `--restart` flag is used

### Deployment Flow Diagram

```
User runs: atom deploy auth-service --product staging

        ↓
    Parse YAML Registry
        ↓
    Resolve Targets (servers, repos, env)
        ↓
    For each server:
        ├─ SSH Connect
        ├─ cd /deployment/path
        ├─ git clone OR git pull
        ├─ npm install
        ├─ Write .env file
        └─ pm2 restart (if --restart)
        ↓
    Report Results
```

---

## Examples

### Example 1: Deploy Single Service to Product

```bash
sudo atom deploy common_auth_agent --product wity
```

**Output:**
```
Deploying common_auth_agent to wity

Deployment Plan:
  1. common_auth_agent → vritti-dev-server (/home/ubuntu/agents/)

============================================================
Deploying common_auth_agent to vritti-dev-server
============================================================
Connecting to vritti-dev-server...
Connected to vritti-dev-server
Service found, updating to latest version...
Pulling latest changes (branch: master)...
Repository updated successfully
Installing dependencies...
Dependencies installed successfully
Writing environment variables...
.env file updated with 5 variables

✓ Deployment successful

============================================================
Deployment Summary
============================================================

✓ Successful deployments: 1
  • common_auth_agent → vritti-dev-server
```

### Example 2: Deploy Service Everywhere

```bash
sudo atom deploy rtc-webrequest-handler --all
```

Deploys to all products that use this service:
- wity
- gcp-vritti-dogfooding

### Example 3: Deploy All Services for a Product

```bash
sudo atom deploy --product wity --all-services
```

Deploys all 24 services configured for the `wity` product.

### Example 4: Dry Run

```bash
sudo atom deploy common_auth_agent --product wity --dry-run
```

Shows what would happen without actually deploying.

### Example 5: Deploy with Restart

```bash
sudo atom deploy common_auth_agent --product wity --restart
```

Deploys and automatically restarts the service via PM2.

---

## Configuration Examples

### Adding a New Service

Edit `bin/config/deployment-registry.yaml`:

```yaml
services:
  my-new-service:
    repo: git@github.com:FootLooseLabs/my-new-service.git
    branch: master
    env:
      NODE_ENV: production
```

Add to product's services list:

```yaml
products:
  wity:
    services:
      - my-new-service
```

Deploy:

```bash
sudo atom deploy my-new-service --product wity
```

### Adding a New Product

```yaml
products:
  staging:
    servers:
      - hostname: staging-server.example.com
        path: /opt/microservices/
        ssh_key: ~/.ssh/staging_deploy_key
    env:
      DATABASE_URL: mongodb://staging-db:27017/staging
      NODE_ENV: staging
    services:
      - common_auth_agent
      - api-gateway-service
```

Deploy all services:

```bash
sudo atom deploy --product staging --all-services
```

### Product-Specific Configuration

Override environment variables per product:

```yaml
services:
  payment-service:
    repo: git@github.com:org/payment-service.git
    branch: master
    env:
      NODE_ENV: production

products:
  production:
    services:
      - payment-service:
          env:
            STRIPE_KEY: pk_live_xxx  # Production Stripe key

  staging:
    services:
      - payment-service:
          env:
            STRIPE_KEY: pk_test_xxx  # Test Stripe key
```

---

## Error Handling

### Continue on Error (Default)

By default, if deployment fails on one server, it continues to others and reports all results:

```
✓ Successful deployments: 2
  • service-a → server-1
  • service-a → server-2

✗ Failed deployments: 1
  • service-a → server-3
    Error: SSH connection timeout
```

Exit code: `1` (indicates failures occurred)

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `Service not found in registry` | Service not defined in YAML | Add service to `services:` section |
| `Product not found in registry` | Product not defined in YAML | Add product to `products:` section |
| `SSH connection failed` | Invalid hostname or SSH key | Check server hostname and SSH key path |
| `Git clone/pull failed` | Invalid repo URL or no access | Verify git URL and SSH keys |
| `npm install failed` | Package issues | Check package.json in service repo |

---

## SSH Configuration

### SSH Key Setup

1. Generate deploy key (if not exists):
```bash
ssh-keygen -t rsa -b 4096 -f ~/.ssh/deploy_key
```

2. Add public key to server:
```bash
ssh-copy-id -i ~/.ssh/deploy_key.pub ubuntu@your-server.com
```

3. Configure in registry:
```yaml
products:
  production:
    servers:
      - hostname: your-server.com
        path: /opt/services/
        ssh_key: ~/.ssh/deploy_key
```

### Default SSH Settings

- **Username**: `ubuntu` (override with `username:` field)
- **SSH Key**: `~/.ssh/id_rsa` (override with `ssh_key:` field)
- **Timeout**: 30 seconds

---

## Current Registry

As of v0.0.4, the registry includes:

### Products: 2
- **wity** - 24 services on vritti-dev-server
- **gcp-vritti-dogfooding** - 3 services on gcp-vritti-dogfooding

### Services: 25
- Mailer_MicroService
- api-gateway-service
- common-auditor-agent
- common_auth_agent
- crm-proposal-manager
- entity-lifecycle-manager
- file_manager_utils
- ideation-notes-manager
- product-package-manager
- prompt-executor-agent
- rtc-webrequest-handler
- session-manager-agent
- user-account-manager
- vritti-composer
- vritti-composer-export
- vritti-composer-journal
- vritti-control-space-manager
- vritti-ideator
- vritti-ideator-unrefined
- vritti-lifecycle-orchestrator
- vritti-organizer
- vritti-registry-manager
- vritti-vectorizer
- webhooks-manager
- iden-engine-core

View current registry:
```bash
sudo atom deploy --list
```

---

## Best Practices

### 1. Always Test with --dry-run First
```bash
sudo atom deploy my-service --product production --dry-run
```

### 2. Deploy to Staging Before Production
```bash
# Test on staging
sudo atom deploy my-service --product staging

# Verify it works
# Then deploy to production
sudo atom deploy my-service --product production
```

### 3. Use Specific Product Deployments
```bash
# Preferred: Deploy to specific product
sudo atom deploy auth-service --product staging

# Careful: Deploys everywhere
sudo atom deploy auth-service --all
```

### 4. Check Service Status After Deployment
```bash
# SSH to server
ssh ubuntu@your-server.com

# Check PM2 status
pm2 list

# Check logs
pm2 logs service-name
```

### 5. Version Control the Registry
```bash
cd /path/to/atom-cli
git add bin/config/deployment-registry.yaml
git commit -m "Add new service to registry"
git push
```

---

## Troubleshooting

### Debug Mode

Enable verbose output:
```bash
sudo atom deploy service-name --product prod --debug
```

Shows:
- SSH connection details
- All command outputs
- Full error stack traces

### Check Registry Validity

List all deployments to verify registry parses correctly:
```bash
sudo atom deploy --list
```

If this fails, there's a YAML syntax error.

### Manual Deployment Test

SSH to server and test manually:
```bash
ssh ubuntu@your-server.com
cd /path/to/services/
git clone <repo-url> service-name
cd service-name
npm install
pm2 start npm --name service-name -- start
```

---

## Future Enhancements

### Planned Features:
- ✅ Local YAML registry (implemented)
- ✅ Registry management CLI commands (implemented)
- 📋 Cloud-based registry service
- 📋 Deployment history/audit log
- 📋 Rollback capability
- 📋 Health checks after deployment
- 📋 Parallel deployments
- 📋 Pre/post deployment hooks
- 📋 Blue-green deployments
- 📋 Canary deployments

---

## Getting Help

```bash
# Show main help
atom --help

# Show deploy help
atom deploy --help

# Deployment examples
cat docs/DEPLOYMENT.md

# Registry structure
cat bin/config/deployment-registry.yaml
```

## Related Documentation

- [Configuration Guide](CONFIGURATION.md) - Environment variables and settings
- [Registry Management](REGISTRY.md) - CLI commands for managing registry
- [Main README](../README.md) - Complete CLI documentation
