#!/usr/bin/env bash

set -euo pipefail

# 默认从当前目录下的 image 子目录读取 docker save 导出的镜像文件。
# 可通过 IMAGE_ARCHIVE_PATH 环境变量或第一个参数覆盖文件路径。

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_IMAGE_ARCHIVE="${SCRIPT_DIR}/image/rtsp-live-gateway-server.tar.gz"
IMAGE_ARCHIVE_PATH="${IMAGE_ARCHIVE_PATH:-${1:-${DEFAULT_IMAGE_ARCHIVE}}}"

if [[ ! -f "${IMAGE_ARCHIVE_PATH}" ]]; then
  echo "image archive not found: ${IMAGE_ARCHIVE_PATH}" >&2
  exit 1
fi

echo "==> loading image from ${IMAGE_ARCHIVE_PATH}"
gzip -dc "${IMAGE_ARCHIVE_PATH}" | docker load

echo "==> done"
