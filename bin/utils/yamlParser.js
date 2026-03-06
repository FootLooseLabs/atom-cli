const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const chalk = require('chalk');

/**
 * Parse and validate deployment registry YAML
 */
class DeploymentRegistry {
  constructor(registryPath) {
    // Priority: 1. Explicit path, 2. Environment variable, 3. Default
    this.registryPath = registryPath ||
                        process.env.ATOM_REGISTRY_PATH ||
                        path.join(__dirname, '../config/deployment-registry.yaml');
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

  /**
   * Save registry to YAML file
   */
  save() {
    try {
      const yamlContent = yaml.dump(this.registry, {
        indent: 2,
        lineWidth: -1,
        noRefs: true
      });
      fs.writeFileSync(this.registryPath, yamlContent, 'utf8');
    } catch (error) {
      throw new Error(`Failed to save registry: ${error.message}`);
    }
  }

  /**
   * Add a new service to registry
   */
  addService(serviceName, config) {
    if (this.serviceExists(serviceName)) {
      throw new Error(`Service "${serviceName}" already exists in registry`);
    }

    if (!config.repo) {
      throw new Error('Service must have a "repo" field');
    }

    if (!config.branch) {
      throw new Error('Service must have a "branch" field');
    }

    this.registry.services[serviceName] = {
      repo: config.repo,
      branch: config.branch
    };

    if (config.env) {
      this.registry.services[serviceName].env = config.env;
    }

    this.save();
  }

  /**
   * Remove a service from registry
   */
  removeService(serviceName) {
    if (!this.serviceExists(serviceName)) {
      throw new Error(`Service "${serviceName}" not found in registry`);
    }

    // Check if service is used by any products
    const products = this.getProductsUsingService(serviceName);
    if (products.length > 0) {
      throw new Error(`Cannot remove service "${serviceName}" - it is used by products: ${products.join(', ')}`);
    }

    delete this.registry.services[serviceName];
    this.save();
  }

  /**
   * Update service configuration
   */
  updateService(serviceName, updates) {
    if (!this.serviceExists(serviceName)) {
      throw new Error(`Service "${serviceName}" not found in registry`);
    }

    const service = this.registry.services[serviceName];

    if (updates.repo) service.repo = updates.repo;
    if (updates.branch) service.branch = updates.branch;
    if (updates.env) service.env = updates.env;

    this.save();
  }

  /**
   * Add a new product to registry
   */
  addProduct(productName, config) {
    if (this.productExists(productName)) {
      throw new Error(`Product "${productName}" already exists in registry`);
    }

    if (!config.servers || !Array.isArray(config.servers) || config.servers.length === 0) {
      throw new Error('Product must have at least one server');
    }

    // Validate servers
    config.servers.forEach((server, idx) => {
      if (!server.hostname) {
        throw new Error(`Server ${idx} is missing "hostname" field`);
      }
      if (!server.path) {
        throw new Error(`Server ${idx} is missing "path" field`);
      }
    });

    this.registry.products[productName] = {
      servers: config.servers,
      services: config.services || []
    };

    if (config.env) {
      this.registry.products[productName].env = config.env;
    }

    this.save();
  }

  /**
   * Remove a product from registry
   */
  removeProduct(productName) {
    if (!this.productExists(productName)) {
      throw new Error(`Product "${productName}" not found in registry`);
    }

    delete this.registry.products[productName];
    this.save();
  }

  /**
   * Update product configuration
   */
  updateProduct(productName, updates) {
    if (!this.productExists(productName)) {
      throw new Error(`Product "${productName}" not found in registry`);
    }

    const product = this.registry.products[productName];

    if (updates.servers) {
      // Validate servers
      updates.servers.forEach((server, idx) => {
        if (!server.hostname) {
          throw new Error(`Server ${idx} is missing "hostname" field`);
        }
        if (!server.path) {
          throw new Error(`Server ${idx} is missing "path" field`);
        }
      });
      product.servers = updates.servers;
    }

    if (updates.env) product.env = updates.env;

    this.save();
  }

  /**
   * Link a service to a product
   */
  linkServiceToProduct(serviceName, productName, serviceConfig = null) {
    if (!this.serviceExists(serviceName)) {
      throw new Error(`Service "${serviceName}" not found in registry`);
    }

    if (!this.productExists(productName)) {
      throw new Error(`Product "${productName}" not found in registry`);
    }

    const product = this.registry.products[productName];

    // Check if already linked
    const alreadyLinked = product.services.some(s => {
      if (typeof s === 'string') {
        return s === serviceName;
      } else if (typeof s === 'object') {
        return Object.keys(s)[0] === serviceName;
      }
      return false;
    });

    if (alreadyLinked) {
      throw new Error(`Service "${serviceName}" is already linked to product "${productName}"`);
    }

    // Add service to product
    if (serviceConfig && serviceConfig.env) {
      // Link with custom env
      const serviceEntry = {};
      serviceEntry[serviceName] = { env: serviceConfig.env };
      product.services.push(serviceEntry);
    } else {
      // Simple link
      product.services.push(serviceName);
    }

    this.save();
  }

  /**
   * Unlink a service from a product
   */
  unlinkServiceFromProduct(serviceName, productName) {
    if (!this.serviceExists(serviceName)) {
      throw new Error(`Service "${serviceName}" not found in registry`);
    }

    if (!this.productExists(productName)) {
      throw new Error(`Product "${productName}" not found in registry`);
    }

    const product = this.registry.products[productName];

    // Find and remove service
    const originalLength = product.services.length;
    product.services = product.services.filter(s => {
      if (typeof s === 'string') {
        return s !== serviceName;
      } else if (typeof s === 'object') {
        return Object.keys(s)[0] !== serviceName;
      }
      return true;
    });

    if (product.services.length === originalLength) {
      throw new Error(`Service "${serviceName}" is not linked to product "${productName}"`);
    }

    this.save();
  }

  /**
   * Search registry for keyword
   */
  search(keyword) {
    const results = {
      services: [],
      products: []
    };

    const lowerKeyword = keyword.toLowerCase();

    // Search services
    for (const [serviceName, serviceConfig] of Object.entries(this.registry.services)) {
      if (serviceName.toLowerCase().includes(lowerKeyword) ||
          serviceConfig.repo.toLowerCase().includes(lowerKeyword) ||
          serviceConfig.branch.toLowerCase().includes(lowerKeyword)) {
        results.services.push(serviceName);
      }
    }

    // Search products
    for (const [productName, productConfig] of Object.entries(this.registry.products)) {
      if (productName.toLowerCase().includes(lowerKeyword)) {
        results.products.push(productName);
      } else {
        // Search in servers
        const matchesServer = productConfig.servers.some(server =>
          server.hostname.toLowerCase().includes(lowerKeyword) ||
          server.path.toLowerCase().includes(lowerKeyword)
        );
        if (matchesServer) {
          results.products.push(productName);
        }
      }
    }

    return results;
  }
}

module.exports = DeploymentRegistry;
