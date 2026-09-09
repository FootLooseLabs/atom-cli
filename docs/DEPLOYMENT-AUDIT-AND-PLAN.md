# atom deploy — Verified Audit + Hardening Plan (ANCHOR DOC)

**Purpose:** single source of truth for turning `atom deploy` into the production
multi-remote deployer. Everything here is **verified from reality** (git remotes,
package.json, pm2, the registry) — not speculation. Anchor all deployment work on this.

Last verified: 2026-09-09.

---

## Current deployment reality (two models coexist)

1. **Per-project scripts (the working default today):** `npm run deploy-staging` =
   `git push <server-remote> master:staging` with `receive.denyCurrentBranch=updateInstead`
   → pushes the **laptop working tree** to the server. hais-*/comm frontends use
   `npm run deploy` = **rsync of `dist/`**. Config lives in each `package.json`
   `config` (staging_hostname/host_name/hostpath) — one remote per project (3 agents
   have a 2nd `deploy-gcp-staging`).
   **This path must stay untouched — it is the non-regression guarantee.**

2. **`atom deploy` (half-built, in atom-cli):** central `deployment-registry.yaml`
   (services × products × servers); `sshDeployer` SSHes each server and **pulls from
   GitHub origin** (`git fetch && reset --hard origin/<branch>` → `npm install` →
   `pm2 restart`). Commands: `atom deploy <svc> --list|--product|--all|--dry-run|--restart`.
   Identifier = registry key (auto-derived from **pm2 process name**, NOT interface.js
   name; NOT read from package.json directly). No `describe`. No rsync mode.

---

## REGISTRY RESOLUTION (verified 2026-09-09) — corrected
- **Authoritative registry = `/home/ankur/flabs/envs/atom/deployment-registry.yaml`**,
  selected via env `ATOM_REGISTRY_PATH` (see `bin/utils/yamlParser.js`: env var OR
  fallback `bin/config/deployment-registry.yaml`).
- `which atom` is a **symlink to the repo** (`atom-cli/bin/main.js`) — NOT a separate
  install. So there is ONE codebase; the "dual registry" was just: I audited the
  fallback `bin/config` (stale template) while the CLI uses the `envs` file.
- **`bin/config/deployment-registry.yaml` is a STALE template — NOT used at runtime.**
  Action: sync it to the envs file OR mark it clearly non-authoritative (avoid future
  confusion). The envs file is the single source of truth; that part already works.

## VERIFIED DEFECTS in the AUTHORITATIVE (envs) registry — only 2, both need OWNER decision
1. **`rtc-webrequest-handler` repo mismatch.** Registry = `github.com/Vritti-ai/rtc.webrequest-handler`
   (branch rpi); real LOCAL origin = `bitbucket.org/footlooselabs/request_handler` (rpi).
   → Which is canonical/current? (github may be a maintained mirror, or stale.) DO NOT
   auto-"fix" — confirm with owner which repo is authoritative, then align.
2. **`session-manager-agent` target incomplete.** Registry has it only in product `wity`
   (→ vritti-dev-server); real deploy target is **gcp-vritti-dogfooding**. → add to
   `vritti-dogfooding` product (and/or remove from wity if it no longer runs there).

NOTE: earlier-suspected defects were FALSE against the real registry — `common_auth_agent`
(bitbucket ✓), common-auditor-agent, vritti-composer, vritti-ideator, prompt-executor-agent
all MATCH reality. The envs registry is substantially accurate for the 28 agents it covers.

## STRUCTURAL GAPS (stand — independent of the above)
- **git-pull-only + backend-only:** registry covers 28 agents; deploys only by git-pull.
  ALL ~35 frontends (hais-*/comm) deploy by **rsync** and are ABSENT. atom deploy has
  NO rsync mode → cannot deploy frontends today.
- **~9 agents have NO git origin locally** → cannot be git-pulled at all:
  crm:contact-manager, morphogen-manager, utils:oauth-plugins-manager,
  vritti-avatar-manager, vritti-content-registry, vritti:data-aggregator,
  vritti-ideator-cot, vritti-ideator-public, vritti-vectorizer-video.
- **Coverage:** ~15 agents deploy to vritti-dev-server but aren't in the registry
  (auth:license-manager, common_form_manager, entity-assembly/fulfillment, ox-fleet,
  pod-publisher, rtc-feed, etc.). Plus jity-mcp/wity-mcp (gcp) absent.
- **Name drift:** utils:file-manager→file_manager_utils, vritti-organiser→vritti-organizer,
  rtc:sessions-manager→session-manager-agent. Standardize identifier (recommend
  interface.js `InterfaceSpecs.name` for agents).

---

## Deploy targets (verified) — scope
- **AWS vritti-dev-server:** ~37 agents (git-push) + ~5 hais-platforms + ~27 hais-widgets
  + comm (rsync/git-push). [Being mirrored to a GCP prod-mirror separately.]
- **GCP gcp-vritti-dogfooding:** rtc:sessions-manager, jity-mcp, wity-mcp, hais-pkgs docs;
  + 3 dual-target agents (auth:license-manager, common_form_manager, rtc:webrequest-handler).
- **AWS common-dogfooding-server:** ColorForFun only (mirrored to GCP already).
- **Excluded (per owner):** pheriwala (redundant), calibrator (redundant), drona (separate).

(Full per-project origin/branch/target/registry-mismatch table: see chat truth table
dated 2026-09-09, or regenerate — commands in "How to re-verify" below.)

---

## Strategy architecture (implemented P3) — separation of concerns
- **Orchestration** `bin/commands/deploy_service.js` — which services→servers, plan, summary.
- **Strategy dispatch** `bin/strategies/index.js` — groups targets by `type`, runs each strategy, merges results.
- **Strategies** `bin/strategies/*.js` — HOW a target of a given `type` is deployed:
  - `atom-service` (DEFAULT) — git pull + npm + pm2; delegates to unchanged `SSHDeployer.deployMultiple` (zero-regression).
  - `static-rsync` — `rsync -az --delete -e ssh` a locally-built artifact dir → served path; optional `post_deploy` hook.
- **Transport** `bin/utils/sshDeployer.js` — SSH connect/exec.
Registry schema for static: `type: static-rsync`, `source: dist/`, `target_path: …`,
`local_root: …` (optional), `post_deploy: [...]` (optional). Services without `type`
default to `atom-service` → byte-identical old behavior.

## Hardening plan (phased, non-regressive)
- **P0 ✅** read-only audit + this doc.
- **P1 ~** reconcile registry: **Decision 1 DONE** (all github; fixed common_auth_agent
  bitbucket→github). **Decision 2 PENDING**: session-manager-agent target (add gcp product).
  Note: authoritative registry = envs file via ATOM_REGISTRY_PATH; `bin/config` is a stale
  template (sync or mark non-authoritative — still TODO).
- **P2 ✅** additive read-only CLI: `--describe`, `--status` (live SHA/branch/dirty/pm2 per server).
  TODO later: `--from-local`, safer `--dry-run`.
- **P3 ✅** typed strategy pattern + `static-rsync` (frontends). Both strategies verified via dry-run.
- **P4** populate registry to full coverage (add ~15 missing agents, ~35 frontends as static-rsync,
  jity/wity-mcp) + canonical ids; set the 9 missing git origins.
- **P5** health-check gating + rollback (git SHA pin, keep previous) — flag-guarded.
- **P6** MCP wrapper (agent-driven deploy/list/status).

## KNOWN LIMITATION (pre-existing, affects real deploys)
Passphrase-encrypted SSH keys (e.g. gcp box's `id_gcp_vritti_dogfooding`) make
`SSHDeployer`'s inquirer passphrase prompt BLOCK in non-interactive use → any real
`atom deploy`/`--status` to such a server hangs. Workaround: `ssh-add` the key
(ssh-agent) first. Proper fix (later): SSHDeployer should use the agent / non-blocking.

## Non-regression invariants (NEVER violate)
1. Per-project `npm run deploy-staging`/`deploy` scripts remain the working path throughout.
2. Never trust/run a real `atom deploy <svc>` until that entry is `--dry-run`-verified
   against this doc's truth.
3. New behavior only via new commands/flags; existing `atom deploy` default path untouched.
4. Building/auditing never deploys — risk only exists when a real deploy runs.

## How to re-verify (read-only, if context lost)
- Registry: `cd atom-framework/atom-cli && node -e "…yaml.load bin/config/deployment-registry.yaml…"`
- Per-project real origin: `git -C <proj> remote get-url origin`
- Per-project target: package.json `.config.staging_hostname|host_name`
- Installed-vs-repo registry: `atom deploy <svc> --list` vs the yaml.
