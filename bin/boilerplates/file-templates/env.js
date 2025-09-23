const generateEnv = (componentSpec) => {
  return `DATABASE_URL=mongodb://127.0.0.1:27017/${componentSpec.name}-db`;
};

module.exports = generateEnv;
