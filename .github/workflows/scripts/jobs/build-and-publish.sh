#!/bin/bash
set -e

# tools/docker/Dockerfile and nginx.conf are generated from their templates (gitignored)
node tools/docker/scripts/validate-docker.js

docker build --platform linux/amd64 -t ghcr.io/${REPO_LOWER}:${GITHUB_SHA} -f ./tools/docker/Dockerfile .
docker push ghcr.io/${REPO_LOWER}:${GITHUB_SHA}
