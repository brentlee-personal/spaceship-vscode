# Changelog

## 0.3.0

- Build and refine a work’s backbone without configuring a model: named outline blocks, reading order and hierarchy, purpose, intended change, and explicit input/output contracts.
- Run local structural checks for missing prerequisites, declared conflicts and invalid hierarchy. Move sibling subtrees intact; guarded removal and undo prevent silent reparenting.
- Export a readable Markdown outline as a new unsaved document without overwriting a manuscript.
- Backbone editing is session-only: export and save before closing. Reopening/re-editing a saved backbone project and model-generated block filling are not included. Existing Writing Desk continuation and progressive context loading remain available separately.

## 0.2.1

- Long-draft continuation keeps a bounded recent window and retrieves matching earlier passages locally. The writing desk shows the ranges included; the full draft stays intact in the editor.

## 0.2.0

- Spaceship Writer brings the original writing controls into VS Code without a Chinese-only edition. The default interface is English, and live continuations use the language of the manuscript unless the writer requests another.
- Get concrete writing directions grounded in your draft. Only selected directions and controls guide the continuation.
- Stream prose without waiting for optional feedback. Superseded requests are cancelled; failures preserve the manuscript and pause background requests.
- Use your existing writing model for feedback, optionally choose another model on the same gateway, or use a dedicated decision service with a fallback.

## 0.1.0

- First Marketplace release: steering controls, native Markdown and selection edits, undo, and bundled design demos.
