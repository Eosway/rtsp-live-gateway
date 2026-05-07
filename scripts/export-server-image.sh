#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"

IMAGE_TAG="${IMAGE_TAG:-${1:-rtsp-live-gateway-server:latest}}"
OUTPUT_PATH="${OUTPUT_PATH:-${2:-${REPO_ROOT}/deploy/image/rtsp-live-gateway-server.tar.gz}}"

if ! docker image inspect "${IMAGE_TAG}" >/dev/null 2>&1; then
  printf 'image not found: %s\n' "${IMAGE_TAG}" >&2
  printf 'build it first with: pnpm run docker:build\n' >&2
  exit 1
fi

mkdir -p "$(dirname "${OUTPUT_PATH}")"
docker save "${IMAGE_TAG}" | gzip > "${OUTPUT_PATH}"

printf 'exported %s to %s\n' "${IMAGE_TAG}" "${OUTPUT_PATH}"
