# Piano Practice

本地钢琴练习软件。导入自己的乐谱，用五线谱或数字谱、下落音符和 MIDI 键盘练习。

[English](README.en.md) · [下载预览版](https://github.com/clementine477/piano-practice/releases) · [来源与许可证](docs/THIRD_PARTY.md)

## 功能

- 可自行导入曲谱和课程练习文件（MusicXML、MXL、MIDI、Quick JSON），保存到本机曲库。
- 五线谱与数字谱切换；下落音符、88 键键盘和踏板提示。
- 分手示范、分段练习、等待跟弹、变速、循环，以及本次练习统计和报告导出。
- 四种本地采样钢琴，可调整明亮度、空间感和基准音高；木质敲击采样节拍器。
- 中文、英文界面。基本练习不需要账号、服务端或联网。

公开版不附课程或个人练习记录。[Day One / Are You Lost 学习示例](examples/README.md)单独提供，可自行导入；它们不适用软件 MIT 许可。其他曲目请导入有权使用的文件。`tests/fixtures` 中的短谱是自动化测试材料，不是随应用提供的课程。

## macOS 预览版

目前验证的是 Apple Silicon 版本。下载 Releases 中的 ZIP，解压后将应用拖入“应用程序”。此预览版使用本地签名，尚未经过 Apple 公证；首次打开可能需要在“系统设置 → 隐私与安全性”中允许打开。无需关闭系统安全保护。

首次启动曲库为空，从“导入”加入乐谱，再选择 MIDI 设备或使用屏幕键盘。所有四种钢琴采样已包含在安装包中。

这是 **0.7.0-preview.1**，适合试用和反馈。实体 MIDI 设备兼容性、不同屏幕和大型曲谱仍需更多实际测试。Windows/Linux 尚未提供安装包。高级指法生成、PDF 识谱和音频转谱不属于本公开版；请先用其他工具转为 MusicXML/MIDI。

## 从源码运行

需要 Node.js 24、pnpm 11.25.0、Python 3。桌面打包需要 macOS 及命令行开发工具。

```sh
pnpm install --frozen-lockfile
pnpm samples
pnpm desktop
```

`pnpm samples` 下载约 255 MB 的独立音色包，并校验 ZIP 和每个文件的 SHA-256。源码仓库不保存这些大文件。已有 ZIP 可离线安装：

```sh
python3 tools/fetch-samples.py --from-dir /path/to/sample-zips
```

网页开发使用 `pnpm dev`；浏览器需支持 Web MIDI。生产构建和检查：

```sh
pnpm test
pnpm build
pnpm smoke
pnpm check:public
pnpm package:mac
```

`smoke` 会打开独立数据目录中的隐藏 Electron 窗口，导入测试谱并检测音频，结束后关闭。不会读取日常使用的曲库。结果保存在 `.cache/`。

## 数据与隐私

乐谱、音轨、设置和练习进度（位置、速度、循环范围）保存在本机应用数据目录。按键明细与本次统计只在当前会话中保留，关闭前请导出；尚未提供跨次练习历史。没有遥测、云同步、内置账号或广告。版本更新需要手动下载；导入本地更新包不会自动联系更新服务。删除应用不等于删除曲库。更换电脑前请另行备份自己的乐谱和应用数据，当前未提供完整曲库迁移向导。

## 开源说明

本项目基于 [gigliof/bach-to-basics](https://github.com/gigliof/bach-to-basics)，保留其 MIT 许可及作者署名。应用代码采用 MIT；alphaTab 修改文件为 MPL-2.0；钢琴录音、字体和其他依赖分别遵循各自许可证，详见 [第三方说明](docs/THIRD_PARTY.md)。软件的 MIT 许可不适用于导入的作品。

部分应用模块由已交付版本恢复为可构建 JavaScript；这是为保留已验证的播放和界面修复，原始 TypeScript 尚未完整恢复。结构、限制和后续维护入口见 [源码说明](docs/PROVENANCE.md)。

欢迎提交问题和改进；报告问题前请移除私人曲谱、设备名称和本机路径，参见 [贡献指南](CONTRIBUTING.md)。
