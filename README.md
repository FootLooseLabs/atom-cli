# Atom CLI

A command-line interface tool for managing the Atom.js microservices framework. The Atom CLI provides essential utilities for setting up the nucleus daemon, creating new projects, testing service communication, and managing Atom environments.

## Overview

The Atom CLI is the companion tool for the [Atom.js Framework](https://github.com/FootLooseLabs/atom.js) - a microservices communication framework built on ZeroMQ. This CLI handles:

- **Nucleus Daemon Management**: Start and manage the Redis-based service discovery daemon
- **Project Scaffolding**: Generate new Atom service projects with proper boilerplate code
- **Service Communication Testing**: Send test signals between services
- **Environment Management**: Start and orchestrate multiple services from configuration files
- **Diagnostics**: Debug and troubleshoot Atom framework connectivity
- **Deployment Management**: Deploy services to multiple products and servers from centralized YAML registry

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Atom CLI      │    │   Atom.js       │    │   Your          │
│                 │    │   Services      │    │   Applications  │
│                 │    │                 │    │                 │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │atom -s      │ │    │ │Service A    │ │    │ │Service B    │ │
│ │(Nucleus)    │ │    │ │Service C    │ │    │ │Service D    │ │
│ └─────────────┘ │    │ └─────────────┘ │    │ └─────────────┘ │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────┴─────────────┐
                    │     Redis + UDP           │
                    │   Service Discovery       │
                    │                           │
                    │ • Service Registry        │
                    │ • Connection Brokering    │
                    │ • Health Monitoring       │
                    └───────────────────────────┘
```

## Installation

### Prerequisites

- **Node.js**: Version 12 or higher

### Install from Source

```bash
git clone <repository-url>
cd atom-cli
./install.sh
```

> **Note:** This script will also automatically install the following dependencies:
*   **Redis Server**: Used for service discovery
*   **PM2**: Used for process management

## Quick Start

### 1. Start the Nucleus Daemon

The nucleus daemon is required for all Atom services to communicate:

```bash
atom -s
```

This command:
- Starts a Redis server for service discovery
- Initializes the nucleus daemon using PM2
- Enables service-to-service communication

### 2. Create a New Atom Service

Generate a new service project with proper boilerplate:

```bash
atom -i
```

You'll be prompted for:
- **Component name**: Your service identifier (e.g., `user-service`)
- **Description**: Brief description of the service
- **Primary port**: Main communication port (auto-suggested)

### 3. Test Service Communication

Send test messages between services:

```bash
atom -ss
```

This interactive tool allows you to:
- View available services in the environment
- Send test messages to specific services
- Debug communication issues

## Commands Reference

### Core Commands

| Command | Description | Usage |
|---------|-------------|-------|
| `-s, --start` | Start the nucleus daemon | `atom -s` |
| `-i, --init` | Initialize a new Atom component | `atom -i` |
| `-ss, --signal` | Interactive signal testing tool | `atom -ss` |
| `-diag, --diagnose` | Diagnose nucleus connectivity | `atom -diag` |

### Environment Management

| Command | Description | Usage |
|---------|-------------|-------|
| `-senv, --startenv <config>` | Start environment from config | `atom -senv ./config.json` |
| `-sii, --startintrospectiveinterface` | Launch introspective interface | `atom -sii` |

### Advanced Commands

| Command | Description | Usage |
|---------|-------------|-------|
| `-b, --broadcast <payload>` | Broadcast message to service | `atom -b @myapp/service:::topic:::{data}` |
| `-d, --debug` | Enable debug output | `atom -d [command]` |

### Deployment Commands (NEW)

| Command | Description | Usage |
|---------|-------------|-------|
| `-deploy --list` | List all deployments | `atom -deploy --list` |
| `-deploy <service> --list` | Show where service is deployed | `atom -deploy auth-service --list` |
| `-deploy --product <product> --list` | Show services for product | `atom -deploy --product wity --list` |
| `-deploy <service> --product <product>` | Deploy service to product | `atom -deploy auth-service --product wity` |
| `-deploy <service> --all` | Deploy to all products | `atom -deploy auth-service --all` |
| `-deploy --product <product> --all-services` | Deploy all services | `atom -deploy --product wity --all-services` |

**Deployment Flags:**
- `--restart` - Restart service via PM2 after deployment
- `--dry-run` - Preview deployment without executing
- `--debug` - Show verbose SSH output

**See [DEPLOYMENT.md](DEPLOYMENT.md) for complete deployment documentation.**

### Registry Management Commands (NEW)

| Command | Description | Usage |
|---------|-------------|-------|
| `-registry list` | List summary | `atom -registry list` |
| `-registry list --services` | List all services | `atom -registry list --services` |
| `-registry list --products` | List all products | `atom -registry list --products` |
| `-registry search --keyword <word>` | Search registry | `atom -registry search --keyword auth` |
| `-registry show --name <name>` | Show details | `atom -registry show --name wity` |
| `-registry add-service` | Add new service | `atom -registry add-service --name svc --repo url --branch main` |
| `-registry add-product` | Add new product | `atom -registry add-product --name prod --server host --path /path` |
| `-registry link` | Link service to product | `atom -registry link --service svc --product prod` |
| `-registry unlink` | Unlink service | `atom -registry unlink --service svc --product prod` |
| `-registry remove-service` | Remove service | `atom -registry remove-service --name svc` |
| `-registry remove-product` | Remove product | `atom -registry remove-product --name prod` |
| `-registry update-service` | Update service | `atom -registry update-service --name svc --branch dev` |
| `-registry update-product` | Update product | `atom -registry update-product --name prod --path /new/path` |

**See [REGISTRY.md](REGISTRY.md) for complete registry management documentation.**

---

## Configuration

Atom CLI supports configuration via environment variables:

- **`ATOM_REGISTRY_PATH`** - Override default registry file location
- **`--git-remote`** - Specify git remote preference for autoprepare

**See [CONFIGURATION.md](CONFIGURATION.md) for complete configuration guide.**

## Detailed Usage

### Starting the Nucleus Daemon (`atom -s`)

The nucleus daemon is the backbone of the Atom framework, providing service discovery and connection brokering.

```bash
atom -s
```

**What it does:**
- Starts Redis server for service registry
- Launches nucleus daemon via PM2
- Enables UDP multicasting for service discovery
- Provides connection brokering between services

**Process Management:**
- Process name: `@Atom.NucleusDaemon`
- Managed by PM2 for automatic restarts
- Memory limit: 200MB with auto-restart

**Troubleshooting:**
```bash
# Check if daemon is running
pm2 list

# View daemon logs
pm2 logs @Atom.NucleusDaemon

# Restart daemon
pm2 restart @Atom.NucleusDaemon

# Stop daemon
pm2 stop @Atom.NucleusDaemon
```

### Creating New Services (`atom -i`)

Generate a complete Atom service project structure:

```bash
atom -i
```

**Generated Structure:**
```
my-service/
├── src/
│   ├── component/
│   │   ├── main.js              # Main service logic
│   │   ├── db.js                # Database connections
│   │   ├── services/            # Business logic services
│   │   ├── lifecycles/          # Service lifecycle hooks
│   │   ├── operators/           # Data transformation operators
│   │   └── models/              # Data models
│   ├── lexicon/
│   │   └── main.js              # Message schemas
│   ├── utils/
│   │   └── index.js             # Utility functions
│   ├── interface.js             # Atom interface configuration
│   └── interfaceEvents.js       # Event handlers
├── package.json
├── .gitignore
├── .env
└── .env-sample
```

**Generated Files Include:**
- Complete `package.json` with Atom.js dependency
- Interface configuration with suggested ports
- Basic lexicon (message schema) definitions
- Service boilerplate with proper structure
- Environment configuration templates

### Testing Service Communication (`atom -ss`)

Interactive tool for testing messages between services:

```bash
atom -ss
```

**Workflow:**
1. Lists all available services in the environment
2. Prompts you to select a target service
3. Allows you to specify a topic (lexeme)
4. Sends test messages with custom payloads

**Example Session:**
```
Available Agent-Interfaces:
1.) @myapp/user-service
2.) @myapp/order-service

interface ( 1 -to- 2 ) ? 1

topic (lexeme)? user-validation
message? {"userId": "123", "email": "test@example.com"}

operation initiated
```

### Environment Management (`atom -senv`)

Start multiple services from a configuration file:

```bash
atom -senv ./environment-config.json
```

**Configuration File Format:**
```json
{
  "name": "my-microservices-env",
  "interfaces": [
    {
      "name": "@myapp/user-service",
      "dir": "./services/user-service",
      "port": 8050
    },
    {
      "name": "@myapp/order-service",
      "dir": "./services/order-service",
      "port": 8051
    }
  ]
}
```

**Features:**
- Starts nucleus daemon automatically
- Launches all configured services
- Provides centralized logging
- Handles graceful shutdown of all services

### Diagnostics (`atom -diag`)

Comprehensive diagnostic tool for troubleshooting:

```bash
atom -diag
```

**Diagnostic Checks:**
1. **AtomNucleus Status**: Checks daemon ready state
2. **Redis Connectivity**: Verifies Redis connection
3. **Service Discovery**: Tests interface discovery
4. **Service Activity**: Lists active services
5. **Event System**: Validates event handling

**Sample Output:**
```
=== AtomNucleus Diagnostic Tool ===

1. Checking AtomNucleus readystate...
   Current state: ready
   ✓ AtomNucleus is READY

2. Checking Redis connection...
   Redis connected: true
   ✓ Redis connection active

3. Testing interface discovery...
   Found 2 advertised interfaces:
   1. @myapp/user-service
   2. @myapp/order-service
   ✓ Interface discovery working

=== Diagnosis Summary ===
✓ AtomNucleus is healthy
```

### Broadcasting Messages (`atom -b`)

Send direct messages to services:

```bash
atom -b "@myapp/user-service:::user-created:::{'userId':'123','email':'user@example.com'}"
```

**Format:**
```
@service-name:::topic:::payload
```

- `@service-name`: Target service identifier
- `topic`: Message topic/channel
- `payload`: JSON message payload

### Introspective Interface (`atom -sii`)

Launch an interactive interface for service discovery and communication:

```bash
atom -sii
```

**Features:**
- Discover available interfaces in real-time
- Interactive message sending
- Service health monitoring
- Connection status visualization

## Configuration

### Environment Configuration

Create environment configuration files to manage multiple services:

```json
{
  "name": "production-env",
  "baseDir": "./services",
  "interfaces": [
    {
      "name": "@myapp/auth-service",
      "dir": "./auth-service",
      "port": 8050,
      "eventsPort": 8051
    },
    {
      "name": "@myapp/user-service",
      "dir": "./user-service",
      "port": 8052,
      "eventsPort": 8053
    }
  ]
}
```

### Service Configuration

Each generated service includes interface configuration:

```javascript
// src/interface.js
const serviceConfig = {
  name: "@myapp/my-service",
  config: {
    host: "127.0.0.1",
    port: 8050,
    eventsPort: 8051,
    lexicon: require('./lexicon/main'),
    connections: {
      // Define connections to other services
    },
    eventHandlers: {
      // Event handling functions
    },
    requestHandlers: {
      // Request-response handlers
    }
  }
};

module.exports = serviceConfig;
```

## Development Workflow

### 1. Start Nucleus Daemon

```bash
# Start nucleus daemon
atom -s

# Create new service
atom -i
cd my-new-service
npm install

# Start service in development mode
npm run dev
```

### 2. Test Service Communication

```bash
# In another terminal, test communication
atom -ss

# Or diagnose issues
atom -diag
```

### Debug Mode

Enable debug output for detailed logging:

```bash
atom -d -s    # Debug nucleus startup
atom -d -ss   # Debug signal testing
atom -d -senv ./config.json  # Debug environment startup
```

### Log Files

Service logs are managed by PM2:

```bash
# View nucleus logs
pm2 logs @Atom.NucleusDaemon

# View all PM2 processes
pm2 list

# Monitor logs in real-time
pm2 monit
```

## Integration with Atom.js Framework

### Service Structure

Generated services follow Atom.js conventions:
- **Interface Configuration**: Proper service registration
- **Lexicon Definitions**: Message schema validation
- **Event Handlers**: Pub/sub message handling
- **Request Handlers**: Synchronous request-response

### Service Discovery

Services created with `atom -i` or manually created with proper interface.js file would automatically:
- Register with the nucleus daemon
- Participate in service discovery
- Handle connection management
- Support automatic reconnection

### Message Validation

Generated lexicon files provide:
- Type safety for messages
- Runtime validation
- API contract enforcement
- Documentation of message structures


### Process Management Integration

Atom CLI integrates with PM2 for robust process management:

```bash
# View all Atom processes
pm2 list | grep Atom

# Restart all services
pm2 restart all

# Scale a service
pm2 scale @myapp/user-service 3
```

### Monitoring and Observability

```bash
# Real-time monitoring
pm2 monit

# Service metrics
pm2 show @Atom.NucleusDaemon

# Memory usage
pm2 show @myapp/my-service
```

## Best Practices

### 1. Service Naming

- Use namespace prefixes: `@organization/service-name`
- Keep names descriptive and consistent
- Follow kebab-case convention

### 2. Port Management

- Use sequential port ranges for related services
- Document port allocations
- Avoid hardcoding ports in production

### 3. Environment Management

- Use configuration files for multi-service environments
- Separate development and production configurations
- Version control your environment configs

### 4. Development Workflow

```bash
# Always start with nucleus
atom -s

# Create services with proper structure
atom -i

# Test communication before deployment
atom -ss

# Use diagnostics for troubleshooting
atom -diag
```

### 5. Production Deployment

- Use environment configurations for consistency
- Monitor service health with PM2
- Implement proper logging strategies
- Set up alerting for service failures

## API Reference

### CLI Options

```
Usage: atom [options]

Options:
  -d, --debug                              Output extra debugging
  -i, --init                               Initialize atom component
  -s, --start                              Start atom nucleus daemon
  -ss, --signal                            Send signal (interactive)
  -sii, --startintrospectiveinterface      Start introspective interface
  -senv, --startenv <config-path>          Start atom environment
  -diag, --diagnose                        Diagnose atom nucleus connection
  -b, --broadcast <interface-payload>      Broadcast message
  -h, --help                               Display help for command
```

---

For more information about the Atom.js framework itself, see the [Atom.js Documentation](https://github.com/FootLooseLabs/atom.js).
