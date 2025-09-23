const generateGitignore = (componentSpec) => {
  return `venv
node_modules
.DS_Store
*.min.js
dist
.env`;
};

module.exports = generateGitignore;
