# Spaceship 中文写作台 · VS Code 扩展

在资源管理器中选择稿件，或在编辑器里选中一段正文，用多个旋钮引导下一段写作。**写回编辑器** 使用 VS Code 的原生编辑、撤销与保存。界面和 18 个设计样例随扩展一起安装。

[下载安装包](https://github.com/brentlee-personal/spaceship-vscode/releases/latest) · [使用与连接配置](extension/README.md) · [社区参考与采纳记录](docs/community-intake.md)

在 VS Code 中运行 `Extensions: Install from VSIX...` 选择下载的安装包，然后运行 **Spaceship: 打开写作台**。

本地构建需要 Node.js 24 和 npm。在仓库根目录执行 `npm ci` 和 `npm run package:extension`，VSIX 会生成在 `extension/`。浏览器开发入口为 `npm run dev`。

## 参与维护 · Maintainers welcome

欢迎一起维护跨平台安装、无障碍操作、文件编辑与多语言写作体验。请在[贡献指南](CONTRIBUTING.md)和 [help wanted 任务](https://github.com/brentlee-personal/spaceship-vscode/issues?q=is%3Aissue%20is%3Aopen%20label%3A%22help%20wanted%22) 中认领工作。

Spaceship is an independent, MIT-licensed VS Code adaptation of Chuanqi Sun’s Spaceship IDE. Open a Markdown file from Explorer, steer a continuation along multiple dimensions, then apply it to the source selection as a native undoable edit. A local model gateway is optional. We welcome writers, extension developers, documentation contributors and co-maintainers.

以下是原作者的项目介绍。

# 🕹️ Spaceship IDE

Steer your ideas in realtime, space pilot style!

![Screencast](./extra/screencast.gif)

## Demos

Watch on [Instagram](https://www.instagram.com/reels/DfyQPhFtW-z/) and [YouTube](https://www.youtube.com/watch?v=3WmNLWUmcnY). You can try the simulator at [https://chuanqisun.github.io/spaceship/](https://chuanqisun.github.io/spaceship/) with the option to go live with your API keys for Cerebras and Gemini. Keys stay in your browser local storage. Do it at your own risk.

## Conjecture

> In the near future, LLM and Decision Models will reach 60 FPS interactivity.

When that happens, what new interaction paradigms will unlock? This project demonstrates plausible and desirable interactions for that future.

1. **Focus monitor**: can we visualize what LLM is paying attention to, and use that to guide human's focus towards what's important?

   ![focus monitor](./extra/clips/focus-monitor.gif)

2. **Attention lock**: can we force LLM to pay more attention to specific phrases so as to bias its future behavior?

   ![attention lock](./extra/clips/attention-lock.gif)

3. **Future Vector Steering**: can we decompose the task into eigenvectors, independently tune each, and re-compose them to influence the incoming text?

   ![future steering](./extra/clips/future-steering.gif)

4. **Realtime re-generation**: when text generation is cheap and fast, can we explore alternative futures by scrubbing?

   ![realtime regeneration](./extra/clips/realtime-regeneration.gif)

## Design process

I used Claude Code for most of the implementation but stayed hands-on for the UI/UX. I iterate using interactive style swatch, a technique where I prompt AI to give me diverse options of designs, I provide feedback, and it iterates. You can see the design artifacts in the [extra page](https://chuanqisun.github.io/spaceship/extra/style-1.html).

To achieve the realtime experience, I have to use agreesive speculative generation and manage cache invalidation based on user interactions. For example, when the main knob moves backward, I have to empty future texts and cancel ongoing requests. There are many considerations like this throughout the system and that took a lot of human judgement - claude didn't one shot them.

## Theory

I'm currently focusing on systems that help human shape ideas in realtime. This project is a small step towards my [upcoming thesis](https://code.chuanqisun.com/master-thesis/) at the MIT Media Lab, where I investigate how semantic and symoblic systems can be coupled to enhance human creativity, agency, and joy of craft.

## Citation

If you build on this work, please cite it as:

```bibtex
@misc{sun2026spaceship,
  author       = {Sun, Chuanqi},
  title        = {Spaceship {IDE}: Steer Your Ideas in Realtime, Space Pilot Style},
  year         = {2026},
  publisher    = {GitHub},
  howpublished = {\url{https://github.com/chuanqisun/spaceship}},
  note         = {Demo: \url{https://chuanqisun.github.io/spaceship/}}
}
```
