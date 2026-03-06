# Atom CLI - Configuration

## Environment Variables

### ATOM_REGISTRY_PATH

Override the default deployment registry file location.

**Default:** `bin/config/deployment-registry.yaml`

**Usage:**
```bash
# Permanent override (add to ~/.bashrc or ~/.zshrc)
export ATOM_REGISTRY_PATH=/path/to/my/registry.yaml

# Or per-command
ATOM_REGISTRY_PATH=/team/shared/registry.yaml atom -deploy --list
```

**Use Cases:**

1. **Team Shared Registry**
   ```bash
   # Point all team members to network drive
   export ATOM_REGISTRY_PATH=/mnt/team-drive/atom-registry.yaml
   ```

2. **Multi-Environment**
   ```bash
   # Development
   export ATOM_REGISTRY_PATH=~/atom-dev-registry.yaml
   atom -deploy my-service --product dev

   # Production
   export ATOM_REGISTRY_PATH=~/atom-prod-registry.yaml
   atom -deploy my-service --product prod
   ```

3. **Cloud Sync**
   ```bash
   # Dropbox
   export ATOM_REGISTRY_PATH=~/Dropbox/atom-registry.yaml

   # Google Drive
   export ATOM_REGISTRY_PATH=~/Google\ Drive/atom-registry.yaml
   ```

4. **Per-Project**
   ```bash
   # In project directory
   echo "export ATOM_REGISTRY_PATH=$(pwd)/deployment-registry.yaml" >> .envrc
   # Use with direnv
   ```

**Priority:**
1. Explicit path passed to `DeploymentRegistry(path)` constructor
2. `$ATOM_REGISTRY_PATH` environment variable
3. Default: `bin/config/deployment-registry.yaml`

---

## Autoprepare Configuration

### Git Remote Preference

When running `atom -registry autoprepare`, you can specify which git remote to use when extracting repository URLs.

**Default:** `origin,upstream` (checks origin first, then upstream)

**Usage:**
```bash
# Prefer upstream over origin
atom -registry ap --git-remote upstream,origin

# Use only upstream
atom -registry ap --git-remote upstream

# Use only origin (default behavior)
atom -registry ap --git-remote origin

# Multiple remotes in order
atom -registry ap --git-remote upstream,origin,company,gitlab
```

**When to Use:**

**Scenario 1: Fork-based workflow**
```
.git/config:
  [remote "origin"]
    url = git@github.com:yourname/service.git    # Your fork
  [remote "upstream"]
    url = git@github.com:company/service.git     # Main repo
```

Solution:
```bash
# Use upstream (main repo) instead of your fork
atom -registry ap --git-remote upstream,origin
```

**Scenario 2: Company + GitHub**
```
.git/config:
  [remote "origin"]
    url = git@github.com:yourname/service.git
  [remote "company"]
    url = git@gitlab.company.com:team/service.git
```

Solution:
```bash
# Prefer company GitLab over GitHub
atom -registry ap --git-remote company,origin
```

**Scenario 3: Multiple remotes**
```bash
# Try in order: upstream → origin → any other remote
atom -registry ap --git-remote upstream,origin
```

**Behavior:**
- Checks each remote in the order specified
- Uses the first one found
- Falls back to any available remote if none of the specified ones exist
- Shows which remote was used in output: `Branch: master (remote: upstream)`

---

## Registry File Format

The deployment registry uses YAML format:

```yaml
# Services definition
services:
  service-name:
    repo: git@github.com:org/service.git
    branch: master
    env:  # Optional
      NODE_ENV: production

# Products definition
products:
  product-name:
    servers:
      - hostname: server.example.com
        path: /opt/services/
        ssh_key: ~/.ssh/deploy_key  # Optional
        username: deploy             # Optional
    env:  # Optional
      DATABASE_URL: mongodb://...
    services:
      - service-name
      - another-service:
          env:  # Service-specific env for this product
            API_KEY: xyz
```

**Location:**
- Default: `bin/config/deployment-registry.yaml`
- Override: Set `$ATOM_REGISTRY_PATH`

---

## SSH Configuration

### SSH Keys

Services are deployed via SSH. Configure SSH keys per-product:

```yaml
products:
  production:
    servers:
      - hostname: prod.example.com
        path: /opt/services/
        ssh_key: ~/.ssh/prod_deploy_key
        username: deploy
```

**Default SSH settings:**
- Username: `ubuntu`
- SSH Key: `~/.ssh/id_rsa`
- Timeout: 30 seconds

### SSH Key Setup

```bash
# Generate deploy key
ssh-keygen -t rsa -b 4096 -f ~/.ssh/atom_deploy_key

# Add to server
ssh-copy-id -i ~/.ssh/atom_deploy_key.pub user@server.com

# Configure in registry
atom -registry update-product --name production \
  --ssh-key ~/.ssh/atom_deploy_key
```

---

## Configuration Precedence

### Environment Variables

Environment variables take precedence:

1. **Service-level** (in YAML `services.service-name.env`)
2. **Product-level** (in YAML `products.product-name.env`)
3. **Service-in-Product** (in YAML `products.product-name.services[].env`)

Higher number = higher priority.

### Registry Location

1. Explicit path in code
2. `$ATOM_REGISTRY_PATH`
3. Default path

### Git Remote

1. `--git-remote` flag value
2. Default: `origin,upstream`

---

## Best Practices

### 1. Use Environment Variable for Team Sharing

```bash
# .bashrc or .zshrc
export ATOM_REGISTRY_PATH=/mnt/nfs/team/atom-registry.yaml

# Now all team members use the same registry
atom -deploy --list
```

### 2. Version Control Registry

```bash
# Keep registry in git
cd /team/shared
git clone git@github.com:company/atom-registry.git
export ATOM_REGISTRY_PATH=/team/shared/atom-registry/registry.yaml

# Update registry
atom -registry ap
git add registry.yaml
git commit -m "Updated service repos"
git push
```

### 3. Use Separate Registries Per Environment

```bash
# ~/bin/atom-dev
#!/bin/bash
export ATOM_REGISTRY_PATH=~/atom-dev-registry.yaml
atom "$@"

# ~/bin/atom-prod
#!/bin/bash
export ATOM_REGISTRY_PATH=~/atom-prod-registry.yaml
atom "$@"

# Usage
atom-dev -deploy my-service --product dev
atom-prod -deploy my-service --product prod
```

### 4. Autoprepare with Correct Remotes

```bash
# If your repos use upstream for main repo
atom -registry ap --git-remote upstream,origin --product dev-machine

# Add to alias
alias atom-ap='atom -registry ap --git-remote upstream,origin'
atom-ap --product my-machine
```

---

## Troubleshooting

### Registry File Not Found

```
Error: Deployment registry not found at: /path/to/registry.yaml
```

**Solution:**
```bash
# Check environment variable
echo $ATOM_REGISTRY_PATH

# Unset if wrong
unset ATOM_REGISTRY_PATH

# Or create file
touch $ATOM_REGISTRY_PATH
```

### Wrong Git Remote Used

```bash
# Check which remote autoprepare used
atom -registry ap --dry-run

# Output shows:
# Branch: master (remote: origin)

# If you wanted upstream:
atom -registry ap --git-remote upstream,origin
```

### SSH Key Permission Denied

```bash
# Check key exists
ls -la ~/.ssh/atom_deploy_key

# Fix permissions
chmod 600 ~/.ssh/atom_deploy_key

# Test SSH
ssh -i ~/.ssh/atom_deploy_key user@server.com
```

---

## Examples

### Example 1: Team Setup

```bash
# Team lead creates shared registry
mkdir -p /team/shared/atom
cd /team/shared/atom
git init
cat > registry.yaml << 'EOF'
services: {}
products: {}
EOF
git add registry.yaml
git commit -m "Initial registry"

# All team members add to .bashrc:
export ATOM_REGISTRY_PATH=/team/shared/atom/registry.yaml

# Team lead populates from their machine
atom -registry ap --product team-dev-server
cd /team/shared/atom
git add registry.yaml
git commit -m "Added dev server services"
git push

# Other team members pull
cd /team/shared/atom
git pull

# Now everyone sees the same registry
atom -deploy --list
```

### Example 2: Fork Workflow

```bash
# Your repos have origin (fork) and upstream (main)
# You want registry to use upstream URLs

# Create alias
echo 'alias atom-ap="atom -registry ap --git-remote upstream,origin"' >> ~/.bashrc
source ~/.bashrc

# Use alias
atom-ap --product my-dev-machine

# Verify it used upstream
atom -registry show --name my-service
# Should show upstream URL, not your fork
```

### Example 3: Multi-Environment

```bash
# Create separate registries
touch ~/atom-dev.yaml
touch ~/atom-staging.yaml
touch ~/atom-prod.yaml

# Create wrapper scripts
cat > ~/bin/atom-dev << 'EOF'
#!/bin/bash
export ATOM_REGISTRY_PATH=~/atom-dev.yaml
/usr/local/bin/atom "$@"
EOF

# Similar for staging and prod
chmod +x ~/bin/atom-*

# Use different registries
atom-dev -deploy my-service --product dev
atom-staging -deploy my-service --product staging
atom-prod -deploy my-service --product prod
```

---

## See Also

- [DEPLOYMENT.md](DEPLOYMENT.md) - Deployment system
- [REGISTRY.md](REGISTRY.md) - Registry management commands
- [README.md](README.md) - Main CLI documentation
