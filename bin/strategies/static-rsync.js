/**
 * Strategy: static-rsync
 *
 * Ships a locally-built artifact directory (e.g. a frontend `dist/`) to the served
 * path on each target server via `rsync -az --delete -e ssh`. For stack-agnostic
 * webapps/sites (React/Muffin SPAs, static sites) that are NOT Atom services — the
 * artifact is built where it's built today (local/CI) and this pushes it. nginx serves
 * updated files immediately (no reload needed); a `post_deploy` hook is available for
 * the rare case that needs one.
 *
 * Registry fields (on the service):
 *   type: static-rsync
 *   source: dist/                 # local artifact dir (rel to local_root||cwd, or absolute)
 *   target_path: /home/ubuntu/hais/app/dist   # served path on the server
 *   local_root: /path/to/project  # optional; base for a relative `source`
 *   post_deploy: ["cmd", ...]     # optional remote commands to run after rsync
 *
 * Never touches the atom-service path. Uses ssh config aliases (server.hostname).
 */
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');
const chalk = require('chalk');

function resolveSource(target) {
  const src = target.source;
  if (!src) throw new Error(`static-rsync: "source" not set for ${target.serviceName}`);
  const base = target.localRoot || process.cwd();
  const abs = path.isAbsolute(src) ? src : path.resolve(base, src);
  if (!fs.existsSync(abs)) throw new Error(`static-rsync: source not found: ${abs}`);
  // trailing slash => copy CONTENTS into target (not the dir itself)
  return abs.endsWith('/') ? abs : abs + '/';
}

function remoteDest(target) {
  const server = target.server;
  const dest = target.targetPath || path.join(server.path || '', target.serviceName);
  const hostspec = server.username ? `${server.username}@${server.hostname}` : server.hostname;
  return { hostspec, dest, url: `${hostspec}:${dest}` };
}

async function deployOne(target, options = {}) {
  const { dryRun = false, debug = false } = options;
  const src = resolveSource(target);
  const { hostspec, dest, url } = remoteDest(target);

  const args = ['-az', '--delete', '-e', 'ssh'];
  if (dryRun) args.push('--dry-run');
  args.push(src, url);

  console.log(chalk.blue(`\n[static-rsync] ${chalk.bold(target.serviceName)} → ${target.server.hostname}:${dest}`));
  if (debug || dryRun) console.log(chalk.gray(`  rsync ${args.join(' ')}`));

  const r = spawnSync('rsync', args, { encoding: 'utf8' });
  if (r.status !== 0) {
    throw new Error(`rsync failed (${r.status}): ${(r.stderr || r.error?.message || '').trim()}`);
  }
  if (debug && r.stdout) console.log(chalk.gray(r.stdout.trim()));

  // optional post-deploy remote hook (rarely needed)
  const hooks = Array.isArray(target.postDeploy) ? target.postDeploy : (target.postDeploy ? [target.postDeploy] : []);
  if (hooks.length && !dryRun) {
    const cmd = hooks.join(' && ');
    console.log(chalk.gray(`  post_deploy: ${cmd}`));
    const h = spawnSync('ssh', [hostspec, cmd], { encoding: 'utf8' });
    if (h.status !== 0) throw new Error(`post_deploy failed: ${(h.stderr || '').trim()}`);
  }
  console.log(chalk.green(`  ✓ synced${dryRun ? ' (dry-run)' : ''}`));
}

async function deployMany(targets, options = {}) {
  const successful = [], failed = [];
  for (const t of targets) {
    try {
      await deployOne(t, options);
      successful.push({ service: t.serviceName, server: t.server.hostname });
    } catch (e) {
      console.log(chalk.red(`  ✗ ${t.serviceName} → ${t.server.hostname}: ${e.message}`));
      failed.push({ service: t.serviceName, server: t.server.hostname, error: e.message });
    }
  }
  return { successful, failed };
}

module.exports = { type: 'static-rsync', deployMany, deployOne };
