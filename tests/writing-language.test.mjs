import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { storyRequest, STORY_REQUEST } from "../src/story/prompt.ts"
import { countCharacters, firstCharacters } from "../src/text/words.ts"
import { sentenceSpans } from "../src/text/segments.ts"

const steering = (direction = "") => ({ direction, leads: [], controls: [] })

for (const [name, text, direction] of [
  ["English nonfiction", "This proposal compares two ways to reduce latency.", "Explain the trade-off."],
  ["Chinese", "她推开门，发现信已经不见了。", "通过对话继续，不要切换语言。"],
  ["mixed-language", "她说：‘Let's begin.’ Then she opened the notebook.", "Preserve the code-switching."],
  ["explicit language override", "The train was late.", "Continue in French, in two sentences."],
  ["direction-only Chinese", "", "写一段中文科普，解释彩虹。"],
  ["empty draft", "", ""],
]) {
  test(`${name}: prompt preserves author input without injecting a sample`, () => {
    const request = storyRequest(text, steering(direction))
    assert.equal(request.user, [text && `[Manuscript]\n${text}`, direction && `[Author direction]\n${direction}`].filter(Boolean).join("\n\n"))
    assert.equal(request.system, STORY_REQUEST.system)
    assert.match(request.system, /explicit output-language request.*first/)
    assert.match(request.system, /Otherwise continue in the language of the manuscript/)
    assert.match(request.system, /Preserve intentional multilingual passages/)
    assert.match(request.system, /Chinese is supported equally/)
    assert.match(request.system, /if both are empty, default to English/)
    assert.doesNotMatch(request.system, /150|250|简体中文故事|自然的中文标点/)
  })
}

test("English control metadata does not overwrite a Chinese manuscript", () => {
  const request = storyRequest("雨停了。", {
    ...steering(),
    controls: [{ dimension: { name: "tone", kind: "choice", options: ["gentle"] }, position: 0, strength: 1 }],
  })
  assert.match(request.user, /\[Manuscript\]\n雨停了。/)
  assert.match(request.user, /tone: gentle \(influence high, 100%\)/)
  assert.match(request.system, /control names, and keywords alone do not determine the output language/)
})

test("entry surface defaults to English without renaming the installed extension", () => {
  const manifest = JSON.parse(readFileSync(new URL("../extension/package.json", import.meta.url), "utf8"))
  assert.equal(`${manifest.publisher}.${manifest.name}`, "brentlee-personal.spaceship-writer")
  assert.equal(manifest.displayName, "Spaceship Writer")
  assert.ok(manifest.contributes.commands.some(({ title }) => title === "Open Writing Desk"))
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8")
  assert.match(html, /<html lang="en">/)
  assert.match(html, /Continue Writing/)
  assert.match(html, /canned English examples/)
  assert.doesNotMatch(html, /\p{Script=Han}/u)
  assert.doesNotMatch(readFileSync(new URL("../src/text/live-completion.ts", import.meta.url), "utf8"), /STORY_OPENINGS|expand:/)
})

test("scrubbing preserves English, Chinese, accents and joined emoji", () => {
  assert.equal(countCharacters("A 中 e\u0301 👩‍🚀"), 4)
  assert.equal(firstCharacters("A 中 e\u0301 👩‍🚀!", 4), "A 中 e\u0301 👩‍🚀")
  const text = "Hello world. 你好世界。 Bonjour !"
  assert.equal(
    sentenceSpans(text)
      .map(({ start, end }) => text.slice(start, end))
      .join(""),
    text,
  )
})
