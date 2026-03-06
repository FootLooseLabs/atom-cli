#!/usr/bin/env node
const { spawnSync, execSync } = require("child_process");
const { program } = require("commander");

// Global debug option
program
  .option("-d, --debug", "output extra debugging");

// Command: init
program
  .command("init")
  .description("Initialize a new Atom component")
  .action((options) => {
    const globalOpts = program.opts();
    if (globalOpts.debug) console.log(options);
    console.log("init atom component");
    require("./commands/init_atom_component")();
  });

// Command: start
program
  .command("start")
  .description("Start Atom nucleus daemon")
  .action((options) => {
    const globalOpts = program.opts();
    if (globalOpts.debug) console.log(options);
    console.log("start/run atom.nucleus daemon");
    require("./commands/start_nucleus_daemon")();
  });

// Command: signal
program
  .command("signal")
  .description("Send signal to Atom service")
  .action((options) => {
    const globalOpts = program.opts();
    if (globalOpts.debug) console.log(options);
    console.log("cli to send atom signals");
    require("./commands/send_signal")();
  });

// Command: diagnose
program
  .command("diagnose")
  .description("Diagnose Atom nucleus connection and state")
  .action((options) => {
    const globalOpts = program.opts();
    if (globalOpts.debug) console.log(options);
    console.log("diagnosing atom nucleus");
    require("./commands/diagnose_nucleus")();
  });

// Command: introspect
program
  .command("introspect")
  .description("Start introspective interface")
  .action((options) => {
    const globalOpts = program.opts();
    if (globalOpts.debug) console.log(options);
    console.log("\n launching introspective interface \n");
    console.log(
      "\t - discover & interact with interfaces available in the env \n",
    );
    console.log("\t - send atom signals \n");
    require("./commands/start_introspective_interface")();
  });

// Command: startenv
program
  .command("startenv <config-path>")
  .description("Start Atom environment from config file")
  .action((configPath, options) => {
    const globalOpts = program.opts();
    if (globalOpts.debug) console.log(options);
    console.log(
      "starting atom env - defined in config file = ",
      configPath.toString(),
    );
    require("./commands/start_env")(configPath.toString());
  });

// Command: broadcast
program
  .command("broadcast <interface-payload>")
  .description("Broadcast message to service (format: @service:::topic:::{data})")
  .action((interfacePayload, options) => {
    const globalOpts = program.opts();
    if (globalOpts.debug) console.log(options);
    console.log(
      "ATOM: preparing broadcast -",
      interfacePayload.toString(),
    );
    require("./commands/broadcast")(interfacePayload.toString());
  });

// Command: deploy
program
  .command("deploy [service]")
  .description("Deploy service(s) to product(s)")
  .option("--product <product>", "target product for deployment")
  .option("--all", "deploy to all products")
  .option("--all-services", "deploy all services for a product")
  .option("--list", "list deployment information")
  .option("--restart", "restart service after deployment using PM2")
  .option("--dry-run", "show what would be deployed without executing")
  .option("--parallel", "deploy to multiple servers in parallel")
  .action((service, options) => {
    const globalOpts = program.opts();
    if (globalOpts.debug) console.log({ service, options });

    // Check if this is a list operation
    if (options.list) {
      require("./commands/list_deployments")(service, {
        ...options,
        debug: globalOpts.debug
      });
    } else {
      // This is a deployment operation
      require("./commands/deploy_service")(service, {
        ...options,
        debug: globalOpts.debug
      });
    }
  });

// Command: registry (parent command with nested subcommands)
const registry = program
  .command("registry")
  .description("Manage deployment registry");

// registry list
registry
  .command("list")
  .description("List services and products")
  .option("--services", "show only services")
  .option("--products", "show only products")
  .action((options) => {
    const globalOpts = program.opts();
    require("./commands/manage_registry")("list", {
      services: options.services,
      products: options.products,
      debug: globalOpts.debug
    });
  });

// registry search
registry
  .command("search")
  .description("Search registry by keyword")
  .requiredOption("--keyword <keyword>", "search keyword")
  .action((options) => {
    const globalOpts = program.opts();
    require("./commands/manage_registry")("search", {
      keyword: options.keyword,
      debug: globalOpts.debug
    });
  });

// registry show
registry
  .command("show")
  .description("Show service or product details")
  .requiredOption("--name <name>", "service or product name")
  .action((options) => {
    const globalOpts = program.opts();
    require("./commands/manage_registry")("show", {
      name: options.name,
      debug: globalOpts.debug
    });
  });

// registry add-service
registry
  .command("add-service")
  .description("Add a new service to registry")
  .requiredOption("--name <name>", "service name")
  .requiredOption("--repo <url>", "git repository URL")
  .requiredOption("--branch <branch>", "git branch name")
  .action((options) => {
    const globalOpts = program.opts();
    require("./commands/manage_registry")("add-service", {
      name: options.name,
      repo: options.repo,
      branch: options.branch,
      debug: globalOpts.debug
    });
  });

// registry add-product
registry
  .command("add-product")
  .description("Add a new product to registry")
  .requiredOption("--name <name>", "product name")
  .requiredOption("--server <hostname>", "server hostname")
  .requiredOption("--path <path>", "deployment path on server")
  .option("--ssh-key <path>", "SSH key path")
  .option("--username <user>", "SSH username")
  .action((options) => {
    const globalOpts = program.opts();
    require("./commands/manage_registry")("add-product", {
      name: options.name,
      server: options.server,
      path: options.path,
      sshKey: options.sshKey,
      username: options.username,
      debug: globalOpts.debug
    });
  });

// registry link
registry
  .command("link")
  .description("Link service to product")
  .requiredOption("--service <service>", "service name")
  .requiredOption("--product <product>", "product name")
  .action((options) => {
    const globalOpts = program.opts();
    require("./commands/manage_registry")("link", {
      service: options.service,
      product: options.product,
      debug: globalOpts.debug
    });
  });

// registry unlink
registry
  .command("unlink")
  .description("Unlink service from product")
  .requiredOption("--service <service>", "service name")
  .requiredOption("--product <product>", "product name")
  .action((options) => {
    const globalOpts = program.opts();
    require("./commands/manage_registry")("unlink", {
      service: options.service,
      product: options.product,
      debug: globalOpts.debug
    });
  });

// registry remove-service
registry
  .command("remove-service")
  .description("Remove service from registry")
  .requiredOption("--name <name>", "service name")
  .action((options) => {
    const globalOpts = program.opts();
    require("./commands/manage_registry")("remove-service", {
      name: options.name,
      debug: globalOpts.debug
    });
  });

// registry remove-product
registry
  .command("remove-product")
  .description("Remove product from registry")
  .requiredOption("--name <name>", "product name")
  .action((options) => {
    const globalOpts = program.opts();
    require("./commands/manage_registry")("remove-product", {
      name: options.name,
      debug: globalOpts.debug
    });
  });

// registry update-service
registry
  .command("update-service")
  .description("Update service configuration")
  .requiredOption("--name <name>", "service name")
  .option("--repo <url>", "new git repository URL")
  .option("--branch <branch>", "new git branch name")
  .action((options) => {
    const globalOpts = program.opts();
    require("./commands/manage_registry")("update-service", {
      name: options.name,
      repo: options.repo,
      branch: options.branch,
      debug: globalOpts.debug
    });
  });

// registry update-product
registry
  .command("update-product")
  .description("Update product configuration")
  .requiredOption("--name <name>", "product name")
  .option("--server <hostname>", "new server hostname")
  .option("--path <path>", "new deployment path")
  .option("--ssh-key <path>", "new SSH key path")
  .option("--username <user>", "new SSH username")
  .action((options) => {
    const globalOpts = program.opts();
    require("./commands/manage_registry")("update-product", {
      name: options.name,
      server: options.server,
      path: options.path,
      sshKey: options.sshKey,
      username: options.username,
      debug: globalOpts.debug
    });
  });

// registry autoprepare (full name)
registry
  .command("autoprepare")
  .description("Auto-discover services from Atom.Nucleus & PM2")
  .option("--product <name>", "product name to create/update")
  .option("--git-remote <remotes>", "git remote preference (comma-separated, e.g. upstream,origin)")
  .action((options) => {
    const globalOpts = program.opts();
    require("./commands/manage_registry")("autoprepare", {
      product: options.product,
      gitRemote: options.gitRemote,
      debug: globalOpts.debug
    });
  });

// registry ap (short alias)
registry
  .command("ap")
  .description("Auto-discover services (alias for autoprepare)")
  .option("--product <name>", "product name to create/update")
  .option("--git-remote <remotes>", "git remote preference (comma-separated, e.g. upstream,origin)")
  .action((options) => {
    const globalOpts = program.opts();
    require("./commands/manage_registry")("ap", {
      product: options.product,
      gitRemote: options.gitRemote,
      debug: globalOpts.debug
    });
  });

// Process lifecycle hooks
process.on("exit", function () {
  // console.log('process killing');
  // console.log('killing', children.length, 'child processes');
  // children.forEach(function(child) {
  // 	child.kill();
  // });
});

process.on("close", function () {
  // console.log('process closing');
  // children.forEach(function(child) {
  //   child.kill();
  // });
});

// Show help if no arguments
if (process.argv.length <= 2) {
  program.help();
}

// Parse arguments
program.parse(process.argv);
