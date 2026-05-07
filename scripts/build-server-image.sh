#!/usr/bin/env bash

set -euo pipefail

IMAGE_TAG="${IMAGE_TAG:-${1:-rtsp-live-gateway-server:latest}}"

docker build -f apps/server/Dockerfile -t "${IMAGE_TAG}" .

printf 'built %s\n' "${IMAGE_TAG}"
