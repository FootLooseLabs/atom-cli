const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const chalk = require('chalk');

/**
 * Parse and validate deployment registry YAML
 */
class DeploymentRegistry {
  constructor(registryPath) {
    this.registryPath = registryPath || path.join(__dirname, '../config/deployment-registry.yaml');
    this.registry = null;
    this.load();
  }

  /**
   * Load and parse YAML file
   */
  load() {
    try {
      if (!fs.existsSync(this.registryPath)) {
        throw new Error(`Deployment registry not found at: ${this.registryPath}`);
      }

      const fileContents = fs.readFileSync(this.registryPath, 'utf8');
      this.registry = yaml.load(fileContents);

      this.validate();
    } catch (error) {
      console.error(chalk.red('Error loading deployment registry:'), error.message);
      process.exit(1);
    }
  }

  /**
   * Validate registry structure
   */
  validate() {
    if (!this.registry) {
      throw new Error('Registry is empty');
    }

    if (!this.registry.services || typeof this.registry.services !== 'object') {
      throw new Error('Registry must contain a "services" section');
    }

    if (!this.registry.products || typeof this.registry.products !== 'object') {
      throw new Error('Registry must contain a "products" section');
    }

    // Validate service definitions
    for (const [serviceName, serviceConfig] of Object.entries(this.registry.services)) {
      if (!serviceConfig.repo) {
        throw new Error(`Service "${serviceName}" is missing required "repo" field`);
      }
      if (!serviceConfig.branch) {
        throw new Error(`Service "${serviceName}" is missing required "branch" field`);
      }
    }

    // Validate product definitions
    for (const [productName, productConfig] of Object.entries(this.registry.products)) {
      if (!productConfig.servers || !Array.isArray(productConfig.servers)) {
        throw new Error(`Product "${productName}" must have a "servers" array`);
      }
      if (!productConfig.services || !Array.isArray(productConfig.services)) {
        throw new Error(`Product "${productName}" must have a "services" array`);
      }

      // Validate servers
      productConfig.servers.forEach((server, idx) => {
        if (!server.hostname) {
          throw new Error(`Server ${idx} in product "${productName}" is missing "hostname"`);
        }
        if (!server.path) {
          throw new Error(`Server ${idx} in product "${productName}" is missing "path"`);
        }
      });
    }
  }

  /**
   * Get service definition
   */
  getService(serviceName) {
    const service = this.registry.services[serviceName];
    if (!service) {
      throw new Error(`Service "${serviceName}" not found in registry`);
    }
    return { name: serviceName, ...service };
  }

  /**
   * Get product definition
   */
  getProduct(productName) {
    const product = this.registry.products[productName];
    if (!product) {
      throw new Error(`Product "${productName}" not found in registry`);
    }
    return { name: productName, ...product };
  }

  /**
   * Get all products that use a specific service
   */
  getProductsUsingService(serviceName) {
    const products = [];

    for (const [productName, productConfig] of Object.entries(this.registry.products)) {
      // Handle both simple string arrays and object arrays for services
      const usesService = productConfig.services.some(s => {
        if (typeof s === 'string') {
          return s === serviceName;
        } else if (typeof s === 'object') {
          return Object.keys(s)[0] === serviceName;
        }
        return false;
      });

      if (usesService) {
        products.push(productName);
      }
    }

    return products;
  }

  /**
   * Get all services for a product
   */
  getServicesForProduct(productName) {
    const product = this.getProduct(productName);
    return product.services.map(s => {
      if (typeof s === 'string') {
        return s;
      } else if (typeof s === 'object') {
        return Object.keys(s)[0];
      }
      return null;
    }).filter(Boolean);
  }

  /**
   * Merge environment variables with proper precedence:
   * 1. Product → Service-specific env (highest)
   * 2. Product-level env
   * 3. Service-level env defaults (lowest)
   */
  getEnvironmentForService(serviceName, productName) {
    const service = this.getService(serviceName);
    const product = this.getProduct(productName);

    let mergedEnv = {};

    // Layer 1: Service-level defaults
    if (service.env) {
      mergedEnv = { ...service.env };
    }

    // Layer 2: Product-level env
    if (product.env) {
      mergedEnv = { ...mergedEnv, ...product.env };
    }

    // Layer 3: Product → Service-specific env
    const serviceInProduct = product.services.find(s => {
      if (typeof s === 'object') {
        return Object.keys(s)[0] === serviceName;
      }
      return false;
    });

    if (serviceInProduct && typeof serviceInProduct === 'object') {
      const serviceConfig = serviceInProduct[serviceName];
      if (serviceConfig && serviceConfig.env) {
        mergedEnv = { ...mergedEnv, ...serviceConfig.env };
      }
    }

    return mergedEnv;
  }

  /**
   * Get deployment targets for a service in a product
   */
  getDeploymentTargets(serviceName, productName) {
    const service = this.getService(serviceName);
    const product = this.getProduct(productName);

    // Verify service is configured for this product
    const serviceNames = this.getServicesForProduct(productName);
    if (!serviceNames.includes(serviceName)) {
      throw new Error(`Service "${serviceName}" is not configured for product "${productName}"`);
    }

    return product.servers.map(server => ({
      serviceName,
      productName,
      server,
      repo: service.repo,
      branch: service.branch,
      env: this.getEnvironmentForService(serviceName, productName)
    }));
  }

  /**
   * Get all services defined in registry
   */
  getAllServices() {
    return Object.keys(this.registry.services);
  }

  /**
   * Get all products defined in registry
   */
  getAllProducts() {
    return Object.keys(this.registry.products);
  }

  /**
   * Check if service exists
   */
  serviceExists(serviceName) {
    return !!this.registry.services[serviceName];
  }

  /**
   * Check if product exists
   */
  productExists(productName) {
    return !!this.registry.products[productName];
  }
}

module.exports = DeploymentRegistry;
