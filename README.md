# Spaceship Writer for VS Code

An independent, MIT-licensed adaptation of [Chuanqi Sun’s Spaceship IDE](https://github.com/chuanqisun/spaceship) for writing in VS Code, not a language-specific edition. Open a manuscript or selection, steer a continuation with independent controls, then apply it as a native undoable edit. Chinese remains supported alongside English and other languages.

[Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=brentlee-personal.spaceship-writer) · [Download VSIX](https://github.com/brentlee-personal/spaceship-vscode/releases/latest) · [Usage and connection setup](extension/README.md) · [Community intake](docs/community-intake.md) · [Upstream issue review](docs/upstream-issues.md)

Install the VSIX using `Extensions: Install from VSIX...`, then run **Spaceship: Open Writing Desk**. The default interface is English. Live writing follows the manuscript language unless you explicitly request another language in Direction. An empty manuscript follows the direction's language; with neither, it defaults to English. The selected model determines generation quality and language coverage.

Simulation is a canned English interaction demo, not generated writing or a translation service. The 18 bundled design studies include Chinese-language examples and remain historical examples, not the product's language restriction.

## Backbone Workbench in 0.3.0

Run **Spaceship: Open Backbone Workbench** to refine a readable outline with named blocks, hierarchy, input/output contracts and local structural checks. No model setup is needed. Export a new Markdown copy to keep and write from; the workbench never applies it to an existing manuscript.

Editing is **session-only**: export and save before closing. Saved-backbone reopening/re-editing and model-generated block filling are not included. Existing Writing Desk continuation and progressive context loading are preserved separately.

## Build and contribute

Requires Node.js 24 and npm. Run `npm ci`, `npm test`, and `npm run package:extension`; the VSIX is created in `extension/`. Use `npm run dev` for browser development. The extension identifier remains `brentlee-personal.spaceship-writer`.

We welcome writers, extension developers, accessibility testers and co-maintainers. See [CONTRIBUTING](CONTRIBUTING.md) and [help wanted](https://github.com/brentlee-personal/spaceship-vscode/issues?q=is%3Aissue%20is%3Aopen%20label%3A%22help%20wanted%22). Please test English, Chinese, and other manuscript languages without treating the interface language as the output language.

## Original project

The following is the original author's project introduction. Its hosted browser demo and browser-stored provider keys are separate from this extension's local gateway configuration.

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
