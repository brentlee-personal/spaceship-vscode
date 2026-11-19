# 一起维护 Spaceship

欢迎写作者、扩展开发者和文档贡献者一起维护。想认领一项工作，可以在 [帮助维护](https://github.com/brentlee-personal/spaceship-vscode/issues?q=is%3Aissue%20is%3Aopen%20label%3A%22help%20wanted%22) 留言，写明你愿意验证的平台或使用场景。也欢迎先提交一份可复现的使用反馈。

适合第一份贡献的方向包括 Windows 或 Linux 的 VSIX 安装体验、键盘与屏幕阅读器操作，以及不同语言写作时的旋钮表现。报告问题时请附 VS Code 版本、操作系统、最短复现步骤和预期效果。示例稿件请使用可以公开分享的内容。

从仓库根目录运行：

```sh
npm ci
npm run package:extension
```

用 VS Code 的 **Extensions: Install from VSIX...** 安装 `extension/` 下生成的安装包。请用临时 Markdown 文件检验改动，并在 PR 中说明用户能完成什么、你验证了哪些操作。涉及选区写回时，请一并检查保存、撤销和原文已更改时的冲突提示。

## Community maintainers welcome

We welcome co-maintainers, writers and first-time contributors. Good starting points are testing a VSIX on your platform, keyboard accessibility, and multilingual writing examples. Comment on a **help wanted** issue to coordinate, or open a small pull request with a reproducible user workflow. If you would like to help with ongoing triage or reviews, introduce yourself in the maintainer invitation issue.

See the [community intake notes](docs/community-intake.md) for how we evaluate an upstream idea against a concrete writing or file-management task. Share the project link in upstream conversations when it directly answers a question about this integration. Check earlier replies first.
