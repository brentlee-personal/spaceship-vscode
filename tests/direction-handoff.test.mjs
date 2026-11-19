import assert from "node:assert/strict"
import test from "node:test"
import { groundedLeads, recommendationPrompt, suggestedDimension } from "../src/text/direction-recommendation.ts"
import { valueOf, writingDimensions } from "../src/text/dimension.ts"
import { storyRequest } from "../src/story/prompt.ts"

const manuscript = "Ada slipped the letter away. 雨还没停。"
const grounded = { before: "slipped the ", keyword: "letter", after: " away" }
const stale = { before: "burned the ", keyword: "letter", after: " yesterday" }

test("captures only current, unique manuscript phrases and keeps direction in a single recommendation request", () => {
  const input = { text: manuscript, leads: [stale, grounded, grounded], direction: "Make the tension quieter", taken: [] }
  assert.deepEqual(groundedLeads(manuscript, input.leads), [grounded])
  const prompt = JSON.parse(recommendationPrompt(input, writingDimensions, 3))
  assert.equal(prompt.recentManuscript, manuscript)
  assert.deepEqual(prompt.keyPhrases, ["slipped the [letter] away"])
  assert.equal(prompt.authorDirection, input.direction)
  assert.equal(prompt.count, 3)
  const revised = JSON.parse(recommendationPrompt({ ...input, text: "Only the rain remained." }, writingDimensions, 3))
  assert.deepEqual(revised.keyPhrases, [])
})

test("only known targets and manuscript-grounded character names can become a recommendation", () => {
  assert.equal(suggestedDimension("tension => explosions", writingDimensions, manuscript), undefined)
  assert.equal(suggestedDimension("focus: Unknown | narrator => Unknown", writingDimensions, manuscript), undefined)
  assert.equal(suggestedDimension("disguise => anything", writingDimensions, manuscript), undefined)
  const focus = suggestedDimension("focus: Ada | Unknown | narrator => Ada", writingDimensions, manuscript)
  assert.deepEqual(focus.options, ["Ada", "narrator"])
  assert.equal(valueOf({ dimension: focus, position: focus.suggestedPosition }), "Ada")
})

test("an unaccepted direction never becomes a generation control; accepted target and author strength travel together", () => {
  const calm = suggestedDimension("tension => calm", writingDimensions, manuscript)
  const presentation = suggestedDimension("presentation => dialogue", writingDimensions, manuscript)
  const baseline = { direction: "Continue this scene", leads: [grounded], controls: [] }
  assert.doesNotMatch(storyRequest(manuscript, baseline).user, /tension:|presentation:/)
  const controls = [{ dimension: calm, position: calm.suggestedPosition, strength: 0.64 }]
  const user = storyRequest(manuscript, { ...baseline, controls }).user
  assert.match(user, /tension: calm \(influence medium, 64%\)/)
  assert.doesNotMatch(user, new RegExp(presentation.name + ":"))
})

test("long manuscripts use a bounded excerpt without splitting Unicode code points", () => {
  const text = "🌒".repeat(3500) + " Ada"
  const body = JSON.parse(recommendationPrompt({ text, leads: [], taken: [] }, writingDimensions, 2))
  assert.equal(Array.from(body.recentManuscript).length, 3000)
  assert.match(body.recentManuscript, /^🌒.* Ada$/)
})
