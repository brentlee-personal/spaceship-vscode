import { streamCompletion } from "../llm/cerebras.ts"
import { storyRequest } from "../story/prompt.ts"
import type { TextSource } from "./text-stream.ts"

export function createLiveSource(onContext: (context: ReturnType<typeof storyRequest>["context"]) => void): TextSource {
  return {
    complete(prefix, steering, signal) {
      const { context, ...request } = storyRequest(prefix, steering)
      signal.throwIfAborted()
      onContext(context)
      return streamCompletion({ ...request, signal })
    },
  }
}
