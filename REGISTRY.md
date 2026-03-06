# Atom CLI - Registry Management

Command-line interface for managing the deployment registry without manually editing YAML files.

## Overview

The registry management commands provide a CLI interface to:
- Add/remove services and products
- Link/unlink services to products
- Update configurations
- Search and list registry contents
- View detailed information

All operations update the `bin/config/deployment-registry.yaml` file automatically.


### Custom Registry Path Example

  # 1. Create directory
  mkdir -p /home/vritti/envs/atom

  # 2. Copy current registry there
  cp bin/config/deployment-registry.yaml /home/vritti/envs/atom/deployment-registry.yaml

  # 3. Add to ~/.bashrc
  echo 'export ATOM_REGISTRY_PATH=/home/vritti/envs/atom/deployment-registry.yaml' >> ~/.bashrc

  # 4. Apply it now
  export ATOM_REGISTRY_PATH=/home/vritti/envs/atom/deployment-registry.yaml

  # 5. Test it works
  atom -registry list



---

## Quick Reference

```bash
# List
atom -registry list                                    # Summary
atom -registry list --services                         # All services
atom -registry list --products                         # All products

# Search
atom -registry search --keyword <keyword>              # Search registry

# Show Details
atom -registry show --name <service-or-product>        # Show details

# Add
atom -registry add-service --name <name> \
  --repo <url> --branch <branch>                       # Add service

atom -registry add-product --name <name> \
  --server <host> --path <path>                        # Add product

# Link/Unlink
atom -registry link --service <service> \
  --product <product>                                  # Link service to product

atom -registry unlink --service <service> \
  --product <product>                                  # Unlink

# Remove
atom -registry remove-service --name <name>            # Remove service
atom -registry remove-product --name <name>            # Remove product

# Update
atom -registry update-service --name <name> \
  [--repo <url>] [--branch <branch>]                   # Update service

atom -registry update-product --name <name> \
  [--server <host>] [--path <path>]                    # Update product
```

---

## Commands

### List Commands

#### List Summary
```bash
atom -registry list
```

Shows count of services and products.

**Output:**
```
Deployment Registry

Services: 25
Products: 2

Use --services or --products to see details
Or use: atom -deploy --list
```

#### List All Services
```bash
atom -registry list --services
```

Shows all services with repository and branch.

**Example Output:**
```
Deployment Registry

Services: 25

1. common_auth_agent
   Repository: git@github.com:FootLooseLabs/common_auth_agent.git
   Branch: master
2. api-gateway-service
   Repository: git@github.com:FootLooseLabs/api-gateway-service.git
   Branch: master
...
```

#### List All Products
```bash
atom -registry list --products
```

Shows all products with server count and service count.

**Example Output:**
```
Deployment Registry

Products: 2

1. wity
   Servers: 1
   Services: 24
2. gcp-vritti-dogfooding
   Servers: 1
   Services: 3
```

---

### Search Command

```bash
atom -registry search --keyword <keyword>
```

Search for services or products by keyword. Searches in:
- Service names
- Repository URLs
- Branch names
- Product names
- Server hostnames
- Server paths

**Example:**
```bash
atom -registry search --keyword auth
```

**Output:**
```
Searching for: "auth"

Services:
  common_auth_agent
    git@github.com:FootLooseLabs/common_auth_agent.git
```

---

### Show Command

```bash
atom -registry show --name <service-or-product>
```

Show detailed information about a service or product.

#### Show Service

```bash
atom -registry show --name common_auth_agent
```

**Output:**
```
Service: common_auth_agent

Repository: git@github.com:FootLooseLabs/common_auth_agent.git
Branch: master

Used by products: wity, gcp-vritti-dogfooding
```

#### Show Product

```bash
atom -registry show --name wity
```

**Output:**
```
Product: wity

Servers:
  vritti-dev-server
    Path: /home/ubuntu/agents/

Services: 24
  • Mailer_MicroService
  • api-gateway-service
  • common_auth_agent
  ...
```

---

### Add Commands

#### Add Service

```bash
atom -registry add-service --name <service-name> \
  --repo <git-url> \
  --branch <branch-name>
```

Adds a new service to the registry. Will prompt for confirmation.

**Example:**
```bash
atom -registry add-service --name my-new-service \
  --repo git@github.com:FootLooseLabs/my-new-service.git \
  --branch master
```

**Output:**
```
Adding service: my-new-service
Repository: git@github.com:FootLooseLabs/my-new-service.git
Branch: master

? Add this service to registry? (Y/n)

✓ Service "my-new-service" added to registry
```

**Validations:**
- Service name must be unique
- Repository URL is required
- Branch name is required

#### Add Product

```bash
atom -registry add-product --name <product-name> \
  --server <hostname> \
  --path <deployment-path> \
  [--ssh-key <key-path>] \
  [--username <user>]
```

Adds a new product to the registry. Will prompt for confirmation.

**Example:**
```bash
atom -registry add-product --name staging \
  --server staging.example.com \
  --path /opt/microservices/ \
  --ssh-key ~/.ssh/staging_key \
  --username deploy
```

**Output:**
```
Adding product: staging
Server: staging.example.com
Path: /opt/microservices/
SSH Key: ~/.ssh/staging_key
Username: deploy

? Add this product to registry? (Y/n)

✓ Product "staging" added to registry
```

**Validations:**
- Product name must be unique
- Server hostname is required
- Deployment path is required

---

### Link/Unlink Commands

#### Link Service to Product

```bash
atom -registry link --service <service-name> --product <product-name>
```

Links an existing service to an existing product. Will prompt for confirmation.

**Example:**
```bash
atom -registry link --service my-new-service --product staging
```

**Output:**
```
Linking: my-new-service → staging

? Link this service to product? (Y/n)

✓ Service "my-new-service" linked to product "staging"
```

**Validations:**
- Service must exist in registry
- Product must exist in registry
- Service must not already be linked to this product

#### Unlink Service from Product

```bash
atom -registry unlink --service <service-name> --product <product-name>
```

Removes the link between a service and product. Does not delete the service or product.

**Example:**
```bash
atom -registry unlink --service my-new-service --product staging
```

**Output:**
```
✓ Service "my-new-service" unlinked from product "staging"
```

**Validations:**
- Service must exist in registry
- Product must exist in registry
- Service must be linked to this product

---

### Remove Commands

#### Remove Service

```bash
atom -registry remove-service --name <service-name>
```

Removes a service from the registry. Will prompt for confirmation.

**Example:**
```bash
atom -registry remove-service --name my-old-service
```

**Output:**
```
Warning: Removing service "my-old-service"
? Are you sure you want to remove this service? (y/N)

✓ Service "my-old-service" removed from registry
```

**Safety:**
- Cannot remove a service that is linked to any products
- Must unlink from all products first
- Requires explicit confirmation (defaults to No)

#### Remove Product

```bash
atom -registry remove-product --name <product-name>
```

Removes a product from the registry. Will prompt for confirmation.

**Example:**
```bash
atom -registry remove-product --name old-staging
```

**Output:**
```
Warning: Removing product "old-staging"
? Are you sure you want to remove this product? (y/N)

✓ Product "old-staging" removed from registry
```

**Safety:**
- Requires explicit confirmation (defaults to No)
- Removes product and all its service links

---

### Update Commands

#### Update Service

```bash
atom -registry update-service --name <service-name> \
  [--repo <new-url>] \
  [--branch <new-branch>]
```

Updates service configuration. Can update repo URL, branch, or both.

**Example:**
```bash
atom -registry update-service --name my-service --branch develop
```

**Output:**
```
Updating service: my-service
New branch: develop

? Update this service? (Y/n)

✓ Service "my-service" updated
```

**Validations:**
- Service must exist
- Must specify at least one field to update

#### Update Product

```bash
atom -registry update-product --name <product-name> \
  [--server <new-host>] \
  [--path <new-path>] \
  [--ssh-key <new-key>] \
  [--username <new-user>]
```

Updates product configuration. Updates the first server in the product.

**Example:**
```bash
atom -registry update-product --name staging --path /new/path/
```

**Output:**
```
Updating product: staging
Note: This only updates the first server in the product

New path: /new/path/

? Update this product? (Y/n)

✓ Product "staging" updated
```

**Note:** If a product has multiple servers, only the first one is updated.

---

## Workflow Examples

### Example 1: Add New Service and Deploy

```bash
# 1. Add service to registry
atom -registry add-service --name payment-service \
  --repo git@github.com:FootLooseLabs/payment-service.git \
  --branch master

# 2. Link to products
atom -registry link --service payment-service --product wity
atom -registry link --service payment-service --product staging

# 3. Deploy
atom -deploy payment-service --product staging --dry-run
atom -deploy payment-service --product staging
```

### Example 2: Add New Product Environment

```bash
# 1. Add product
atom -registry add-product --name production \
  --server prod.example.com \
  --path /opt/services/ \
  --ssh-key ~/.ssh/prod_key

# 2. Link existing services
atom -registry link --service common_auth_agent --product production
atom -registry link --service api-gateway-service --product production

# 3. Verify
atom -registry show --name production

# 4. Deploy all services
atom -deploy --product production --all-services
```

### Example 3: Update Service Branch

```bash
# 1. Update branch
atom -registry update-service --name my-service --branch feature-xyz

# 2. Deploy with new branch
atom -deploy my-service --product staging
```

### Example 4: Search and Cleanup

```bash
# 1. Find old services
atom -registry search --keyword old

# 2. Check what uses them
atom -registry show --name old-service

# 3. Unlink if necessary
atom -registry unlink --service old-service --product staging

# 4. Remove
atom -registry remove-service --name old-service
```

---

## Safety Features

### Confirmations
- All destructive operations (add, remove, link) prompt for confirmation
- Remove operations default to "No" for safety

### Validations
- Cannot add duplicate services or products
- Cannot remove services that are in use
- Cannot link already-linked services
- All required fields are validated

### Automatic Backup
The YAML file is updated atomically. Consider version controlling it:

```bash
cd ~/atom-cli
git add bin/config/deployment-registry.yaml
git commit -m "Updated registry: added staging product"
git push
```

---

## Error Handling

### Common Errors

**Service already exists:**
```
Error: Service "my-service" already exists in registry
```
**Solution:** Use `update-service` instead, or use a different name.

**Service not found:**
```
Error: Service "unknown-service" not found in registry
```
**Solution:** Check service name with `atom -registry list --services`.

**Cannot remove service in use:**
```
Error: Cannot remove service "auth-service" - it is used by products: wity, staging
```
**Solution:** Unlink from all products first using `unlink`.

**Service already linked:**
```
Error: Service "my-service" is already linked to product "staging"
```
**Solution:** Service is already configured for this product.

---

## Integration with Deployment

Registry management and deployment work together:

```bash
# 1. Manage registry
atom -registry add-service --name my-service \
  --repo git@github.com:org/my-service.git \
  --branch master

atom -registry link --service my-service --product wity

# 2. Deploy
atom -deploy my-service --product wity

# 3. Verify
atom -deploy my-service --list
```

---

## Tips & Best Practices

### 1. Check Before Adding
```bash
# Search first
atom -registry search --keyword my-service

# Then add if not found
atom -registry add-service --name my-service ...
```

### 2. Use Show for Verification
```bash
# After making changes
atom -registry show --name my-service
atom -registry show --name wity
```

### 3. Version Control Registry
```bash
# Before major changes
git add bin/config/deployment-registry.yaml
git commit -m "Registry state before changes"

# Make changes
atom -registry ...

# Commit changes
git add bin/config/deployment-registry.yaml
git commit -m "Added staging environment"
```

### 4. Dry Run Deployments
```bash
# After updating registry
atom -deploy my-service --product staging --dry-run
```

### 5. Search for Impact
```bash
# Before removing a service
atom -registry show --name old-service
# Check "Used by products" before removing
```

---

## Related Commands

- **Deployment:** See [DEPLOYMENT.md](DEPLOYMENT.md)
- **Installation:** See [INSTALL.md](INSTALL.md)
- **Main CLI:** See [README.md](README.md)

---

## Future Enhancements

Planned features for registry management:

- **Cloud sync:** Sync registry to cloud service
- **Multi-server products:** Better handling of multiple servers per product
- **Environment-specific configs:** Per-environment overrides
- **Import/export:** Backup and restore registry
- **History:** Track registry changes over time
- **Validation:** Pre-deployment validation checks
- **Templates:** Service/product templates for quick setup
