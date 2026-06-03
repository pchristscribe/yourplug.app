/**
 * Parse and validate a Sentry sample rate from an environment variable string.
 * Returns defaultValue (with a console.warn) if the value is missing, NaN,
 * or outside the [0, 1] range that Sentry requires.
 *
 * @param {string|undefined} envVar - Raw env var value (e.g. process.env.SENTRY_TRACES_SAMPLE_RATE)
 * @param {number} defaultValue - Fallback rate to use when the value is invalid
 * @returns {number} Validated sample rate in [0, 1]
 */
export function validateSampleRate(envVar, defaultValue) {
  if (!envVar) return defaultValue
  const rate = parseFloat(envVar)
  if (isNaN(rate) || rate < 0 || rate > 1) {
    console.warn(`Invalid sample rate "${envVar}". Must be between 0 and 1. Using default: ${defaultValue}`)
    return defaultValue
  }
  return rate
}
