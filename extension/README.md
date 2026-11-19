# Spaceship 中文写作台

在 VS Code 命令面板运行 **Spaceship: 打开写作台**。在资源管理器右键 Markdown 或文本文件可以打开全文，在编辑器选中文字后右键 **用选区续写** 可以只编辑选区。在文件夹上右键 **新建 Markdown 稿件** 可从空白页开始。

输入续写方向，按 **推荐维度** 获取候选，或用 **添加维度** 手工组合紧张感、叙述方式等旋钮。点击 **续写下一段** 后，画布会逐步显示结果。用 **写回编辑器** 将可见正文写回原文件或原选区。使用 VS Code 的保存和撤销命令管理文件。若原文已发生变化，使用 **另存为…** 保留新稿。

初次安装可先体验模拟模式。执行 **Spaceship: 配置模型连接**，选择自己的模型并切换到实时模式。续写使用本机 CLIProxyAPI。运行 **Spaceship: 设置 CLIProxyAPI 密钥** 存入 VS Code SecretStorage，或在用户设置中指定 `spaceship.keyFile`，读取其中的 `CLIPROXY_API_KEY`。用 `spaceship.proxyPort` 和 `spaceship.model` 选择端口和模型。Decisions 使用 `spaceship.decisionsPort` 对应的本机服务；需要访问另一台机器时，填写 `spaceship.decisionsSshHost`，目标机须提供 curl 和监听回环地址的 Plumb 服务。扩展随包提供写作台和设计样例。

源自 Chuanqi Sun 的 [Spaceship IDE](https://github.com/chuanqisun/spaceship)，沿用 MIT 许可证。

## Help maintain Spaceship

We welcome contributors and co-maintainers. Try the extension with a disposable manuscript, report a reproducible issue, or help with Windows, Linux and accessibility testing. [Contributing guide](https://github.com/brentlee-personal/spaceship-vscode/blob/main/CONTRIBUTING.md) · [Open issues](https://github.com/brentlee-personal/spaceship-vscode/issues)
