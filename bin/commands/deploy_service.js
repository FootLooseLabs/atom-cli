const chalk = require('chalk');
const DeploymentRegistry = require('../utils/yamlParser');
const SSHDeployer = require('../utils/sshDeployer');

/**
 * Deploy service command handler
 *
 * Supported usage:
 * - atom -deploy <service> --product <product>
 * - atom -deploy <service> --all
 * - atom -deploy --product <product> --all-services
 */
async function deployService(serviceName, options) {
  const {
    product,
    all,
    allServices,
    restart = false,
    dryRun = false,
    parallel = false,
    debug = false
  } = options;

  try {
    // Load deployment registry
    const registry = new DeploymentRegistry();

    // Validate command combinations
    if (!serviceName && !allServices) {
      console.error(chalk.red('Error: Must specify a service name or use --all-services'));
      console.log('\nUsage:');
      console.log('  atom -deploy <service> --product <product>');
      console.log('  atom -deploy <service> --all');
      console.log('  atom -deploy --product <product> --all-services');
      process.exit(1);
    }

    if (allServices && !product) {
      console.error(chalk.red('Error: --all-services requires --product flag'));
      process.exit(1);
    }

    if (serviceName && all && product) {
      console.error(chalk.red('Error: Cannot use both --all and --product together'));
      process.exit(1);
    }

    // Collect deployment targets
    let targets = [];

    if (allServices && product) {
      // Deploy all services for a product
      console.log(chalk.blue(`Deploying all services for product: ${chalk.bold(product)}\n`));

      const services = registry.getServicesForProduct(product);

      if (services.length === 0) {
        console.log(chalk.yellow(`No services configured for product "${product}"`));
        process.exit(0);
      }

      console.log(`Services to deploy: ${services.join(', ')}\n`);

      for (const svc of services) {
        const svcTargets = registry.getDeploymentTargets(svc, product);
        targets.push(...svcTargets);
      }

    } else if (serviceName && all) {
      // Deploy service to all products
      console.log(chalk.blue(`Deploying ${chalk.bold(serviceName)} to all products\n`));

      const products = registry.getProductsUsingService(serviceName);

      if (products.length === 0) {
        console.log(chalk.yellow(`Service "${serviceName}" is not configured for any products`));
        process.exit(0);
      }

      console.log(`Products: ${products.join(', ')}\n`);

      for (const prod of products) {
        const prodTargets = registry.getDeploymentTargets(serviceName, prod);
        targets.push(...prodTargets);
      }

    } else if (serviceName && product) {
      // Deploy specific service to specific product
      console.log(chalk.blue(`Deploying ${chalk.bold(serviceName)} to ${chalk.bold(product)}\n`));

      targets = registry.getDeploymentTargets(serviceName, product);

    } else {
      console.error(chalk.red('Error: Invalid command combination'));
      process.exit(1);
    }

    if (targets.length === 0) {
      console.log(chalk.yellow('No deployment targets found'));
      process.exit(0);
    }

    // Show deployment plan
    console.log(chalk.bold('Deployment Plan:'));
    targets.forEach((target, idx) => {
      console.log(`  ${idx + 1}. ${chalk.cyan(target.serviceName)} → ${chalk.green(target.server.hostname)} (${target.server.path})`);
    });
    console.log('');

    if (dryRun) {
      console.log(chalk.yellow('[DRY RUN] No actual deployment will be performed\n'));
    }

    // Execute deployments
    const deployer = new SSHDeployer({ debug, dryRun });
    const results = await deployer.deployMultiple(targets, { restart });

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log(chalk.bold('Deployment Summary'));
    console.log('='.repeat(60));

    if (results.successful.length > 0) {
      console.log(chalk.green(`\n✓ Successful deployments: ${results.successful.length}`));
      results.successful.forEach(r => {
        console.log(chalk.green(`  • ${r.service} → ${r.server}`));
      });
    }

    if (results.failed.length > 0) {
      console.log(chalk.red(`\n✗ Failed deployments: ${results.failed.length}`));
      results.failed.forEach(r => {
        console.log(chalk.red(`  • ${r.service} → ${r.server}`));
        console.log(chalk.gray(`    Error: ${r.error}`));
      });
    }

    console.log('');

    // Exit with appropriate code
    process.exit(results.failed.length > 0 ? 1 : 0);

  } catch (error) {
    console.error(chalk.red('Deployment error:'), error.message);
    if (debug) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

module.exports = deployService;
