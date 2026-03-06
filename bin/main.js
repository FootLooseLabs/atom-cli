#!/usr/bin/env node
const { spawnSync, execSync } = require("child_process");

const { program } = require("commander");

// var commands = require('require-all')({
//   dirname     :  __dirname + '/commands',
//   excludeDirs :  /^\.(git|svn)$/,
//   recursive   : true
// });

program
  .option("-d, --debug", "output extra debugging")
  .option("-i, --init", "init atom component")
  .option("-s, --start", "start atom nucleus daemon")
  .option("-ss, --signal", "send signal")
  .option(
    "-sii, --startintrospectiveinterface",
    "start introspective interface",
  )
  .option("-senv, --startenv <config-path>", "start atom environment")
  .option("-diag, --diagnose", "diagnose atom nucleus connection and state")
  .option(
    "-b, --broadcast <interface-payload>",
    "broadcast <interface>:::<payload> ( Eg format - `atom -b @flpl/devops:::GetIntro:::{}` )",
  )
  .option("-deploy [service]", "deploy service(s) to product(s)")
  .option("--product <product>", "target product for deployment")
  .option("--all", "deploy to all products")
  .option("--all-services", "deploy all services for a product")
  .option("--list", "list deployment information")
  .option("--restart", "restart service after deployment using PM2")
  .option("--dry-run", "show what would be deployed without executing")
  .option("--parallel", "deploy to multiple servers in parallel")
  .option("-registry <operation>", "manage deployment registry")
  .option("--name <name>", "name of service or product")
  .option("--repo <url>", "git repository URL")
  .option("--branch <branch>", "git branch name")
  .option("--server <hostname>", "server hostname")
  .option("--path <path>", "deployment path on server")
  .option("--ssh-key <path>", "SSH key path")
  .option("--username <user>", "SSH username")
  .option("--service <service>", "service name for link/unlink")
  .option("--services", "show only services")
  .option("--products", "show only products")
  .option("--keyword <keyword>", "search keyword")
  .option("--git-remote <remotes>", "git remote preference (comma-separated, e.g. upstream,origin)");

if (process.argv.length <= 2) {
  program.help();
}

program.parse(process.argv);

// console.log("program = ", program);

// if (program.args.length === 0) {
//   program.help();
// }

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

if (program.debug) console.log(program.opts());
if (program.init) {
  console.log("init atom component");
  // console.log("commands = ", commands);
  require("./commands/init_atom_component")();
}
if (program.start) {
  console.log("start/run atom.nucleus daemon");
  // console.log("commands = ", commands);
  require("./commands/start_nucleus_daemon")();
}
if (program.signal) {
  console.log("cli to send atom signals");
  // console.log("commands = ", commands);
  require("./commands/send_signal")();
}
if (program.diagnose) {
  console.log("diagnosing atom nucleus");
  require("./commands/diagnose_nucleus")();
}

if (program.startintrospectiveinterface) {
  console.log("\n launching introspective interface \n");
  console.log(
    "\t - discover & interact with interfaces available in the env \n",
  );
  console.log("\t - send atom signals \n");
  // console.log("commands = ", commands);
  require("./commands/start_introspective_interface")();
}

if (program.startenv) {
  console.log(
    "starting atom env - defined in config file = ",
    program.opts().startenv.toString(),
  );
  // console.log("commands = ", commands);
  require("./commands/start_env")(program.opts().startenv.toString());
}

if (program.broadcast) {
  console.log(
    "ATOM: preparing broadcast -",
    program.opts().broadcast.toString(),
  );
  require("./commands/broadcast")(program.opts().broadcast.toString());
}

if (program.Deploy !== undefined) {
  const opts = program.opts();

  // Check if this is a list operation
  if (opts.list) {
    require("./commands/list_deployments")(program.Deploy, opts);
  } else {
    // This is a deployment operation
    require("./commands/deploy_service")(program.Deploy, opts);
  }
}

if (program.Registry !== undefined) {
  const opts = program.opts();
  const operation = program.Registry;

  // Pass operation and options to registry manager
  require("./commands/manage_registry")(operation, {
    name: opts.name,
    repo: opts.repo,
    branch: opts.branch,
    server: opts.server,
    path: opts.path,
    sshKey: opts.sshKey,
    username: opts.username,
    service: opts.service,
    product: opts.product,
    services: opts.services,
    products: opts.products,
    keyword: opts.keyword,
    gitRemote: opts.gitRemote,
    debug: opts.debug
  });
}
