#!/usr/bin/env bash

set -euo pipefail

IMAGE_TAG="${1:-rtsp-live-gateway:latest}"
OUTPUT_PATH="${2:-rtsp-live-gateway.tar.gz}"

if ! docker image inspect "${IMAGE_TAG}" >/dev/null 2>&1; then
  printf 'image not found: %s\n' "${IMAGE_TAG}" >&2
  printf 'build it first with: pnpm run docker:build\n' >&2
  exit 1
fi

docker save "${IMAGE_TAG}" | gzip > "${OUTPUT_PATH}"

printf 'exported %s to %s\n' "${IMAGE_TAG}" "${OUTPUT_PATH}"
