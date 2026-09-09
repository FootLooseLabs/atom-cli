/**
 * Deploy strategy dispatcher.
 *
 * Separation of concerns:
 *   - Orchestration (which services→servers, plan, summary)  -> commands/deploy_service.js
 *   - Strategy (HOW a given target is deployed, per `type`)  -> strategies/*.js  (this dir)
 *   - Transport (SSH connect/exec)                           -> utils/sshDeployer.js
 *
 * Each strategy module exports:
 *   type: string
 *   async deployMany(targets, options) -> { successful: [...], failed: [...] }
 *
 * A target's `type` (from the registry, default 'atom-service') selects the strategy.
 * Targets are grouped by type so each strategy runs its own batch; results are merged.
 */
const atomService = require('./atom-service');
const staticRsync = require('./static-rsync');

const STRATEGIES = {
  [atomService.type]: atomService,   // 'atom-service': git pull + npm install + pm2 (default)
  [staticRsync.type]: staticRsync,   // 'static-rsync': ship a built artifact dir to a served path
};

function strategyFor(type) {
  return STRATEGIES[type || 'atom-service'] || null;
}

async function deployTargets(targets, options = {}) {
  // Group targets by strategy type (stable, non-regressive: atom-service batch == old path).
  const groups = {};
  for (const t of targets) {
    const type = t.type || 'atom-service';
    (groups[type] = groups[type] || []).push(t);
  }

  const merged = { successful: [], failed: [] };
  for (const [type, group] of Object.entries(groups)) {
    const strategy = strategyFor(type);
    if (!strategy) {
      group.forEach(t => merged.failed.push({
        service: t.serviceName, server: t.server.hostname,
        error: `unknown deploy type "${type}" (no strategy registered)`,
      }));
      continue;
    }
    const res = await strategy.deployMany(group, options);
    merged.successful.push(...(res.successful || []));
    merged.failed.push(...(res.failed || []));
  }
  return merged;
}

module.exports = { deployTargets, strategyFor, STRATEGIES };
