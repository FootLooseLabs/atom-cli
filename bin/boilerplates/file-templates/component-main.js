const generateComponentMain = (componentSpec) => {
  return `import "dotenv/config.js";
import { DB } from "@DB";

const dbUrl = process.env.DATABASE_URL;

const Component = {};

Component.initLifecycle = async function () {

};

DB.connect(dbUrl).then(
  (dbcon) => {
    console.debug("DEBUG: ", "initialised............ - ", dbcon.readyState);
  },
  (err) => {
    console.error(err);
    throw err;
  },
);

Component.__start__ = async () => {
  Component.initLifecycle();
};

module.exports = Component;`;
};

module.exports = generateComponentMain;
