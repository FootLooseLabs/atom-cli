# Deployment Manager

Centralized deployment configuration and tooling for managing microservices across multiple products and servers.

## Overview

This deployment system manages the relationship between:
- **Services**: Individual microservices (auth, payments, notifications, etc.)
- **Products**: Customer-facing products that use these services
- **Servers**: Infrastructure where services are deployed

## Configuration

All deployment configuration is stored in `deployment-registry.yaml`:

```yaml
services:
  service-name:
    repo: git@github.com:org/service-name.git
    branch: master

products:
  product-name:
    servers:
      - hostname: server-hostname
        path: /path/to/services/
    services:
      - service-1
      - service-2
```

## Usage Commands

### Deploy a service to a specific product

```bash
./deploy.sh auth-service --product wity
```

Deploys the `auth-service` to all servers configured for the `wity` product.

### Deploy a service everywhere it's used

```bash
./deploy.sh auth-service --all
```

Deploys the `auth-service` to all products that use it (according to the registry).

### Deploy all services for a product

```bash
./deploy.sh --product gcp-vritti-dogfooding --all-services
```

Deploys all services configured for the `gcp-vritti-dogfooding` product to its servers.

### List where a service is deployed

```bash
./deploy.sh auth-service --list
```

Shows all products and servers where `auth-service` is configured to run.

### List all services for a product

```bash
./deploy.sh --product wity --list
```

Shows all services configured for the `wity` product.

## Current Configuration

### Products

#### wity
- **Servers**: vritti-dev-server
- **Services**: 24 services (full Vritti platform stack)
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

#### gcp-vritti-dogfooding
- **Servers**: gcp-vritti-dogfooding
- **Services**: 3 services (minimal deployment)
  - common_auth_agent
  - rtc-webrequest-handler
  - iden-engine-core

## Adding a New Product

1. Edit `deployment-registry.yaml`
2. Add the product under `products:`
3. Specify servers and which services it needs
4. Deploy using `./deploy.sh --product new-product --all-services`

## Adding a New Service

1. Add service definition under `services:` in the registry
2. Add the service name to the `services` list of products that need it
3. Deploy using `./deploy.sh new-service --all`

## Benefits

- **Single source of truth**: All deployment config in one place
- **Multi-product support**: Deploy same service to different products
- **Scalable**: Easy to add new products or services
- **Visibility**: See where each service is deployed
- **No per-service config**: Service repos remain clean
