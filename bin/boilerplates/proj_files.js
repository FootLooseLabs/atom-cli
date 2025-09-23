const generatePackageJson = require("./file-templates/package.json.js");
const generateInterface = require("./file-templates/interface.js");
const generateComponentMain = require("./file-templates/component-main.js");
const generateLexiconMain = require("./file-templates/lexicon-main.js");
const generateDb = require("./file-templates/db.js");
const generateGitignore = require("./file-templates/gitignore.js");
const generateEnv = require("./file-templates/env.js");
const generateEnvSample = require("./file-templates/env-sample.js");

const fileBoilerplates = {
  "package.json": {
    path: "package.json",
    generate: generatePackageJson,
  },
  "interface.js": {
    path: "src/interface.js",
    generate: generateInterface,
  },
  "lexicon-main.js": {
    path: "src/lexicon/main.js",
    generate: generateLexiconMain,
  },
  "component-main.js": {
    path: "src/component/main.js",
    generate: generateComponentMain,
  },
  "db.js": {
    path: "src/component/db.js",
    generate: generateDb,
  },
  "gitignore": {
    path: ".gitignore",
    generate: generateGitignore,
  },
  "env": {
    path: ".env",
    generate: generateEnv,
  },
  "env-sample": {
    path: ".env-sample",
    generate: generateEnvSample,
  },
};

// Generate all boilerplate files for a component
const generateAllFiles = (componentSpec) => {
  const results = {};

  Object.keys(fileBoilerplates).forEach((fileName) => {
    const boilerplate = fileBoilerplates[fileName];
    results[fileName] = {
      path: boilerplate.path,
      content: boilerplate.generate(componentSpec),
    };
  });

  return results;
};

module.exports = {
  generateAllFiles,
};
