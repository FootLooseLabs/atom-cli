const fs = require("fs");
const path = require("path");

const { execSync } = require("child_process");

var structureGenerator = require("folder-structure-generator");
var jsonStructure = require("../boilerplates/proj_structure.json");
var { generateAllFiles } = require("../boilerplates/proj_files.js");
var { getSuggestedPort } = require("../utils/portFinder.js");

const readline = require("readline");
const rl = readline
  .createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  })
  .on("SIGINT", () => process.emit("SIGINT"))
  .on("SIGTERM", () => process.emit("SIGTERM"));

var ComponentSpec = {
  name: "",
  description: "",
  config: {
    port: null,
    apis: [],
  },
};

var switchToProjectDir = (projectDir) => {
  if (!fs.existsSync(projectDir)) {
    fs.mkdirSync(projectDir);
  } else {
    console.log("dir already exists...exiting.");
    process.exit();
  }
  process.chdir(projectDir);
};

var initAtomComponentCLI = async () => {
  console.log("initialising Atom Component...\n");
  rl.question("component name? ", (name) => {
    ComponentSpec.name = name;
    rl.question("component description? ", (description) => {
      ComponentSpec.description = description;
      switchToProjectDir(ComponentSpec.name);

      // Get suggested port
      getSuggestedPort()
        .then(({ port: suggestedPort, message }) => {
          console.log(message);
          const portPrompt = suggestedPort
            ? `allocate primary port? (default: ${suggestedPort}) `
            : "allocate primary port? (Eg- 8888) ";

          rl.question(portPrompt, (port) => {
            // Use suggested port if no input provided
            ComponentSpec.config.port = port.trim() || suggestedPort || 8888;
            structureGenerator(jsonStructure);

            // Generate and write all boilerplate files after folder structure is created
            setTimeout(() => {
              const generatedFiles = generateAllFiles(ComponentSpec);

              Object.values(generatedFiles).forEach((file) => {
                fs.writeFileSync(file.path, file.content);
                console.log(`Generated: ${file.path}`);
              });

              console.log(`\nDONE - cd into ./${ComponentSpec.name}`);
              process.exit();
            }, 500);
          });
        })
        .catch((error) => {
          console.log(
            "Could not determine suggested port, using manual input.",
          );
          rl.question("allocate primary port? (Eg- 8888) ", (port) => {
            ComponentSpec.config.port = port || 8888;
            structureGenerator(jsonStructure);

            // Generate and write all boilerplate files after folder structure is created
            setTimeout(() => {
              const generatedFiles = generateAllFiles(ComponentSpec);

              Object.values(generatedFiles).forEach((file) => {
                fs.writeFileSync(file.path, file.content);
                console.log(`Generated: ${file.path}`);
              });

              console.log(`\nDONE - cd into ./${ComponentSpec.name}`);
              process.exit();
            }, 500);
          });
        });
    });
  });
};

module.exports = initAtomComponentCLI;
