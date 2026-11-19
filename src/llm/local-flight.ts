/** The dev server forwards these two routes. Static builds use the original providers. */
type EditorSession = { text: string; label: string; live: boolean; preset?: string }
type EditorEvent = { action: string; label?: string }
declare global {
  interface Window {
    spaceshipEditor?: {
      model: string
      ready: Promise<EditorSession>
      onEditor(listener: (event: EditorEvent) => void): void
      post(message: { type: "write" | "copy"; text: string } | { type: "mode"; live: boolean; text: string }): void
      request(route: "chat" | "decisions", body: string, signal: AbortSignal): Promise<Response>
    }
  }
}

export const localModel = window.spaceshipEditor?.model || (import.meta.env.DEV && import.meta.env.VITE_CLIPROXY_MODEL)
export const localChatUrl = `${import.meta.env.BASE_URL}api/chat`
export const localDecisionsUrl = `${import.meta.env.BASE_URL}api/decisions`
