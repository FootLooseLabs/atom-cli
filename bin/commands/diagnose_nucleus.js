const chalk = require("chalk");

const AtomNucleus = require("atom").Nucleus;

var diagnoseNucleus = async () => {
  console.log(chalk.blue("=== AtomNucleus Diagnostic Tool ===\n"));

  console.log("1. Checking AtomNucleus readystate...");
  console.log(`   Current state: ${AtomNucleus.readystate}`);
  console.log(`   States: ${JSON.stringify(AtomNucleus.READYSTATES)}`);

  if (AtomNucleus.readystate === AtomNucleus.READYSTATES.READY) {
    console.log(chalk.green("   ✓ AtomNucleus is READY"));
  } else {
    console.log(
      chalk.yellow(`   ⚠ AtomNucleus is in state: ${AtomNucleus.readystate}`),
    );
  }

  console.log("\n2. Checking Redis connection...");
  try {
    if (AtomNucleus.redisClient) {
      console.log(`   Redis client exists: ${!!AtomNucleus.redisClient}`);
      console.log(`   Redis connected: ${AtomNucleus.redisClient.connected}`);

      if (AtomNucleus.redisClient.connected) {
        console.log(chalk.green("   ✓ Redis connection active"));
      } else {
        console.log(chalk.red("   ✗ Redis not connected"));
        console.log(
          chalk.yellow("   SOLUTION: Start Redis or check connection"),
        );
      }
    } else {
      console.log(chalk.red("   ✗ Redis client not initialized"));
    }
  } catch (error) {
    console.log(chalk.red("   ✗ Error checking Redis:"), error.message);
  }

  console.log("\n3. Testing interface discovery...");
  try {
    const interfaces = await AtomNucleus.getAllAdvertisedInterfaces();
    console.log(`   Found ${interfaces.length} advertised interfaces:`);

    if (interfaces.length === 0) {
      console.log(chalk.yellow("   ⚠ No interfaces found"));
      console.log(
        chalk.blue("   INFO: Start some atom components to see interfaces"),
      );
    } else {
      interfaces.forEach((iface, idx) => {
        console.log(`   ${idx + 1}. ${iface}`);
      });
      console.log(chalk.green("   ✓ Interface discovery working"));
    }
  } catch (error) {
    console.log(chalk.red("   ✗ Error discovering interfaces:"), error.message);
  }

  console.log("\n4. Testing interface activity...");
  try {
    const activity = await AtomNucleus.getAllInterfaceActivity();
    console.log(`   Found ${activity.length} active interfaces:`);

    if (activity.length === 0) {
      console.log(chalk.yellow("   ⚠ No active interfaces"));
      console.log(chalk.blue("   INFO: This is why atom -ss shows empty list"));
    } else {
      activity.forEach((agent, idx) => {
        const status = agent.running
          ? chalk.green("RUNNING")
          : chalk.red("STOPPED");
        console.log(`   ${idx + 1}. ${agent.name} - ${status}`);
      });
      console.log(chalk.green("   ✓ Interface activity working"));
    }
  } catch (error) {
    console.log(
      chalk.red("   ✗ Error getting interface activity:"),
      error.message,
    );
  }

  console.log("\n5. Event system test...");
  let readyEventFired = false;
  let errorEventFired = false;

  const readyHandler = () => {
    readyEventFired = true;
    console.log(chalk.green("   ✓ Ready event fired"));
  };

  const errorHandler = (err) => {
    errorEventFired = true;
    console.log(chalk.red("   ✗ Error event fired:"), err.message);
  };

  AtomNucleus.on("ready", readyHandler);
  AtomNucleus.on("error", errorHandler);

  setTimeout(() => {
    if (!readyEventFired && !errorEventFired) {
      console.log(chalk.yellow("   ⚠ No events fired within 2 seconds"));
    }

    console.log("\n=== Diagnosis Summary ===");

    if (
      AtomNucleus.readystate === AtomNucleus.READYSTATES.READY &&
      AtomNucleus.redisClient &&
      AtomNucleus.redisClient.connected
    ) {
      console.log(chalk.green("✓ AtomNucleus is healthy"));
      console.log(
        chalk.blue(
          "INFO: If atom -ss still shows empty, no interfaces are currently running",
        ),
      );
      console.log(
        chalk.blue(
          "INFO: Start an atom environment with: atom -senv <config-file>",
        ),
      );
    } else if (AtomNucleus.readystate === AtomNucleus.READYSTATES.ERRORED) {
      console.log(chalk.red("✗ AtomNucleus is in error state"));
      console.log(
        chalk.yellow(
          "SOLUTION: Check Redis connection and restart nucleus with: atom -s",
        ),
      );
    } else {
      console.log(chalk.yellow("⚠ AtomNucleus is not fully ready"));
      console.log(
        chalk.yellow("SOLUTION: Start atom nucleus daemon with: atom -s"),
      );
    }

    process.exit(0);
  }, 2000);
};

module.exports = diagnoseNucleus;
