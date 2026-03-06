const chalk = require('chalk');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const inquirer = require('inquirer');
const DeploymentRegistry = require('../utils/yamlParser');

/**
 * Auto-prepare registry from running services
 *
 * Discovers services running on this machine via:
 * - PM2 process list
 * - Git repository info
 * - File system scanning
 *
 * Then updates registry accordingly
 */
async function autoprepareRegistry(options) {
  const { product: productName, gitRemote } = options;

  // Parse git remote preference
  const gitRemotePreference = gitRemote
    ? gitRemote.split(',').map(r => r.trim())
    : ['origin', 'upstream'];

  console.log(chalk.blue('\n🔍 Auto-preparing registry from running services...\n'));
  if (gitRemote) {
    console.log(chalk.gray(`Git remote preference: ${gitRemotePreference.join(' > ')}\n`));
  }

  try {
    // 1. Discover running services
    const discoveredServices = await discoverServices(gitRemotePreference);

    if (discoveredServices.length === 0) {
      console.log(chalk.yellow('No Atom services found running on this machine'));
      console.log(chalk.gray('Make sure services are running via PM2'));
      return;
    }

    console.log(chalk.green(`Found ${discoveredServices.length} services:\n`));

    // 2. Load existing registry
    const registry = new DeploymentRegistry();

    // 3. Compare and categorize
    const { toAdd, toUpdate, alreadyCorrect } = categorizeServices(discoveredServices, registry);

    // 4. Show summary
    showSummary(toAdd, toUpdate, alreadyCorrect);

    if (toAdd.length === 0 && toUpdate.length === 0) {
      console.log(chalk.green('\n✓ Registry is already up to date!'));
      return;
    }

    // 5. Prompt for confirmation
    const { confirmUpdate } = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirmUpdate',
      message: 'Apply these changes to registry?',
      default: true
    }]);

    if (!confirmUpdate) {
      console.log(chalk.yellow('\nCancelled'));
      return;
    }

    // 6. Apply changes
    console.log(chalk.blue('\n📝 Updating registry...\n'));

    let addedCount = 0;
    let updatedCount = 0;

    // Add new services
    for (const service of toAdd) {
      try {
        registry.addService(service.name, {
          repo: service.repo,
          branch: service.branch
        });
        console.log(chalk.green(`  ✓ Added: ${service.name}`));
        addedCount++;
      } catch (error) {
        console.log(chalk.red(`  ✗ Failed to add ${service.name}: ${error.message}`));
      }
    }

    // Update existing services
    for (const service of toUpdate) {
      try {
        registry.updateService(service.name, {
          repo: service.repo,
          branch: service.branch
        });
        console.log(chalk.green(`  ✓ Updated: ${service.name}`));
        updatedCount++;
      } catch (error) {
        console.log(chalk.red(`  ✗ Failed to update ${service.name}: ${error.message}`));
      }
    }

    // 7. Optionally create/update product
    if (productName) {
      await handleProductCreation(registry, productName, discoveredServices);
    }

    console.log(chalk.green(`\n✓ Registry updated successfully!`));
    console.log(chalk.gray(`  Added: ${addedCount} services`));
    console.log(chalk.gray(`  Updated: ${updatedCount} services`));

  } catch (error) {
    console.error(chalk.red('\nError during auto-prepare:'), error.message);
    if (options.debug) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

/**
 * Discover services running on this machine
 */
async function discoverServices(gitRemotePreference = ['origin', 'upstream']) {
  const services = [];

  try {
    // Get PM2 process list
    const pm2Output = execSync('pm2 jlist', { encoding: 'utf8' });
    const processes = JSON.parse(pm2Output);

    console.log(chalk.gray(`Scanning ${processes.length} PM2 processes...\n`));

    for (const proc of processes) {
      // Skip if not running
      if (proc.pm2_env.status !== 'online') {
        continue;
      }

      const cwd = proc.pm2_env.pm_cwd || proc.pm2_env.cwd;
      const processName = proc.name;

      if (!cwd || !fs.existsSync(cwd)) {
        continue;
      }

      // Check if it's an Atom service
      const isAtomService = checkIfAtomService(cwd);

      if (!isAtomService) {
        console.log(chalk.gray(`  ⊗ ${processName} - Not an Atom service`));
        continue;
      }

      // Extract service info
      const serviceInfo = extractServiceInfo(cwd, processName, gitRemotePreference);

      if (serviceInfo) {
        services.push(serviceInfo);
        console.log(chalk.cyan(`  ✓ ${serviceInfo.name}`));
        console.log(chalk.gray(`    Path: ${cwd}`));
        console.log(chalk.gray(`    Repo: ${serviceInfo.repo}`));
        console.log(chalk.gray(`    Branch: ${serviceInfo.branch}${serviceInfo.remote ? ` (remote: ${serviceInfo.remote})` : ''}`));
      } else {
        console.log(chalk.yellow(`  ⚠ ${processName} - Could not extract git info`));
      }
    }

  } catch (error) {
    if (error.message.includes('pm2')) {
      throw new Error('PM2 not found or not running. Make sure PM2 is installed and services are running.');
    }
    throw error;
  }

  return services;
}

/**
 * Check if directory contains an Atom service
 */
function checkIfAtomService(dirPath) {
  // Check for typical Atom service structure
  const indicators = [
    'src/interface.js',
    'src/component/main.js',
    'src/lexicon/main.js'
  ];

  // Check if at least one indicator exists
  const hasStructure = indicators.some(indicator =>
    fs.existsSync(path.join(dirPath, indicator))
  );

  if (hasStructure) return true;

  // Fallback: Check package.json for atom dependency
  const packageJsonPath = path.join(dirPath, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      return !!(packageJson.dependencies && packageJson.dependencies.atom);
    } catch (error) {
      return false;
    }
  }

  return false;
}

/**
 * Extract service information from directory
 */
function extractServiceInfo(dirPath, processName, gitRemotePreference = ['origin', 'upstream']) {
  const info = {
    name: null,
    repo: null,
    branch: null,
    path: dirPath,
    remote: null
  };

  // 1. Get service name from package.json
  try {
    const packageJsonPath = path.join(dirPath, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      info.name = packageJson.name || processName;
    } else {
      info.name = processName;
    }
  } catch (error) {
    info.name = processName;
  }

  // 2. Get git repository URL (with remote preference)
  try {
    const gitConfigPath = path.join(dirPath, '.git/config');
    if (fs.existsSync(gitConfigPath)) {
      const gitConfig = fs.readFileSync(gitConfigPath, 'utf8');

      // Try remotes in preference order
      for (const remote of gitRemotePreference) {
        const remoteRegex = new RegExp(`\\[remote "${remote}"\\]\\s+url\\s*=\\s*(.+)`, 'm');
        const remoteMatch = gitConfig.match(remoteRegex);
        if (remoteMatch) {
          info.repo = remoteMatch[1].trim();
          info.remote = remote;
          break;
        }
      }

      // Fallback: any remote if preference not found
      if (!info.repo) {
        const anyRemoteMatch = gitConfig.match(/\[remote "(.+?)"\]\s+url\s*=\s*(.+)/m);
        if (anyRemoteMatch) {
          info.remote = anyRemoteMatch[1];
          info.repo = anyRemoteMatch[2].trim();
        }
      }
    }
  } catch (error) {
    // Git info not available
  }

  // 3. Get current branch
  try {
    const branch = execSync('git branch --show-current', {
      cwd: dirPath,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    }).trim();

    if (branch) {
      info.branch = branch;
    } else {
      // Fallback: parse HEAD
      const headPath = path.join(dirPath, '.git/HEAD');
      if (fs.existsSync(headPath)) {
        const head = fs.readFileSync(headPath, 'utf8').trim();
        const branchMatch = head.match(/ref: refs\/heads\/(.+)/);
        if (branchMatch) {
          info.branch = branchMatch[1];
        }
      }
    }
  } catch (error) {
    // Branch detection failed, use default
    info.branch = 'master';
  }

  // Only return if we have minimum required info
  if (info.name && info.repo && info.branch) {
    return info;
  }

  return null;
}

/**
 * Categorize services: to add, to update, or already correct
 */
function categorizeServices(discoveredServices, registry) {
  const toAdd = [];
  const toUpdate = [];
  const alreadyCorrect = [];

  for (const discovered of discoveredServices) {
    if (!registry.serviceExists(discovered.name)) {
      // New service
      toAdd.push(discovered);
    } else {
      // Existing service - check if needs update
      const existing = registry.getService(discovered.name);

      const repoChanged = existing.repo !== discovered.repo;
      const branchChanged = existing.branch !== discovered.branch;

      if (repoChanged || branchChanged) {
        toUpdate.push({
          ...discovered,
          existingRepo: existing.repo,
          existingBranch: existing.branch
        });
      } else {
        alreadyCorrect.push(discovered);
      }
    }
  }

  return { toAdd, toUpdate, alreadyCorrect };
}

/**
 * Show summary of changes
 */
function showSummary(toAdd, toUpdate, alreadyCorrect) {
  console.log('');

  if (toAdd.length > 0) {
    console.log(chalk.green.bold('New services (will be added):'));
    toAdd.forEach(service => {
      console.log(chalk.green(`  ✓ ${service.name}`));
      console.log(chalk.gray(`    ${service.repo} (branch: ${service.branch})`));
    });
    console.log('');
  }

  if (toUpdate.length > 0) {
    console.log(chalk.yellow.bold('Existing services (will be updated):'));
    toUpdate.forEach(service => {
      console.log(chalk.yellow(`  ↻ ${service.name}`));
      if (service.existingRepo !== service.repo) {
        console.log(chalk.gray(`    Repo: ${service.existingRepo}`));
        console.log(chalk.cyan(`       → ${service.repo}`));
      }
      if (service.existingBranch !== service.branch) {
        console.log(chalk.gray(`    Branch: ${service.existingBranch}`));
        console.log(chalk.cyan(`         → ${service.branch}`));
      }
    });
    console.log('');
  }

  if (alreadyCorrect.length > 0) {
    console.log(chalk.gray.bold('Already correct:'));
    alreadyCorrect.forEach(service => {
      console.log(chalk.gray(`  • ${service.name}`));
    });
    console.log('');
  }

  console.log(chalk.bold('Summary:'));
  console.log(`  To add: ${chalk.green(toAdd.length)}`);
  console.log(`  To update: ${chalk.yellow(toUpdate.length)}`);
  console.log(`  Already correct: ${chalk.gray(alreadyCorrect.length)}`);
  console.log('');
}

/**
 * Handle product creation/update
 */
async function handleProductCreation(registry, productName, discoveredServices) {
  console.log(chalk.blue(`\n📦 Handling product: ${productName}`));

  const hostname = os.hostname();
  const basePath = path.dirname(discoveredServices[0].path);

  if (!registry.productExists(productName)) {
    // Create new product
    console.log(chalk.gray(`  Creating new product...`));

    const { confirmProduct } = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirmProduct',
      message: `Create product "${productName}" with server "${hostname}"?`,
      default: true
    }]);

    if (confirmProduct) {
      registry.addProduct(productName, {
        servers: [{
          hostname: hostname,
          path: basePath + '/'
        }],
        services: []
      });
      console.log(chalk.green(`  ✓ Product "${productName}" created`));
    }
  }

  if (registry.productExists(productName)) {
    // Link all discovered services to this product
    const existingServices = registry.getServicesForProduct(productName);
    let linkedCount = 0;

    for (const service of discoveredServices) {
      if (!existingServices.includes(service.name)) {
        try {
          registry.linkServiceToProduct(service.name, productName);
          console.log(chalk.green(`  ✓ Linked: ${service.name}`));
          linkedCount++;
        } catch (error) {
          console.log(chalk.yellow(`  ⚠ ${service.name}: ${error.message}`));
        }
      }
    }

    if (linkedCount > 0) {
      console.log(chalk.green(`\n✓ Linked ${linkedCount} services to product "${productName}"`));
    } else {
      console.log(chalk.gray(`\n  All services already linked to "${productName}"`));
    }
  }
}

module.exports = autoprepareRegistry;
