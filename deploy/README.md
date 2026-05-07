# 部署文档

部署模板目录，默认按 `latest` 使用。

## 目录说明

`image/` 目录用于存放 `docker save` 导出的镜像文件。

## 常见命令

所有命令基于当前目录

- 导入镜像

  ```bash
  bash load-server-image.sh
  ```

- 启动服务

  ```bash
  docker compose up -d
  ```

- 停止服务

  ```bash
  docker compose down
  ```

## GPU 支持

如需让容器调用 NVIDIA 显卡，先执行：

```bash
bash install-nvidia-container-toolkit.sh
```

安装完成后再使用 `docker compose up -d` 启动服务。

## 补充说明

CI Release 会基于本目录生成版本固化后的部署包，发布包根目录形如 `rtsp-live-gateway-server-<version>/`。
