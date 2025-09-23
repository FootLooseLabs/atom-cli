const generateInterface = (componentSpec) => {
  return `const Atom = require('atom');
const lexicon = require("./lexicon/main");
const eventHandlers = require("./interfaceEvents");

global.component = require('./component/main');

const InterfaceSpecs = {
  name: "${componentSpec.interfaceName}",
  config: {
    port: ${componentSpec.interfacePort},
    lexicon: {},
    connections: {},
    eventHandlers: {}
  }
}

global._interface = new Atom.Interface(InterfaceSpecs); //interface is a reserved word in js

_interface.advertiseAndActivate();`;
};

module.exports = generateInterface;
