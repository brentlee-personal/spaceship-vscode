/** A failed request stays paused until the writer explicitly submits again. */
export function createGenerationFailure() {
  let paused = false
  return {
    get paused() {
      return paused
    },
    reset() {
      paused = false
    },
    fail(error?: unknown) {
      paused = true
      const detail = error instanceof Error ? error.message : ""
      let advice = "Check the model connection, then open the writing dialog to retry."
      if (/^40[13]\b|API key|密钥|凭据/i.test(detail)) advice = "Check your API key and model permissions in connection settings, then retry."
      else if (/^429\b/.test(detail)) advice = "The service is rate-limited. Wait before retrying."
      else if (/timeout|timed out/i.test(detail)) advice = "The request timed out. Check the service and retry."
      else if (/fetch|connect|network|SSH/i.test(detail))
        advice = "Cannot reach the model service. Check that your gateway is running and its port is correct, then retry."
      else if (!error) advice = "The model returned no continuation. Check your model settings, then retry."
      // Do not expose raw provider bodies, which may echo manuscript or credentials.
      return `Generation paused. Your current text is preserved. ${advice}`
    },
  }
}
