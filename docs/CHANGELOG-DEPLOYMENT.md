# Deployment Feature - Implementation Summary

## Version: 0.0.4 → 0.0.5 (pending)

## What Was Implemented

### New Commands: Deployment Management

Added comprehensive deployment system for managing Atom microservices across multiple products and servers.

#### Listing Commands
```bash
atom deploy --list                          # List all deployments
atom deploy <service> --list                # Show where service is deployed
atom deploy --product <product> --list      # Show services for product
```

#### Deployment Commands
```bash
atom deploy <service> --product <product>            # Deploy to specific product
atom deploy <service> --all                          # Deploy everywhere
atom deploy --product <product> --all-services       # Deploy all services
```

#### Optional Flags
- `--restart` - Restart service via PM2 after deployment
- `--dry-run` - Preview without executing
- `--debug` - Verbose SSH output
- `--parallel` - Parallel deployment (future)

---

## Files Created

### Core Implementation (5 files)

1. **`bin/commands/deploy_service.js`** (137 lines)
   - Main deployment orchestration
   - Handles all deployment command variations
   - Continue-on-error with detailed reporting

2. **`bin/commands/list_deployments.js`** (151 lines)
   - List services, products, and deployments
   - Three modes: service view, product view, all view

3. **`bin/utils/yamlParser.js`** (490+ lines)
   - YAML registry parser with validation
   - Environment variable merging (3-level precedence)
   - Query methods for services, products, targets
   - Registry management (add, update, remove, link)
   - ATOM_REGISTRY_PATH support

4. **`bin/utils/sshDeployer.js`** (267 lines)
   - SSH connection management via node-ssh
   - Git operations (clone/pull)
   - npm install automation
   - .env file generation
   - PM2 restart support

5. **`bin/config/deployment-registry.yaml`** (146 lines)
   - Centralized deployment configuration
   - 2 products, 25 services currently configured

### Documentation (4 files)

6. **`docs/DEPLOYMENT.md`** - Complete deployment guide with examples
7. **`docs/REGISTRY.md`** - Registry management commands
8. **`docs/CONFIGURATION.md`** - Environment variables and settings
9. **`update.sh`** - Convenience update script

### Modified Files (3 files)

10. **`bin/main.js`**
    - Restructured from flat options to proper subcommands
    - Added `deploy` command with sub-flags
    - Integrated deploy and list commands

11. **`package.json`**
    - Added dependencies: `node-ssh`, `js-yaml`

12. **`README.md`**
    - Added deployment commands section
    - Updated overview

---

## Architecture

### Deployment Flow

```
User Command
    ↓
deploy_service.js (orchestration)
    ↓
yamlParser.js (config resolution)
    ↓
sshDeployer.js (SSH operations)
    ↓
Remote Server (git, npm, pm2)
```

### Configuration Structure

```yaml
services:                    # Define all services
  service-name:
    repo: git@...
    branch: master
    env: {}                 # Service-level defaults

products:                   # Define products
  product-name:
    servers:                # Where to deploy
      - hostname: server
        path: /path/
        ssh_key: ~/.ssh/key
    env: {}                # Product-level overrides
    services:              # What to deploy
      - service-1
      - service-2:
          env: {}          # Service-specific overrides
```

### Environment Variable Precedence

1. Product → Service-specific (highest)
2. Product-level
3. Service-level (lowest)

---

## Technical Decisions

### 1. SSH via node-ssh Library
**Why:** Pure Node.js, no external dependencies, programmatic control, safe

### 2. Continue-on-Error Strategy
**Why:** Partial deployments are better than none, full visibility into failures

### 3. YAML Registry with Environment Variable Support
**Why:** Simple, version-controlled, team-shareable, no external services needed
**Future:** Cloud-based registry service

### 4. No Nucleus Modifications
**Why:** Deployment shouldn't touch running nucleus, only service code

### 5. Optional PM2 Restart
**Why:** User controls when services restart via `--restart` flag

### 6. Subcommand Structure
**Why:** Industry standard (git, docker, kubectl), better help discoverability

---

## Dependencies Added

```json
{
  "node-ssh": "^13.1.0",    // SSH operations
  "js-yaml": "^4.1.0"       // YAML parsing
}
```

---

## Current Registry State

### Products: 2
- **wity** - 24 services on vritti-dev-server
- **gcp-vritti-dogfooding** - 3 services on gcp-vritti-dogfooding

### Services: 25
All FootLooseLabs services including auth, gateway, composers, ideators, etc.

---

## Testing Status

✅ **Tested:**
- List all deployments
- List service deployments
- List product services
- YAML parsing with validation
- Environment variable merging
- Error handling (missing service, missing product)
- Registry management commands
- Autoprepare service discovery

⚠️ **Not Tested (requires actual deployment):**
- Actual SSH deployment to servers
- Git clone/pull operations
- npm install on remote
- .env file generation
- PM2 restart

---

## Known Issues

1. **npm install error during update.sh**
   - Stale `.atom-*` directories cause npm conflicts
   - Fixed: update.sh now cleans these with sudo

2. **node-ssh not installed**
   - Need to run: `npm install` or `./update.sh`
   - Will be installed automatically on fresh install

---

## Implemented Features

### Phase 1: Deployment System ✅
- SSH-based deployment
- YAML registry
- Environment variable management
- Continue-on-error strategy
- Dry-run mode

### Phase 2: Registry Management CLI ✅
```bash
atom registry add-service <name> --repo <url> --branch <branch>
atom registry add-product <name> --server <host> --path <path>
atom registry link --service <service> --product <product>
atom registry remove-service <name>
atom registry search --keyword <keyword>
atom registry autoprepare --product <name>
```

### Phase 3: Advanced Features (Pending)
- Deployment history/audit log
- Rollback capability
- Health checks after deployment
- Pre/post deployment hooks
- Parallel deployments
- Blue-green deployments

### Phase 4: Cloud Registry (Future)
- REST API for registry queries
- Multi-user permissions
- Version history
- Team collaboration
- Cache local for offline use

---

## Usage Examples

### Example 1: Check where service is deployed
```bash
$ sudo atom deploy common_auth_agent --list

Deployments for service: common_auth_agent

Repository: git@github.com:FootLooseLabs/common_auth_agent.git
Branch: master

● wity
  vritti-dev-server
    Path: /home/ubuntu/agents/common_auth_agent

● gcp-vritti-dogfooding
  gcp-vritti-dogfooding
    Path: /home/ankur/agents/common_auth_agent
```

### Example 2: Deploy to specific product
```bash
$ sudo atom deploy common_auth_agent --product wity --dry-run

Deploying common_auth_agent to wity

Deployment Plan:
  1. common_auth_agent → vritti-dev-server (/home/ubuntu/agents/)

[DRY RUN] No actual deployment will be performed
```

### Example 3: List all services for product
```bash
$ sudo atom deploy --product wity --list

Services for product: wity

Servers:
  vritti-dev-server (/home/ubuntu/agents/)

Services:
  1. Mailer_MicroService
     Repository: git@github.com:FootLooseLabs/Mailer_MicroService.git
     Branch: master
  2. api-gateway-service
     Repository: git@github.com:FootLooseLabs/api-gateway-service.git
     Branch: master
  ...
```

---

## Breaking Changes

**CLI Syntax Changed (v0.0.5):**
- Old: `atom -deploy` → New: `atom deploy`
- Old: `atom -registry` → New: `atom registry`
- Old: `atom -i` → New: `atom init`
- Old: `atom -s` → New: `atom start`
- All other commands similarly updated

**Why:** Industry standard subcommand pattern for better help and discoverability

---

## Backward Compatibility

✅ All existing command functionality preserved:
- `atom start` - Start nucleus (was `atom -s`)
- `atom init` - Init service (was `atom -i`)
- `atom signal` - Send signals (was `atom -ss`)
- `atom diagnose` - Diagnose (was `atom -diag`)
- `atom startenv` - Start environment (was `atom -senv`)

✅ Installation process unchanged:
- `sudo ./install.sh` still works

✅ Update process improved:
- New `./update.sh` script added

---

## Documentation

- **[docs/DEPLOYMENT.md](DEPLOYMENT.md)** - Complete deployment guide
- **[docs/REGISTRY.md](REGISTRY.md)** - Registry management
- **[docs/CONFIGURATION.md](CONFIGURATION.md)** - Environment variables
- **[../README.md](../README.md)** - Updated with new commands

---

## Summary

Added complete **deployment management system** to Atom CLI, enabling:
- Centralized YAML-based configuration with environment variable override
- SSH-based deployments to multiple servers
- Product-based service organization
- Environment variable management
- Registry management via CLI commands
- Auto-discovery of running services
- Industry-standard subcommand structure
- Contextual help for all commands

Total: **8 new files, 1500+ lines of code, 4 documentation files, 3 modified files**
