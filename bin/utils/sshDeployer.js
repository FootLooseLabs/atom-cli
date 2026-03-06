const { NodeSSH } = require('node-ssh');
const fs = require('fs');
const path = require('path');
const os = require('os');
const chalk = require('chalk');

/**
 * SSH-based service deployer
 */
class SSHDeployer {
  constructor(options = {}) {
    this.debug = options.debug || false;
    this.dryRun = options.dryRun || false;
    this.ssh = new NodeSSH();
  }

  /**
   * Log debug messages
   */
  log(message, type = 'info') {
    if (!this.debug && type === 'debug') return;

    const colors = {
      info: chalk.blue,
      success: chalk.green,
      error: chalk.red,
      warning: chalk.yellow,
      debug: chalk.gray
    };

    const color = colors[type] || chalk.white;
    console.log(color(message));
  }

  /**
   * Resolve SSH key path
   */
  resolveSSHKey(keyPath) {
    if (!keyPath) {
      // Default to ~/.ssh/id_rsa
      return path.join(os.homedir(), '.ssh', 'id_rsa');
    }

    // Expand ~ to home directory
    if (keyPath.startsWith('~/')) {
      return path.join(os.homedir(), keyPath.slice(2));
    }

    return keyPath;
  }

  /**
   * Connect to server via SSH
   */
  async connect(server) {
    const sshKeyPath = this.resolveSSHKey(server.ssh_key);

    this.log(`Connecting to ${server.hostname}...`, 'debug');

    if (this.dryRun) {
      this.log(`[DRY RUN] Would connect to ${server.hostname}`, 'info');
      return;
    }

    try {
      // Check if SSH key exists
      if (!fs.existsSync(sshKeyPath)) {
        throw new Error(`SSH key not found at: ${sshKeyPath}`);
      }

      await this.ssh.connect({
        host: server.hostname,
        username: server.username || 'ubuntu', // Default to ubuntu
        privateKeyPath: sshKeyPath,
        readyTimeout: 30000 // 30 second timeout
      });

      this.log(`Connected to ${server.hostname}`, 'success');
    } catch (error) {
      throw new Error(`Failed to connect to ${server.hostname}: ${error.message}`);
    }
  }

  /**
   * Disconnect from server
   */
  disconnect() {
    if (this.ssh.isConnected()) {
      this.ssh.dispose();
      this.log('Disconnected from server', 'debug');
    }
  }

  /**
   * Execute command on remote server
   */
  async execCommand(command, options = {}) {
    this.log(`Executing: ${command}`, 'debug');

    if (this.dryRun) {
      this.log(`[DRY RUN] Would execute: ${command}`, 'info');
      return { code: 0, stdout: '', stderr: '' };
    }

    try {
      const result = await this.ssh.execCommand(command, options);

      if (this.debug && result.stdout) {
        console.log(chalk.gray(result.stdout));
      }

      if (result.stderr && result.code !== 0) {
        console.error(chalk.red(result.stderr));
      }

      return result;
    } catch (error) {
      throw new Error(`Command failed: ${error.message}`);
    }
  }

  /**
   * Check if directory exists on remote server
   */
  async directoryExists(dirPath) {
    const result = await this.execCommand(`test -d "${dirPath}" && echo "exists" || echo "not-exists"`);
    return result.stdout.trim() === 'exists';
  }

  /**
   * Clone git repository
   */
  async cloneRepo(repo, branch, targetPath) {
    this.log(`Cloning ${repo} (branch: ${branch})...`, 'info');

    const command = `git clone -b ${branch} ${repo} "${targetPath}"`;
    const result = await this.execCommand(command);

    if (result.code !== 0) {
      throw new Error(`Git clone failed: ${result.stderr}`);
    }

    this.log('Repository cloned successfully', 'success');
  }

  /**
   * Pull latest changes from git
   */
  async pullRepo(repoPath, branch) {
    this.log(`Pulling latest changes (branch: ${branch})...`, 'info');

    // Fetch and reset to latest
    const commands = [
      `cd "${repoPath}" && git fetch origin`,
      `cd "${repoPath}" && git checkout ${branch}`,
      `cd "${repoPath}" && git reset --hard origin/${branch}`
    ];

    for (const command of commands) {
      const result = await this.execCommand(command);
      if (result.code !== 0) {
        throw new Error(`Git pull failed: ${result.stderr}`);
      }
    }

    this.log('Repository updated successfully', 'success');
  }

  /**
   * Install npm dependencies
   */
  async npmInstall(repoPath) {
    this.log('Installing dependencies...', 'info');

    const result = await this.execCommand(`cd "${repoPath}" && npm install`, {
      cwd: repoPath
    });

    if (result.code !== 0) {
      throw new Error(`npm install failed: ${result.stderr}`);
    }

    this.log('Dependencies installed successfully', 'success');
  }

  /**
   * Create or update .env file
   */
  async writeEnvFile(repoPath, envVars) {
    if (!envVars || Object.keys(envVars).length === 0) {
      this.log('No environment variables to write', 'debug');
      return;
    }

    this.log('Writing environment variables...', 'info');

    // Generate .env content
    const envContent = Object.entries(envVars)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    // Write to .env file
    const envPath = path.join(repoPath, '.env');
    const command = `cat > "${envPath}" << 'EOF'\n${envContent}\nEOF`;

    const result = await this.execCommand(command);

    if (result.code !== 0) {
      throw new Error(`Failed to write .env file: ${result.stderr}`);
    }

    this.log(`.env file updated with ${Object.keys(envVars).length} variables`, 'success');
  }

  /**
   * Restart service using PM2
   */
  async restartService(serviceName, repoPath) {
    this.log(`Restarting service via PM2...`, 'info');

    // Try to restart, if not running then start
    const restartCommand = `cd "${repoPath}" && pm2 restart ${serviceName} || pm2 start npm --name ${serviceName} -- start`;
    const result = await this.execCommand(restartCommand);

    if (result.code !== 0) {
      throw new Error(`PM2 restart failed: ${result.stderr}`);
    }

    this.log('Service restarted successfully', 'success');
  }

  /**
   * Deploy service to server
   * Main deployment orchestration method
   */
  async deploy(target, options = {}) {
    const { server, serviceName, repo, branch, env } = target;
    const { restart = false } = options;

    const serviceDir = path.join(server.path, serviceName);

    this.log(`\n${'='.repeat(60)}`, 'info');
    this.log(`Deploying ${chalk.bold(serviceName)} to ${chalk.bold(server.hostname)}`, 'info');
    this.log(`${'='.repeat(60)}`, 'info');

    try {
      // Connect to server
      await this.connect(server);

      // Check if service directory exists
      const exists = await this.directoryExists(serviceDir);

      if (!exists) {
        // Clone repository
        this.log('Service not found on server, cloning repository...', 'info');

        // Ensure base path exists
        await this.execCommand(`mkdir -p "${server.path}"`);

        // Clone
        await this.cloneRepo(repo, branch, serviceDir);
      } else {
        // Pull latest changes
        this.log('Service found, updating to latest version...', 'info');
        await this.pullRepo(serviceDir, branch);
      }

      // Install dependencies
      await this.npmInstall(serviceDir);

      // Write environment variables
      if (env && Object.keys(env).length > 0) {
        await this.writeEnvFile(serviceDir, env);
      }

      // Restart service if requested
      if (restart) {
        await this.restartService(serviceName, serviceDir);
      }

      this.log(`\n${chalk.green('✓')} Deployment successful`, 'success');

      return {
        success: true,
        server: server.hostname,
        service: serviceName
      };

    } catch (error) {
      this.log(`\n${chalk.red('✗')} Deployment failed: ${error.message}`, 'error');

      return {
        success: false,
        server: server.hostname,
        service: serviceName,
        error: error.message
      };

    } finally {
      // Always disconnect
      this.disconnect();
    }
  }

  /**
   * Deploy to multiple targets
   */
  async deployMultiple(targets, options = {}) {
    const results = {
      successful: [],
      failed: []
    };

    for (const target of targets) {
      const result = await this.deploy(target, options);

      if (result.success) {
        results.successful.push(result);
      } else {
        results.failed.push(result);
      }
    }

    return results;
  }
}

module.exports = SSHDeployer;
