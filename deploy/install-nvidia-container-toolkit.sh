#!/usr/bin/env bash

set -euo pipefail

# 本脚本要求与 nvidia-container-toolkit 目录放在同级，并从当前目录执行。
# 目录结构应为：
#   .
#   ├── install-nvidia-container-toolkit.sh
#   └── nvidia-container-toolkit
#       ├── gpgkey
#       └── nvidia-container-toolkit.list

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ASSET_DIR="${SCRIPT_DIR}/nvidia-container-toolkit"
GPG_KEY_PATH="${ASSET_DIR}/gpgkey"
SOURCE_LIST_PATH="${ASSET_DIR}/nvidia-container-toolkit.list"

KEYRING_PATH="/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg"
LIST_PATH="/etc/apt/sources.list.d/nvidia-container-toolkit.list"

if [[ ! -f "${GPG_KEY_PATH}" ]]; then
  echo "missing file: ${GPG_KEY_PATH}" >&2
  exit 1
fi

if [[ ! -f "${SOURCE_LIST_PATH}" ]]; then
  echo "missing file: ${SOURCE_LIST_PATH}" >&2
  exit 1
fi

if ! command -v apt-get >/dev/null 2>&1; then
  echo "apt-get not found, this script currently supports Debian/Ubuntu only" >&2
  exit 1
fi

echo "本脚本将安装 NVIDIA Container Toolkit，并配置 Docker 运行时以支持容器调用 NVIDIA 显卡。"
read -r -p "是否继续执行？[y/N] " CONFIRM
if [[ "${CONFIRM}" != "y" && "${CONFIRM}" != "Y" ]]; then
  echo "已取消。"
  exit 0
fi

echo "==> [1/7] 安装基础工具"
sudo apt-get update
sudo apt-get install -y --no-install-recommends \
  ca-certificates \
  gnupg2

echo "==> [2/7] 写入 NVIDIA Container Toolkit keyring"
sudo mkdir -p /usr/share/keyrings
sudo gpg --dearmor -o "${KEYRING_PATH}" "${GPG_KEY_PATH}"

echo "==> [3/7] 写入 APT 源列表"
sudo cp "${SOURCE_LIST_PATH}" "${LIST_PATH}"

echo "==> [4/7] 安装 nvidia-container-toolkit"
sudo apt-get update
sudo apt-get install -y nvidia-container-toolkit

echo "==> [5/7] 配置 Docker runtime"
sudo nvidia-ctk runtime configure --runtime=docker

echo "==> [6/7] 重启 Docker"
sudo systemctl restart docker

echo "==> [7/7] 验证运行时"
docker info --format '{{json .Runtimes}}'

echo
echo "安装完成。建议继续验证："
echo "  docker run --rm --gpus all nvidia/cuda:12.9.0-base-ubuntu22.04 nvidia-smi"
