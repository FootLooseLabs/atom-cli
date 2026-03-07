const { NodeSSH } = require('node-ssh');
const fs = require('fs');
const path = require('path');
const os = require('os');
const chalk = require('chalk');
const inquirer = require('inquirer');
const { execSync } = require('child_process');

/**
 * SSH-based service deployer
 */
class SSHDeployer {
  constructor(options = {}) {
    this.debug = options.debug || false;
    this.dryRun = options.dryRun || false;
    this.ssh = new NodeSSH();
    this.passphraseCache = {}; // Cache passphrases per SSH key path
    this.currentServer = null; // Track current server for native SSH fallback
    this.useNativeSSH = true; // Use native SSH for better agent forwarding support
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
   * Parse SSH config for a host using native ssh -G command
   * This ensures we get exactly the same behavior as native ssh
   */
  parseSSHConfig(hostname) {
    try {
      // Use ssh -G to get the effective configuration
      // This reads ~/.ssh/config and applies all the settings
      const output = execSync(`ssh -G ${hostname}`, { encoding: 'utf8' });

      const config = {};
      output.split('\n').forEach(line => {
        const [key, ...valueParts] = line.split(' ');
        const value = valueParts.join(' ');

        // Extract the settings we need
        if (key === 'hostname') config.hostname = value;
        if (key === 'user') config.user = value;
        if (key === 'port') config.port = parseInt(value);
        if (key === 'identityfile') {
          // ssh -G returns the first matching identity file
          if (!config.identityfile) {
            config.identityfile = value.replace(/^~/, os.homedir());
          }
        }
      });

      return config;
    } catch (error) {
      this.log(`Failed to parse SSH config for ${hostname}: ${error.message}`, 'warning');
      return null;
    }
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
    this.log(`Connecting to ${server.hostname}...`, 'debug');

    if (this.dryRun) {
      this.log(`[DRY RUN] Would connect to ${server.hostname}`, 'info');
      return;
    }

    try {
      // First, try to parse SSH config to get native ssh behavior
      const sshConfig = this.parseSSHConfig(server.hostname);

      // Determine connection parameters (SSH config takes precedence)
      const actualHostname = sshConfig?.hostname || server.hostname;
      const actualUser = sshConfig?.user || server.username || 'ubuntu';
      const actualPort = sshConfig?.port || 22;

      // For SSH key, prefer: registry config > SSH config > default
      let sshKeyPath;
      if (server.ssh_key) {
        // Registry explicitly specifies a key
        sshKeyPath = this.resolveSSHKey(server.ssh_key);
      } else if (sshConfig?.identityfile) {
        // Use key from SSH config
        sshKeyPath = sshConfig.identityfile;
      } else {
        // Fallback to default
        sshKeyPath = this.resolveSSHKey(null);
      }

      this.log(`Using SSH key: ${sshKeyPath}`, 'debug');
      this.log(`Connecting to ${actualUser}@${actualHostname}:${actualPort}`, 'debug');

      // Check if SSH key exists
      if (!fs.existsSync(sshKeyPath)) {
        throw new Error(`SSH key not found at: ${sshKeyPath}`);
      }

      // Check if we have a cached passphrase for this key
      const cachedPassphrase = this.passphraseCache[sshKeyPath];

      // Try connecting (with cached passphrase if available)
      try {
        const connectOptions = {
          host: actualHostname,
          username: actualUser,
          port: actualPort,
          privateKeyPath: sshKeyPath,
          readyTimeout: 30000 // 30 second timeout
        };

        // Enable SSH agent forwarding if agent is available
        if (process.env.SSH_AUTH_SOCK) {
          connectOptions.agent = process.env.SSH_AUTH_SOCK;
          connectOptions.agentForward = true;
        }

        if (cachedPassphrase) {
          connectOptions.passphrase = cachedPassphrase;
        }

        await this.ssh.connect(connectOptions);

        // Save current server for native SSH fallback
        this.currentServer = server;

        this.log(`Connected to ${server.hostname}`, 'success');
      } catch (error) {
        // Check if error is due to encrypted key
        if (error.message && error.message.includes('Encrypted private') && error.message.includes('no passphrase')) {
          this.log(`SSH key is encrypted, passphrase required`, 'warning');

          // Prompt for passphrase
          const answers = await inquirer.prompt([
            {
              type: 'password',
              name: 'passphrase',
              message: `Enter passphrase for SSH key (${path.basename(sshKeyPath)}):`,
              mask: '*'
            }
          ]);

          // Cache the passphrase
          this.passphraseCache[sshKeyPath] = answers.passphrase;

          // Retry with passphrase
          const retryOptions = {
            host: actualHostname,
            username: actualUser,
            port: actualPort,
            privateKeyPath: sshKeyPath,
            passphrase: answers.passphrase,
            readyTimeout: 30000
          };

          // Enable SSH agent forwarding if agent is available
          if (process.env.SSH_AUTH_SOCK) {
            retryOptions.agent = process.env.SSH_AUTH_SOCK;
            retryOptions.agentForward = true;
          }

          await this.ssh.connect(retryOptions);

          // Save current server for native SSH fallback
          this.currentServer = server;

          this.log(`Connected to ${server.hostname}`, 'success');
        } else {
          throw error;
        }
      }
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
   * Execute command on remote server using native SSH
   * This ensures agent forwarding works correctly
   */
  async execCommand(command, options = {}) {
    this.log(`Executing: ${command}`, 'debug');

    if (this.dryRun) {
      this.log(`[DRY RUN] Would execute: ${command}`, 'info');
      return { code: 0, stdout: '', stderr: '' };
    }

    try {
      // If we're connected via node-ssh, check if we should use native SSH instead
      // Native SSH is more reliable for agent forwarding
      if (this.useNativeSSH && this.currentServer) {
        // Use native SSH with agent forwarding (-A)
        const sshCommand = `ssh -A ${this.currentServer.hostname} '${command.replace(/'/g, "'\\''")}'`;

        this.log(`Using native SSH: ${sshCommand}`, 'debug');

        try {
          const output = execSync(sshCommand, {
            encoding: 'utf8',
            stdio: ['inherit', 'pipe', 'pipe'],
            maxBuffer: 10 * 1024 * 1024 // 10MB buffer
          });

          return {
            code: 0,
            stdout: output,
            stderr: ''
          };
        } catch (error) {
          return {
            code: error.status || 1,
            stdout: error.stdout ? error.stdout.toString() : '',
            stderr: error.stderr ? error.stderr.toString() : error.message
          };
        }
      }

      // Fallback to node-ssh
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

    // When using native SSH with -A, agent forwarding happens automatically
    // We just need to tell git to accept new host keys
    const command = `GIT_SSH_COMMAND="ssh -o StrictHostKeyChecking=accept-new" git clone -b ${branch} ${repo} "${targetPath}"`;

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

    // When using native SSH with -A, agent forwarding happens automatically
    const sshCommand = `GIT_SSH_COMMAND="ssh -o StrictHostKeyChecking=accept-new"`;

    // Fetch and reset to latest
    const commands = [
      `cd "${repoPath}" && ${sshCommand} git fetch origin`,
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
    const { restart = false, skipInstall = false } = options;

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

      // Install dependencies (unless skipped)
      if (!skipInstall) {
        await this.npmInstall(serviceDir);
      } else {
        this.log('Skipping npm install (--skip-install flag used)', 'info');
      }

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
