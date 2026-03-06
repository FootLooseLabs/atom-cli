const chalk = require('chalk');
const inquirer = require('inquirer');
const DeploymentRegistry = require('../utils/yamlParser');

/**
 * Registry management command handler
 *
 * Supported operations:
 * - atom -registry list [--services|--products]
 * - atom -registry search <keyword>
 * - atom -registry show <name>
 * - atom -registry add-service <name> --repo <url> --branch <branch>
 * - atom -registry add-product <name> --server <host> --path <path>
 * - atom -registry link <service> --product <product>
 * - atom -registry unlink <service> --product <product>
 * - atom -registry remove-service <name>
 * - atom -registry remove-product <name>
 * - atom -registry update-service <name> --repo|--branch <value>
 * - atom -registry update-product <name> --server <host> --path <path>
 * - atom -registry autoprepare [--product <product>]
 * - atom -registry ap [--product <product>] (shorthand)
 */
async function manageRegistry(operation, options) {
  try {
    // Handle autoprepare operations
    if (operation === 'autoprepare' || operation === 'ap') {
      const autoprepare = require('./autoprepare_registry');
      await autoprepare(options);
      return;
    }

    const registry = new DeploymentRegistry();

    switch (operation) {
      case 'list':
        handleList(registry, options);
        break;

      case 'search':
        handleSearch(registry, options);
        break;

      case 'show':
        handleShow(registry, options);
        break;

      case 'add-service':
        await handleAddService(registry, options);
        break;

      case 'add-product':
        await handleAddProduct(registry, options);
        break;

      case 'link':
        await handleLink(registry, options);
        break;

      case 'unlink':
        handleUnlink(registry, options);
        break;

      case 'remove-service':
        await handleRemoveService(registry, options);
        break;

      case 'remove-product':
        await handleRemoveProduct(registry, options);
        break;

      case 'update-service':
        await handleUpdateService(registry, options);
        break;

      case 'update-product':
        await handleUpdateProduct(registry, options);
        break;

      default:
        console.error(chalk.red(`Unknown operation: ${operation}`));
        showHelp();
        process.exit(1);
    }

  } catch (error) {
    console.error(chalk.red('Error:'), error.message);
    process.exit(1);
  }
}

/**
 * List services or products
 */
function handleList(registry, options) {
  const { services: servicesOnly, products: productsOnly } = options;

  console.log(chalk.bold.blue('\nDeployment Registry\n'));

  if (servicesOnly) {
    // List only services
    const services = registry.getAllServices();
    console.log(chalk.bold(`Services: ${services.length}\n`));
    services.forEach((serviceName, idx) => {
      const service = registry.getService(serviceName);
      console.log(`${idx + 1}. ${chalk.cyan(serviceName)}`);
      console.log(`   Repository: ${chalk.gray(service.repo)}`);
      console.log(`   Branch: ${chalk.gray(service.branch)}`);
    });
  } else if (productsOnly) {
    // List only products
    const products = registry.getAllProducts();
    console.log(chalk.bold(`Products: ${products.length}\n`));
    products.forEach((productName, idx) => {
      const product = registry.getProduct(productName);
      const serviceCount = registry.getServicesForProduct(productName).length;
      console.log(`${idx + 1}. ${chalk.green(productName)}`);
      console.log(`   Servers: ${product.servers.length}`);
      console.log(`   Services: ${serviceCount}`);
    });
  } else {
    // List both
    const services = registry.getAllServices();
    const products = registry.getAllProducts();
    console.log(chalk.bold(`Services: ${services.length}`));
    console.log(chalk.bold(`Products: ${products.length}\n`));
    console.log(chalk.gray('Use --services or --products to see details'));
    console.log(chalk.gray('Or use: atom deploy --list'));
  }

  console.log('');
}

/**
 * Search registry
 */
function handleSearch(registry, options) {
  const keyword = options.keyword;

  if (!keyword) {
    console.error(chalk.red('Error: Missing search keyword'));
    console.log('Usage: atom -registry search <keyword>');
    process.exit(1);
  }

  console.log(chalk.blue(`\nSearching for: "${keyword}"\n`));

  const results = registry.search(keyword);

  if (results.services.length === 0 && results.products.length === 0) {
    console.log(chalk.yellow('No results found'));
    return;
  }

  if (results.services.length > 0) {
    console.log(chalk.bold('Services:'));
    results.services.forEach(serviceName => {
      const service = registry.getService(serviceName);
      console.log(`  ${chalk.cyan(serviceName)}`);
      console.log(`    ${chalk.gray(service.repo)}`);
    });
    console.log('');
  }

  if (results.products.length > 0) {
    console.log(chalk.bold('Products:'));
    results.products.forEach(productName => {
      const product = registry.getProduct(productName);
      console.log(`  ${chalk.green(productName)}`);
      product.servers.forEach(server => {
        console.log(`    ${chalk.gray(server.hostname)}`);
      });
    });
    console.log('');
  }
}

/**
 * Show details of service or product
 */
function handleShow(registry, options) {
  const name = options.name;

  if (!name) {
    console.error(chalk.red('Error: Missing name'));
    console.log('Usage: atom -registry show <service-or-product>');
    process.exit(1);
  }

  // Check if it's a service
  if (registry.serviceExists(name)) {
    const service = registry.getService(name);
    const products = registry.getProductsUsingService(name);

    console.log(chalk.bold.cyan(`\nService: ${name}\n`));
    console.log(`Repository: ${service.repo}`);
    console.log(`Branch: ${service.branch}`);

    if (service.env && Object.keys(service.env).length > 0) {
      console.log('\nEnvironment Variables:');
      Object.entries(service.env).forEach(([key, value]) => {
        console.log(`  ${key}: ${value}`);
      });
    }

    if (products.length > 0) {
      console.log(`\nUsed by products: ${products.join(', ')}`);
    } else {
      console.log(chalk.yellow('\nNot deployed to any products'));
    }
    console.log('');
    return;
  }

  // Check if it's a product
  if (registry.productExists(name)) {
    const product = registry.getProduct(name);
    const services = registry.getServicesForProduct(name);

    console.log(chalk.bold.green(`\nProduct: ${name}\n`));

    console.log(chalk.bold('Servers:'));
    product.servers.forEach(server => {
      console.log(`  ${server.hostname}`);
      console.log(`    Path: ${server.path}`);
      if (server.ssh_key) console.log(`    SSH Key: ${server.ssh_key}`);
      if (server.username) console.log(`    Username: ${server.username}`);
    });

    console.log(`\n${chalk.bold('Services:')} ${services.length}`);
    services.forEach(svc => console.log(`  • ${svc}`));

    if (product.env && Object.keys(product.env).length > 0) {
      console.log('\nEnvironment Variables:');
      Object.entries(product.env).forEach(([key, value]) => {
        console.log(`  ${key}: ${value}`);
      });
    }
    console.log('');
    return;
  }

  console.error(chalk.red(`Not found: "${name}"`));
  process.exit(1);
}

/**
 * Add a new service
 */
async function handleAddService(registry, options) {
  const serviceName = options.name;
  const { repo, branch } = options;

  if (!serviceName) {
    console.error(chalk.red('Error: Missing service name'));
    console.log('Usage: atom -registry add-service <name> --repo <url> --branch <branch>');
    process.exit(1);
  }

  if (!repo || !branch) {
    console.error(chalk.red('Error: Missing --repo or --branch'));
    console.log('Usage: atom -registry add-service <name> --repo <url> --branch <branch>');
    process.exit(1);
  }

  console.log(chalk.blue(`\nAdding service: ${serviceName}`));
  console.log(`Repository: ${repo}`);
  console.log(`Branch: ${branch}\n`);

  const { confirm } = await inquirer.prompt([{
    type: 'confirm',
    name: 'confirm',
    message: 'Add this service to registry?',
    default: true
  }]);

  if (!confirm) {
    console.log(chalk.yellow('Cancelled'));
    return;
  }

  registry.addService(serviceName, { repo, branch });
  console.log(chalk.green(`\n✓ Service "${serviceName}" added to registry`));
}

/**
 * Add a new product
 */
async function handleAddProduct(registry, options) {
  const productName = options.name;
  const { server, path, sshKey, username } = options;

  if (!productName) {
    console.error(chalk.red('Error: Missing product name'));
    console.log('Usage: atom -registry add-product <name> --server <host> --path <path>');
    process.exit(1);
  }

  if (!server || !path) {
    console.error(chalk.red('Error: Missing --server or --path'));
    console.log('Usage: atom -registry add-product <name> --server <host> --path <path>');
    process.exit(1);
  }

  console.log(chalk.blue(`\nAdding product: ${productName}`));
  console.log(`Server: ${server}`);
  console.log(`Path: ${path}`);
  if (sshKey) console.log(`SSH Key: ${sshKey}`);
  if (username) console.log(`Username: ${username}`);
  console.log('');

  const { confirm } = await inquirer.prompt([{
    type: 'confirm',
    name: 'confirm',
    message: 'Add this product to registry?',
    default: true
  }]);

  if (!confirm) {
    console.log(chalk.yellow('Cancelled'));
    return;
  }

  const serverConfig = { hostname: server, path };
  if (sshKey) serverConfig.ssh_key = sshKey;
  if (username) serverConfig.username = username;

  registry.addProduct(productName, {
    servers: [serverConfig],
    services: []
  });

  console.log(chalk.green(`\n✓ Product "${productName}" added to registry`));
}

/**
 * Link service to product
 */
async function handleLink(registry, options) {
  const serviceName = options.service;
  const productName = options.product;

  if (!serviceName || !productName) {
    console.error(chalk.red('Error: Missing service or product'));
    console.log('Usage: atom -registry link <service> --product <product>');
    process.exit(1);
  }

  console.log(chalk.blue(`\nLinking: ${serviceName} → ${productName}\n`));

  const { confirm } = await inquirer.prompt([{
    type: 'confirm',
    name: 'confirm',
    message: 'Link this service to product?',
    default: true
  }]);

  if (!confirm) {
    console.log(chalk.yellow('Cancelled'));
    return;
  }

  registry.linkServiceToProduct(serviceName, productName);
  console.log(chalk.green(`\n✓ Service "${serviceName}" linked to product "${productName}"`));
}

/**
 * Unlink service from product
 */
function handleUnlink(registry, options) {
  const serviceName = options.service;
  const productName = options.product;

  if (!serviceName || !productName) {
    console.error(chalk.red('Error: Missing service or product'));
    console.log('Usage: atom -registry unlink <service> --product <product>');
    process.exit(1);
  }

  registry.unlinkServiceFromProduct(serviceName, productName);
  console.log(chalk.green(`\n✓ Service "${serviceName}" unlinked from product "${productName}"`));
}

/**
 * Remove service
 */
async function handleRemoveService(registry, options) {
  const serviceName = options.name;

  if (!serviceName) {
    console.error(chalk.red('Error: Missing service name'));
    console.log('Usage: atom -registry remove-service <name>');
    process.exit(1);
  }

  console.log(chalk.yellow(`\nWarning: Removing service "${serviceName}"`));

  const { confirm } = await inquirer.prompt([{
    type: 'confirm',
    name: 'confirm',
    message: 'Are you sure you want to remove this service?',
    default: false
  }]);

  if (!confirm) {
    console.log(chalk.yellow('Cancelled'));
    return;
  }

  registry.removeService(serviceName);
  console.log(chalk.green(`\n✓ Service "${serviceName}" removed from registry`));
}

/**
 * Remove product
 */
async function handleRemoveProduct(registry, options) {
  const productName = options.name;

  if (!productName) {
    console.error(chalk.red('Error: Missing product name'));
    console.log('Usage: atom -registry remove-product <name>');
    process.exit(1);
  }

  console.log(chalk.yellow(`\nWarning: Removing product "${productName}"`));

  const { confirm } = await inquirer.prompt([{
    type: 'confirm',
    name: 'confirm',
    message: 'Are you sure you want to remove this product?',
    default: false
  }]);

  if (!confirm) {
    console.log(chalk.yellow('Cancelled'));
    return;
  }

  registry.removeProduct(productName);
  console.log(chalk.green(`\n✓ Product "${productName}" removed from registry`));
}

/**
 * Update service
 */
async function handleUpdateService(registry, options) {
  const serviceName = options.name;
  const { repo, branch } = options;

  if (!serviceName) {
    console.error(chalk.red('Error: Missing service name'));
    console.log('Usage: atom -registry update-service <name> --repo <url> --branch <branch>');
    process.exit(1);
  }

  if (!repo && !branch) {
    console.error(chalk.red('Error: Must specify at least --repo or --branch'));
    process.exit(1);
  }

  const updates = {};
  if (repo) updates.repo = repo;
  if (branch) updates.branch = branch;

  console.log(chalk.blue(`\nUpdating service: ${serviceName}`));
  if (repo) console.log(`New repository: ${repo}`);
  if (branch) console.log(`New branch: ${branch}`);
  console.log('');

  const { confirm } = await inquirer.prompt([{
    type: 'confirm',
    name: 'confirm',
    message: 'Update this service?',
    default: true
  }]);

  if (!confirm) {
    console.log(chalk.yellow('Cancelled'));
    return;
  }

  registry.updateService(serviceName, updates);
  console.log(chalk.green(`\n✓ Service "${serviceName}" updated`));
}

/**
 * Update product
 */
async function handleUpdateProduct(registry, options) {
  const productName = options.name;
  const { server, path, sshKey, username } = options;

  if (!productName) {
    console.error(chalk.red('Error: Missing product name'));
    console.log('Usage: atom -registry update-product <name> --server <host> --path <path>');
    process.exit(1);
  }

  if (!server && !path && !sshKey && !username) {
    console.error(chalk.red('Error: Must specify at least one update field'));
    process.exit(1);
  }

  console.log(chalk.blue(`\nUpdating product: ${productName}`));
  console.log(chalk.yellow('Note: This only updates the first server in the product'));

  const product = registry.getProduct(productName);
  const firstServer = product.servers[0];

  // Update server config
  const serverConfig = { ...firstServer };
  if (server) serverConfig.hostname = server;
  if (path) serverConfig.path = path;
  if (sshKey) serverConfig.ssh_key = sshKey;
  if (username) serverConfig.username = username;

  console.log('');
  if (server) console.log(`New server: ${server}`);
  if (path) console.log(`New path: ${path}`);
  if (sshKey) console.log(`New SSH key: ${sshKey}`);
  if (username) console.log(`New username: ${username}`);
  console.log('');

  const { confirm } = await inquirer.prompt([{
    type: 'confirm',
    name: 'confirm',
    message: 'Update this product?',
    default: true
  }]);

  if (!confirm) {
    console.log(chalk.yellow('Cancelled'));
    return;
  }

  // Keep other servers unchanged
  const updatedServers = [serverConfig, ...product.servers.slice(1)];
  registry.updateProduct(productName, { servers: updatedServers });
  console.log(chalk.green(`\n✓ Product "${productName}" updated`));
}

/**
 * Show help
 */
function showHelp() {
  console.log(`
${chalk.bold('Registry Management Commands:')}

${chalk.cyan('Auto-Prepare (NEW):')}
  atom -registry autoprepare [--product <name>] \\
    [--git-remote <remotes>]                       Auto-discover running services & update registry
  atom -registry ap [--product <name>]            (shorthand for autoprepare)

  Options:
    --product <name>        Also create/update product for this machine
    --git-remote <remotes>  Git remote preference (e.g. upstream,origin)

${chalk.cyan('List & Search:')}
  atom -registry list                              List summary
  atom -registry list --services                   List all services
  atom -registry list --products                   List all products
  atom -registry search <keyword>                  Search registry
  atom -registry show <name>                       Show service or product details

${chalk.cyan('Add:')}
  atom -registry add-service <name> \\
    --repo <git-url> --branch <branch>             Add new service

  atom -registry add-product <name> \\
    --server <hostname> --path <path>              Add new product

${chalk.cyan('Link/Unlink:')}
  atom -registry link <service> --product <product>    Link service to product
  atom -registry unlink <service> --product <product>  Unlink service from product

${chalk.cyan('Remove:')}
  atom -registry remove-service <name>             Remove service
  atom -registry remove-product <name>             Remove product

${chalk.cyan('Update:')}
  atom -registry update-service <name> \\
    [--repo <url>] [--branch <branch>]             Update service config

  atom -registry update-product <name> \\
    [--server <host>] [--path <path>]              Update product config
`);
}

module.exports = manageRegistry;