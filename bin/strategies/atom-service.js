/**
 * Strategy: atom-service (DEFAULT)
 *
 * The canonical Atom microservice flow: server pulls from git origin
 * (clone / fetch + reset --hard), npm install, pm2 restart.
 *
 * This delegates to the proven SSHDeployer.deployMultiple() unchanged — i.e. it IS
 * the pre-existing behavior, now surfaced through the strategy interface. Keeping the
 * working transport as the single implementation is deliberate: zero regression risk.
 */
const SSHDeployer = require('../utils/sshDeployer');

async function deployMany(targets, options = {}) {
  const { debug = false, dryRun = false, restart = false, skipInstall = false } = options;
  const deployer = new SSHDeployer({ debug, dryRun });
  return deployer.deployMultiple(targets, { restart, skipInstall });
}

module.exports = { type: 'atom-service', deployMany };
