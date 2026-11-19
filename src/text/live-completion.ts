import { streamCompletion } from "../llm/cerebras.ts"
import { storyRequest } from "../story/prompt.ts"
import type { TextSource } from "./text-stream.ts"

export const liveSource: TextSource = {
  complete: (prefix, steering, signal) => streamCompletion({ ...storyRequest(prefix, steering), signal }),
}
