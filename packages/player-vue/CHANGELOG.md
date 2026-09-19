# Changelog

## [1.3.0](https://github.com/Eosway/rtsp-live-gateway/compare/player-vue@1.2.0...player-vue@1.3.0) (2026-09-19)

### Miscellaneous Chores

- update rivmux ([989ab87](https://github.com/Eosway/rtsp-live-gateway/commit/989ab87b7e188b33b4656876a60161b32e183f9b))

### Code Refactoring

- align rivmux lifecycle API ([d9233fa](https://github.com/Eosway/rtsp-live-gateway/commit/d9233fab7e49f3ceff2583b439ac51d1731a0d38))
- expose stream state type ([318b945](https://github.com/Eosway/rtsp-live-gateway/commit/318b945a84c7180f239c58cdf639ee8fada60c2d))

## [1.2.0](https://github.com/Eosway/rtsp-live-gateway/compare/player-vue@1.1.1...player-vue@1.2.0) (2026-09-18)

### Features

- replace mpegts.js with rivmux ([8b5354c](https://github.com/Eosway/rtsp-live-gateway/commit/8b5354cdc68fa7d722ea53786dcc03910c4ec759))

### Code Refactoring

- rename base URL prop ([7f816aa](https://github.com/Eosway/rtsp-live-gateway/commit/7f816aa54e18593039139e86013cfef3413e6b9e))

## [1.1.1](https://github.com/Eosway/rtsp-live-gateway/compare/player-vue@1.1.0...player-vue@1.1.1) (2026-09-17)

### Bug Fixes

- warning about vite and dts ([6fab4d9](https://github.com/Eosway/rtsp-live-gateway/commit/6fab4d90aa9e94b8dbcb5684025bd4aea5a3bdd3))

### Miscellaneous Chores

- migrate to pnpm v12 ([9da160e](https://github.com/Eosway/rtsp-live-gateway/commit/9da160e950a5f6ce8c50ae15044e30e65cd28bb2))
- update and re-patch mpegts.js ([f9fc061](https://github.com/Eosway/rtsp-live-gateway/commit/f9fc061e8e0e44b1ec25509091e6a47518e6a257))
- update non-major dependencies ([abfaeb0](https://github.com/Eosway/rtsp-live-gateway/commit/abfaeb0a70c383ed8f47c89775032e71df006d7f))

## [1.1.0](https://github.com/Eosway/rtsp-live-gateway/compare/player-vue@1.0.2...player-vue@1.1.0) (2026-06-02)

### Features

- add startup ready contract ([a9edd24](https://github.com/Eosway/rtsp-live-gateway/commit/a9edd24e544895c8eb593a75f2723ee2a46c8530))

## [1.0.2](https://github.com/Eosway/rtsp-live-gateway/compare/player-vue@1.0.1...player-vue@1.0.2) (2026-06-01)

### Bug Fixes

- align audio and player status ([2be59cb](https://github.com/Eosway/rtsp-live-gateway/commit/2be59cbfdb1a5003724ebadf2add33725b9d57a9))

### Miscellaneous Chores

- add LICENSE and complete package.json ([1c1005d](https://github.com/Eosway/rtsp-live-gateway/commit/1c1005d8088596ac74bc9104d43379cf5c32bed4))

### Tests

- migrate suites to vitest ([2e68daa](https://github.com/Eosway/rtsp-live-gateway/commit/2e68daa904ce7b761d21172a5234bd0e8498e1cb))

## [1.0.1](https://github.com/Eosway/rtsp-live-gateway/compare/player-vue@1.0.0...player-vue@1.0.1) (2026-05-06)

### Bug Fixes

- skip enhanced hevc metadata packets([44df32e](https://github.com/Eosway/rtsp-live-gateway/commit/44df32ec9d14c106af8ae98fb1cd3dba6f8e6687))

## 1.0.0 (2026-05-04)

### Features

- surface ffmpeg startup diagnostics ([30c2a81](https://github.com/Eosway/rtsp-live-gateway/commit/30c2a812a9ee670dd2354475b9db6eb7f43eced1))

### Bug Fixes

- bundle-in dependencies to enable install directly ([cde950d](https://github.com/Eosway/rtsp-live-gateway/commit/cde950d1b990d208fe3dc550dbd4905427b0ce95))cd

### Miscellaneous Chores

- align tsconfig inheritance layout ([d52fd31](https://github.com/Eosway/rtsp-live-gateway/commit/d52fd31db41ef419f89efd5a4890d19b8473feee))
- rename workspace packages to eosway scope ([28627bc](https://github.com/Eosway/rtsp-live-gateway/commit/28627bc944b2007f781e74640425a96528451bde))
- reorganize monorepo structure ([e2ed569](https://github.com/Eosway/rtsp-live-gateway/commit/e2ed5694067c8fdfa478961a451c99f94eb4c0b1))
- simplify ts config and workspace wiring ([f3f6ff9](https://github.com/Eosway/rtsp-live-gateway/commit/f3f6ff921f51d8ae12c41271cbd2e4fd017274e2))
- unify clean and tsc scripts ([504b097](https://github.com/Eosway/rtsp-live-gateway/commit/504b0970d723b4106f7bea9909ae7ae585e7c90c))
- update dependencies ([926e56a](https://github.com/Eosway/rtsp-live-gateway/commit/926e56a8a3fe10b07917df47242e36cae3ebb93d))

### Code Refactoring

- align media player options and video attrs ([b11c137](https://github.com/Eosway/rtsp-live-gateway/commit/b11c137f0e592cf2117b395bd5a46fb43dc49c45))
- introduce MediaPlayer adapter and normalize player events ([f3a0315](https://github.com/Eosway/rtsp-live-gateway/commit/f3a0315fc2652da410af1d2c334d6dab1c4dc90f))
- prefer event-driven public api ([290c29b](https://github.com/Eosway/rtsp-live-gateway/commit/290c29b2104f31baa7b93bdbf3dc42b9996121ff))
- rename mpegts player module ([d4e59c6](https://github.com/Eosway/rtsp-live-gateway/commit/d4e59c6f2b532a4e83fa2719fe679aca58b3973b))
- reorganize components and composables ([7a04417](https://github.com/Eosway/rtsp-live-gateway/commit/7a0441731d2a3447dbdc96ff25941c953edc02f4))
- split component/composable and tighten public surface ([f07fdf2](https://github.com/Eosway/rtsp-live-gateway/commit/f07fdf214b565fd3bf82f6aa3e51f12907653c2e))
