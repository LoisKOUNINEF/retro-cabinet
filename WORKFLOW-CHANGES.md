# CI/CD workflow update: Node 24 and Ubuntu 24.04

File changed: `.github/workflows/deploy.yml` (the only workflow).

## Why

- GitHub is retiring Node 20 as the runtime for JavaScript actions. The old action versions ran on Node 20 or older.
- The runners were on `ubuntu-latest`, which is about to switch to Ubuntu 26.04. They are now pinned to 24.04.
- The project itself already builds with Node 24 (`node-version: "24"`, `engines: >=24`), so that is unchanged.

## Runners

| Job | Before | After |
|---|---|---|
| `build-and-publish` | `ubuntu-latest` | `ubuntu-24.04` |
| `deploy` | `ubuntu-latest` | `ubuntu-24.04` |
| `delete-old-images` | `ubuntu-latest` | `ubuntu-24.04` |

## Actions

Versions checked against each action's latest release on GitHub (October 2026).

| Action | Before | After | Runs on |
|---|---|---|---|
| `actions/checkout` (×2) | `v4` | `v7` | Node 24 |
| `actions/setup-node` | `v3` | `v7` | Node 24 |
| `docker/setup-buildx-action` | `v3` | `v4` | Node 24 |
| `docker/login-action` | `v3` | `v4` | Node 24 |
| `actions/delete-package-versions` | `v4` | `v5` | Node 20, forced to 24 (see below) |
| `appleboy/scp-action` (×2) | `master` | `v1.0.0` | Composite (no Node) |
| `appleboy/ssh-action` | `master` | `v1.2.5` | Composite (no Node) |

### Notes

- **`setup-node`:** its inputs are unchanged (`node-version: "24"`, `cache: "npm"`). Since v6 it caches only npm automatically, and caching is already set explicitly here.
- **`checkout` v7:** it refuses to check out a fork's pull request on `pull_request_target` and `workflow_run` events. This workflow only runs on `push` to `main`, so that doesn't apply.
- **Docker actions v4:** they need GitHub Actions runner 2.327.1 or newer, which GitHub-hosted runners already have.
- **`delete-package-versions`:** even v5, its latest release, still runs on Node 20. The `delete-old-images` job sets `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true`, GitHub's switch to run such actions on Node 24. Remove it once a Node 24 release ships.
- **`appleboy/*`:** these were on `@master`, so any push to their main branch could change the deploy without notice. They are now pinned to their current releases.

## Not changed

- The Docker build (`tools/docker`) and its Node/Alpine versions.
- The job scripts (`.github/workflows/scripts/`) and the Swarm stack file (`.github/workflows/stacks/stack.yml`).

## Docker and Traefik

These changes cause no conflict with Docker or Traefik:

- **On GitHub's runner,** the workflow only builds and pushes the image.
- **On the server,** it copies files and runs the same `docker stack deploy` scripts as before.
- **Traefik** runs on the server (Swarm provider), outside this repository, and isn't affected.

### Risk to keep in mind on the server

Docker Engine 29 raised its minimum API version to 1.44. Older Traefik versions talk to Docker on API 1.24 and fail with `client version 1.24 is too old`, which stops routing and Let's Encrypt for every service.

- **When it hits:** only if the server's Docker is upgraded to 29 or later while Traefik is older.
- **Check:** run `docker version` on the server, and look at the Traefik image tag.
- **Fix:** upgrade Traefik to 3.6.x or later; confirm the exact version in Traefik's release notes or issue #12253. A stopgap is the Docker daemon setting `DOCKER_MIN_API_VERSION=1.24`.
- **Gap:** `scripts/deployment/healthcheck.sh` only checks Swarm replicas. If Traefik lost track of Docker, the deploy would still report success while the site is unreachable.

## To do

- `.github/` is currently **untracked** in git. Add it, or these changes won't be pushed.
- After the next push to `main`, check the run's warnings for any leftover Node 20 deprecation notice.

## Sources

- [Docker 29 increased minimum API version, breaks Traefik reverse proxy](https://forums.docker.com/t/docker-29-increased-minimum-api-version-breaks-traefik-reverse-proxy/150384) (Docker forums)
- [Traefik stops working, it uses old API version 1.24](https://community.traefik.io/t/traefik-stops-working-it-uses-old-api-version-1-24/29019) (Traefik community)
- [Docker 29 / Traefik compatibility troubleshooting guide](https://community.wappler.io/t/docker-29-traefik-compatibility-troubleshooting-guide/67294)
- [Docker Traefik client version fix](https://puvvadi.net/posts/docker-traefik-client-version-fix/)
