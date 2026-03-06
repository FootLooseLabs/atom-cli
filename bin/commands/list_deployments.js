const chalk = require('chalk');
const DeploymentRegistry = require('../utils/yamlParser');

/**
 * List deployments command handler
 *
 * Supported usage:
 * - atom deploy <service> --list
 * - atom deploy --product <product> --list
 * - atom deploy --list (all)
 */
function listDeployments(serviceName, options) {
  const { product, all } = options;

  try {
    // Load deployment registry
    const registry = new DeploymentRegistry();

    // Handle case where serviceName is boolean true (when -deploy --list is used without service name)
    if (serviceName === true) {
      serviceName = null;
    }

    if (serviceName && typeof serviceName === 'string' && !product) {
      // List where a specific service is deployed
      listServiceDeployments(registry, serviceName);

    } else if (product && !serviceName) {
      // List all services for a product
      listProductServices(registry, product);

    } else if (all || (!serviceName && !product)) {
      // List everything
      listAllDeployments(registry);

    } else {
      console.error(chalk.red('Error: Invalid combination of flags'));
      console.log('\nUsage:');
      console.log('  atom deploy <service> --list           # List where service is deployed');
      console.log('  atom deploy --product <product> --list # List services for product');
      console.log('  atom deploy --list                     # List all deployments');
      process.exit(1);
    }

  } catch (error) {
    console.error(chalk.red('Error:'), error.message);
    process.exit(1);
  }
}

/**
 * List where a specific service is deployed
 */
function listServiceDeployments(registry, serviceName) {
  console.log(chalk.bold.blue(`\nDeployments for service: ${serviceName}\n`));

  const service = registry.getService(serviceName);
  const products = registry.getProductsUsingService(serviceName);

  if (products.length === 0) {
    console.log(chalk.yellow(`Service "${serviceName}" is not deployed to any products`));
    return;
  }

  console.log(chalk.gray(`Repository: ${service.repo}`));
  console.log(chalk.gray(`Branch: ${service.branch}\n`));

  products.forEach(productName => {
    const product = registry.getProduct(productName);

    console.log(chalk.green(`● ${productName}`));

    product.servers.forEach(server => {
      console.log(`  ${chalk.cyan(server.hostname)}`);
      console.log(`    Path: ${server.path}${serviceName}`);
    });

    // Show environment variables for this product
    const env = registry.getEnvironmentForService(serviceName, productName);
    if (env && Object.keys(env).length > 0) {
      console.log(chalk.gray(`    Environment: ${Object.keys(env).length} variables`));
    }

    console.log('');
  });
}

/**
 * List all services for a product
 */
function listProductServices(registry, productName) {
  console.log(chalk.bold.blue(`\nServices for product: ${productName}\n`));

  const product = registry.getProduct(productName);
  const services = registry.getServicesForProduct(productName);

  if (services.length === 0) {
    console.log(chalk.yellow(`No services configured for product "${productName}"`));
    return;
  }

  console.log(chalk.bold('Servers:'));
  product.servers.forEach(server => {
    console.log(`  ${chalk.cyan(server.hostname)} (${server.path})`);
  });
  console.log('');

  console.log(chalk.bold('Services:'));
  services.forEach((serviceName, idx) => {
    const service = registry.getService(serviceName);
    console.log(`  ${idx + 1}. ${chalk.green(serviceName)}`);
    console.log(`     Repository: ${chalk.gray(service.repo)}`);
    console.log(`     Branch: ${chalk.gray(service.branch)}`);

    // Show environment variables
    const env = registry.getEnvironmentForService(serviceName, productName);
    if (env && Object.keys(env).length > 0) {
      console.log(chalk.gray(`     Environment: ${Object.keys(env).length} variables`));
    }
  });
  console.log('');
}

/**
 * List all deployments in registry
 */
function listAllDeployments(registry) {
  console.log(chalk.bold.blue('\nDeployment Registry Overview\n'));

  const products = registry.getAllProducts();
  const services = registry.getAllServices();

  console.log(chalk.bold(`Products: ${products.length}`));
  console.log(chalk.bold(`Services: ${services.length}\n`));

  console.log('='.repeat(60));

  products.forEach(productName => {
    const product = registry.getProduct(productName);
    const productServices = registry.getServicesForProduct(productName);

    console.log(chalk.green.bold(`\n${productName}`));

    console.log(chalk.gray('  Servers:'));
    product.servers.forEach(server => {
      console.log(chalk.gray(`    • ${server.hostname} (${server.path})`));
    });

    console.log(chalk.gray(`  Services: ${productServices.length}`));
    productServices.forEach(svc => {
      console.log(chalk.gray(`    • ${svc}`));
    });
  });

  console.log('\n' + '='.repeat(60));
  console.log(chalk.bold('\nAll Services:\n'));

  services.forEach((serviceName, idx) => {
    const service = registry.getService(serviceName);
    const deployedTo = registry.getProductsUsingService(serviceName);

    console.log(`${idx + 1}. ${chalk.cyan(serviceName)}`);
    console.log(`   Repository: ${chalk.gray(service.repo)}`);
    console.log(`   Branch: ${chalk.gray(service.branch)}`);

    if (deployedTo.length > 0) {
      console.log(`   Deployed to: ${chalk.green(deployedTo.join(', '))}`);
    } else {
      console.log(`   Deployed to: ${chalk.yellow('none')}`);
    }
    console.log('');
  });
}

module.exports = listDeployments;
