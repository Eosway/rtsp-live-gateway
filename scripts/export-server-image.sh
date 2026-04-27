#!/usr/bin/env bash

set -euo pipefail

IMAGE_TAG="${1:-rtsp-gateway-server:local}"
OUTPUT_PATH="${2:-rtsp-gateway-server.tar.gz}"

docker build -f apps/server/Dockerfile -t "${IMAGE_TAG}" .
docker save "${IMAGE_TAG}" | gzip > "${OUTPUT_PATH}"

printf 'exported %s to %s\n' "${IMAGE_TAG}" "${OUTPUT_PATH}"
