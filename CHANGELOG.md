# Changelog — atom-cli

## v0.4.0
Registry management and deployment tooling added — `atom registry` subcommands for managing service registry, `atom deploy` with SSH-based deployer for pushing agent updates to remote servers.

## v0.3.0
CLI restructured from options (`atom -s`, `atom -ss`) to named subcommands (`atom start`, `atom signal`) for clearer help output and better extensibility. Breaking change in CLI interface — scripts using the old flags need updating.

## v0.2.0
Nucleus daemon improvements. `isRedisRunning` check before spawning embedded Redis — prevents double-spawn when a system Redis is already running. Fixed daemon reference order. Install script updated to run both local `npm i` and global install.

## v0.1.0
Initial release as a standalone repo (separated from atom.js). Nucleus daemon managing Redis + Diont, `atom start` to launch daemon via pm2, `atom signal` CLI for sending signals to running interfaces, `atom -senv` for starting environments from config.
