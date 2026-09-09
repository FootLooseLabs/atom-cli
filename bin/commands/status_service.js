/**
 * atom deploy <service> --status
 *
 * Read-only. For each server the service targets, SSHes and reports the LIVE
 * deployed state: git short SHA, branch, working-tree dirty count, and best-effort
 * pm2 status. Runs ONLY read commands (git rev-parse / status --porcelain, pm2 jlist).
 * Never fetches, resets, installs, or restarts. Answers "what code is live where".
 */
const path = require("path");
const chalk = require("chalk");
const DeploymentRegistry = require("../utils/yamlParser");
const SSHDeployer = require("../utils/sshDeployer");

async function statusService(serviceName, options = {}) {
  if (!serviceName || typeof serviceName !== "string") {
    console.error(chalk.red("Usage: atom deploy <service> --status"));
    return;
  }

  let registry;
  try {
    registry = new DeploymentRegistry();
  } catch (e) {
    console.error(chalk.red("Error loading registry:"), e.message);
    return;
  }

  const service = registry.getService(serviceName);
  if (!service) {
    console.log(chalk.yellow(`Service "${serviceName}" is not in the registry.`));
    return;
  }
  const products = registry.getProductsUsingService(serviceName);
  if (!products.length) {
    console.log(chalk.yellow(`"${serviceName}" targets no products.`));
    return;
  }

  console.log(chalk.bold.blue(`\nLive status: ${serviceName}`));
  console.log(chalk.gray(`registry branch: ${service.branch || "(default)"}\n`));

  const deployer = new SSHDeployer({ debug: options.debug });

  for (const productName of products) {
    const product = registry.getProduct(productName) || {};
    for (const server of product.servers || []) {
      const dir = path.join(server.path || "", serviceName);
      process.stdout.write(chalk.cyan(`  ${productName} @ ${server.hostname}  `));
      try {
        await deployer.connect(server);
        // Single read-only probe (newline-separated; syntactically complete).
        const probe = [
          `D="${dir}"`,
          `if [ -d "$D/.git" ]; then`,
          `  echo "sha=$(git -C "$D" rev-parse --short HEAD 2>/dev/null)"`,
          `  echo "branch=$(git -C "$D" rev-parse --abbrev-ref HEAD 2>/dev/null)"`,
          `  echo "dirty=$(git -C "$D" status --porcelain 2>/dev/null | wc -l | tr -d ' ')"`,
          `else`,
          `  echo "repo=MISSING"`,
          `fi`,
          `echo "pm2=$(pm2 pid ${serviceName} 2>/dev/null | tr -d '\\n' || echo '?')"`,
        ].join("\n");
        const res = await deployer.execCommand(probe);
        const out = {};
        (res.stdout || "").split("\n").forEach((l) => {
          const i = l.indexOf("=");
          if (i > 0) out[l.slice(0, i).trim()] = l.slice(i + 1).trim();
        });
        if (out.repo === "MISSING") {
          console.log(chalk.yellow(`not deployed (no repo at ${dir})`));
        } else {
          const dirty = out.dirty && out.dirty !== "0" ? chalk.red(`dirty:${out.dirty}`) : chalk.green("clean");
          const pm2 = out.pm2 && out.pm2 !== "?" && out.pm2 !== "" ? chalk.green(`pm2:up(${out.pm2})`) : chalk.gray("pm2:?");
          const onBranch = service.branch && out.branch && out.branch !== service.branch
            ? chalk.red(`branch:${out.branch}≠${service.branch}`)
            : chalk.gray(`branch:${out.branch || "?"}`);
          console.log(`${chalk.bold(out.sha || "?")}  ${onBranch}  ${dirty}  ${pm2}`);
        }
      } catch (e) {
        console.log(chalk.red(`unreachable (${e.message})`));
      } finally {
        try { await deployer.disconnect(); } catch (_) {}
      }
    }
  }
  console.log();
}

module.exports = statusService;
