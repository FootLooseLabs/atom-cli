const readline = require("readline");
const rl = readline
  .createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  })
  .on("SIGINT", () => process.emit("SIGINT"))
  .on("SIGTERM", () => process.emit("SIGTERM"));

const chalk = require("chalk");

const fdTracker = require("../lib/track-fds");

const AtomNucleus = require("atom").Nucleus;
const AtomSignal = require("atom").Signal; //assumes (as requires) that atom js-sdk is globally installed on the system this is being run

// Initialize process.nucleus for bin commands
process.nucleus = AtomNucleus;

var SignalSpec = {
  host: "127.0.0.1",
  port: null,
};

var MessageSpec = {
  topic: null,
  payload: null,
};

var AvailableAgents = [];

var SelectedAgent = null;

var listAvailableAgents = async () => {
  try {
    console.log("DEBUG: Calling AtomNucleus.getAllInterfaceActivity()...");
    AvailableAgents = await AtomNucleus.getAllInterfaceActivity();
    console.log("DEBUG: Raw interface activity result:", AvailableAgents);

    console.log("Available Agent-Interfaces: ");
    if (AvailableAgents.length === 0) {
      console.log(chalk.yellow("  (No interfaces currently available)"));
      console.log(
        chalk.blue(
          "INFO: Start an atom environment with: atom -senv <config-file>",
        ),
      );
    } else {
      AvailableAgents.forEach((_agent, idx) => {
        console.log(`${idx + 1}.)`, _agent);
      });
    }
  } catch (error) {
    console.error("DEBUG: Error in listAvailableAgents:", error);
    throw error;
  }
};

var sendWaveletCLI = () => {
  console.log("\n");
  rl.question("topic (lexeme)? ", (topic) => {
    MessageSpec.topic = topic;
    rl.question("message? ", async (message) => {
      MessageSpec.message = message;

      try {
        var signalStatus = await AtomSignal.publishToInterface(
          `${SelectedAgent.name}:::${MessageSpec.topic}`,
          MessageSpec.message,
        );
        if (!signalStatus.error) {
          console.log("operation initiated");
        } else {
          console.error("operation failed");
        }
      } catch (e) {
        console.error("Error: ", e);
      }
      // _signal.sendWavelet(MessageSpec.topic, MessageSpec.message);
      sendWaveletCLI();
    });
  });
};

var sendAtomSignalCLI = () => {
  console.log("DEBUG: Starting AtomSignal CLI...");
  console.log("DEBUG: Current nucleus readystate:", process.nucleus.readystate);
  console.log(
    "DEBUG: Expected READY state:",
    process.nucleus.READYSTATES.READY,
  );

  // Handle error state
  process.nucleus.on("error", (err) => {
    console.error(chalk.red("ERROR: AtomNucleus failed to connect:"), err);
    console.error(
      chalk.yellow(
        "SOLUTION: Please ensure Redis is running and start atom nucleus with: atom -s",
      ),
    );
    process.exit(1);
  });

  // If already ready, proceed immediately
  if (process.nucleus.readystate === process.nucleus.READYSTATES.READY) {
    console.log("DEBUG: Nucleus already ready, proceeding...");
    proceedWithSignaling();
  } else {
    console.log("DEBUG: Waiting for nucleus to be ready...");
    // Set a timeout in case ready event never fires
    const timeout = setTimeout(() => {
      console.error(
        chalk.red(
          "TIMEOUT: AtomNucleus did not become ready within 10 seconds",
        ),
      );
      console.error(
        chalk.yellow(
          "SOLUTION: Please check if Redis is running and restart atom nucleus with: atom -s",
        ),
      );
      process.exit(1);
    }, 10000);

    process.nucleus.on("ready", async () => {
      clearTimeout(timeout);
      console.log("DEBUG: Nucleus ready event received");
      proceedWithSignaling();
    });
  }

  async function proceedWithSignaling() {
    try {
      console.log("DEBUG: Fetching available agents...");
      await listAvailableAgents();

      if (AvailableAgents.length === 0) {
        console.log(
          chalk.yellow("WARNING: No interfaces found in the environment"),
        );
        console.log(
          chalk.blue(
            "INFO: To see available interfaces, ensure some atom components are running",
          ),
        );
        console.log(
          chalk.blue(
            "INFO: You can start an environment with: atom -senv <config-file>",
          ),
        );
        process.exit(0);
      }

      rl.question(
        `interface ( 1 -to- ${AvailableAgents.length} ) ?`,
        (selectedIdx) => {
          SelectedAgent = AvailableAgents[selectedIdx - 1];
          if (!SelectedAgent) {
            console.error("ERROR: Invalid selection");
            process.exit(1);
          }
          sendWaveletCLI();
        },
      );

      rl.on("close", function () {
        process.exit(0);
      });
    } catch (error) {
      console.error(
        chalk.red("ERROR: Failed to list available agents:"),
        error,
      );
      process.exit(1);
    }
  }
};

module.exports = sendAtomSignalCLI;
