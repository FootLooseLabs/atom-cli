const generateLexiconMain = (componentSpec) => {
  return `const AtomLexeme = require("atom").Lexeme;

const LEXICON = {};

LEXICON.BaseMsg = class extends AtomLexeme {
    static schema = {
        uid: null,
        message: "",
        subject: null,
        object: {},
        action: null,
        params: {},
        vector: {
            uid: null,
            vectorSpaceUid: null
        },
        sender: null,
        sessionInfo: {},
        ts: null,
    };
}

module.exports = LEXICON;`;
};

module.exports = generateLexiconMain;
