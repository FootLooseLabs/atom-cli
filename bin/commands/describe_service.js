/**
 * atom deploy <service> --describe
 *
 * Read-only. Shows the full deployment identity of a service from the registry:
 * repo, branch, and every product -> server (hostname, path, user) it targets,
 * plus merged env (service-level + product-level + product/service-specific).
 * Purely informational; deploys nothing.
 */
const chalk = require("chalk");
const DeploymentRegistry = require("../utils/yamlParser");

function describeService(serviceName, options = {}) {
  if (!serviceName || typeof serviceName !== "string") {
    console.error(chalk.red("Usage: atom deploy <service> --describe"));
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
    console.log(chalk.yellow(`Service "${serviceName}" is not defined in the registry.`));
    console.log(chalk.gray(`Registry: ${registry.registryPath}`));
    return;
  }

  const products = registry.getProductsUsingService(serviceName);

  console.log(chalk.bold.blue(`\nService: ${serviceName}`));
  console.log(chalk.gray(`Registry:   ${registry.registryPath}`));
  console.log(chalk.gray(`Repository: ${service.repo || "(none)"}`));
  console.log(chalk.gray(`Branch:     ${service.branch || "(default)"}`));
  if (service.env && Object.keys(service.env).length) {
    console.log(chalk.gray(`Service env: ${Object.keys(service.env).join(", ")}`));
  }

  if (!products.length) {
    console.log(chalk.yellow("\nNot targeted by any product (won't deploy anywhere)."));
    return;
  }

  console.log(chalk.bold(`\nTargets (${products.length} product${products.length > 1 ? "s" : ""}):`));
  for (const productName of products) {
    const product = registry.getProduct(productName) || {};
    console.log(chalk.cyan(`\n  ● ${productName}`));
    for (const server of product.servers || []) {
      const user = server.username || "ubuntu";
      const key = server.ssh_key ? ` (key: ${server.ssh_key})` : "";
      console.log(`      ${user}@${server.hostname}:${server.path || "?"}${key}`);
    }
    if (product.env && Object.keys(product.env).length) {
      console.log(chalk.gray(`      product env: ${Object.keys(product.env).join(", ")}`));
    }
  }
  console.log();
}

module.exports = describeService;
