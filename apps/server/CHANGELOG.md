# Changelog

## [1.1.0](https://github.com/Eosway/rtsp-live-gateway/compare/server@1.0.0...server@1.1.0) (2026-05-06)

### Features

- add video mode auto or transcode ([a5634d8](https://github.com/Eosway/rtsp-live-gateway/commit/a5634d8ba22e702d5a7ef0bc85de262b9d649772))
- add gop cache for late viewer playback ([8962d3c](https://github.com/Eosway/rtsp-live-gateway/commit/8962d3c67e78c1ddcbd74f40b0b8b0335888e769))
- auto select copy or transcode by input codec ([dc10275](https://github.com/Eosway/rtsp-live-gateway/commit/dc10275984633762396de391eebd17c863e0c373))
- bootstrap late viewers at flv tag boundary ([1714da9](https://github.com/Eosway/rtsp-live-gateway/commit/1714da9488be54bf5194b5630fc9ef9f562107c5))
- improve ffmpeg error readability and structure ([d3f5810](https://github.com/Eosway/rtsp-live-gateway/commit/d3f581004ba5038e826fd23e86ad4a0d332834f8))

### Bug Fixes

- docker build issue cause by mpegts.js patches ([32f8c22](https://github.com/Eosway/rtsp-live-gateway/commit/32f8c22a9dca584f79e1a3fd430eb4e31299a255))

### Code Refactoring

- remove video mode and restrict audio mode ([7aa17c7](https://github.com/Eosway/rtsp-live-gateway/commit/7aa17c772123694a43d95c4dbc3b27732d6d44be))
- rename video codec values to h264 h265 ([13f5b38](https://github.com/Eosway/rtsp-live-gateway/commit/13f5b38bc6e4e50ad0d0cd3a8f8032d8afbeaf5a))
- reorganize ffmpeg codec templates ([8516983](https://github.com/Eosway/rtsp-live-gateway/commit/8516983ef9b560ba5dd3567b298172df3e760e7d))

## 1.0.0 (2026-05-04)

### Features

- improve client and server contract handling ([4046392](https://github.com/Eosway/rtsp-live-gateway/commit/4046392bf99a303254d2ef0f756bd54516d597ee))
- add configurable video codec fallback ([ef71abd](https://github.com/Eosway/rtsp-live-gateway/commit/ef71abdcceef94db3d897229b93e8cc52cb73440))
- implement hono rtsp-to-httpflv gateway core ([3986ee9](https://github.com/Eosway/rtsp-live-gateway/commit/3986ee9879ca2071cd88d97a6e09bb5fda6a32a1))
- surface ffmpeg startup diagnostics ([30c2a81](https://github.com/Eosway/rtsp-live-gateway/commit/30c2a812a9ee670dd2354475b9db6eb7f43eced1))
- add sdk, vue player package and playground app with pnpm ([719b736](https://github.com/Eosway/rtsp-live-gateway/commit/719b73649a6fc8a33808414796e83e2416c70f6f))

### Bug Fixes

- align blueprint gaps and upgrade runtime to node24/debian13 ([8b08563](https://github.com/Eosway/rtsp-live-gateway/commit/8b08563f52df664e22fd0423efa87da3812e4131))

### Documentation

- add readmes for all workspace packages ([c6a132a](https://github.com/Eosway/rtsp-live-gateway/commit/c6a132a2cfeba3cfd87f25548306401dba7e26b7))

### Miscellaneous Chores

- align docs and ci scripts ([5c65b75](https://github.com/Eosway/rtsp-live-gateway/commit/5c65b75330338d48157ccebab04da7569cabdc3d))
- align tsconfig inheritance layout ([d52fd31](https://github.com/Eosway/rtsp-live-gateway/commit/d52fd31db41ef419f89efd5a4890d19b8473feee))
- initialize monorepo scaffold and shared protocol contracts ([04b049c](https://github.com/Eosway/rtsp-live-gateway/commit/04b049c081a84ae74672aa7383adf9393e09d462))
- rename workspace packages to eosway scope ([28627bc](https://github.com/Eosway/rtsp-live-gateway/commit/28627bc944b2007f781e74640425a96528451bde))
- reorganize monorepo structure ([e2ed569](https://github.com/Eosway/rtsp-live-gateway/commit/e2ed5694067c8fdfa478961a451c99f94eb4c0b1))
- simplify docker workflow ([82478f0](https://github.com/Eosway/rtsp-live-gateway/commit/82478f05bc1d98e24d5337315308b60c43ca3174))
- simplify ts config and workspace wiring ([f3f6ff9](https://github.com/Eosway/rtsp-live-gateway/commit/f3f6ff921f51d8ae12c41271cbd2e4fd017274e2))
- unify clean and tsc scripts ([504b097](https://github.com/Eosway/rtsp-live-gateway/commit/504b0970d723b4106f7bea9909ae7ae585e7c90c))
- update dependencies ([926e56a](https://github.com/Eosway/rtsp-live-gateway/commit/926e56a8a3fe10b07917df47242e36cae3ebb93d))
- update server defaults and production compose ([1985f54](https://github.com/Eosway/rtsp-live-gateway/commit/1985f54189d2c9b718bc8b757f0d1fa1144ce93a))

### Code Refactoring

- remove ffmpeg tuning parameters ([357ddad](https://github.com/Eosway/rtsp-live-gateway/commit/357ddad549b4bb5c88adccd8023e06d35dd35aa3))
- tighten protocol contracts ([ade6d50](https://github.com/Eosway/rtsp-live-gateway/commit/ade6d50456e6e00363d572bae7a2fbdf01532d52))
