import { describe, it, expect } from 'vitest'
import { DHgateAPIError, mapApiError, handleNetworkError } from '../src/utils/errors.js'

describe('DHgateAPIError', () => {
  it('sets name, message, and extra fields', () => {
    const err = new DHgateAPIError('boom', 'SOME_CODE', 'try again', 500)
    expect(err.name).toBe('DHgateAPIError')
    expect(err.message).toBe('boom')
    expect(err.code).toBe('SOME_CODE')
    expect(err.suggestedAction).toBe('try again')
    expect(err.statusCode).toBe(500)
    expect(err).toBeInstanceOf(Error)
  })

  it('toUserMessage() combines the message and suggested action', () => {
    const err = new DHgateAPIError('boom', 'SOME_CODE', 'try again')
    expect(err.toUserMessage()).toBe('boom\n\ntry again')
  })
})

describe('mapApiError', () => {
  const cases: Array<[number, string]> = [
    [401, 'AUTH_FAILED'],
    [403, 'AUTH_FAILED'],
    [429, 'RATE_LIMIT'],
    [422, 'INVALID_PARAMS'],
    [417, 'VALIDATION_ERROR'],
    [439, 'QUOTA_EXCEEDED'],
    [499, 'TIMEOUT'],
    [500, 'SERVICE_ERROR'],
    [503, 'SERVICE_ERROR'],
  ]

  it.each(cases)('maps status %i to code %s', (statusCode, expectedCode) => {
    const err = mapApiError(statusCode, 'original message')
    expect(err.code).toBe(expectedCode)
    expect(err.statusCode).toBe(statusCode)
  })

  it('falls back to UNKNOWN_ERROR for an unrecognized status code', () => {
    const err = mapApiError(418, 'teapot')
    expect(err.code).toBe('UNKNOWN_ERROR')
    expect(err.message).toContain('teapot')
    expect(err.statusCode).toBe(418)
  })

  it('includes the original message for 422 invalid params', () => {
    const err = mapApiError(422, 'keywords is required')
    expect(err.message).toContain('keywords is required')
  })
})

describe('handleNetworkError', () => {
  it('maps ECONNREFUSED to NETWORK_ERROR with no statusCode', () => {
    const err = handleNetworkError(new Error('connect ECONNREFUSED 127.0.0.1:443'))
    expect(err.code).toBe('NETWORK_ERROR')
    expect(err.statusCode).toBeUndefined()
  })

  it('maps ENOTFOUND to NETWORK_ERROR', () => {
    const err = handleNetworkError(new Error('getaddrinfo ENOTFOUND api.dhgate.com'))
    expect(err.code).toBe('NETWORK_ERROR')
  })

  it('maps a timeout message to TIMEOUT', () => {
    const err = handleNetworkError(new Error('request timeout after 30000ms'))
    expect(err.code).toBe('TIMEOUT')
  })

  it('maps ETIMEDOUT to TIMEOUT', () => {
    const err = handleNetworkError(new Error('connect ETIMEDOUT'))
    expect(err.code).toBe('TIMEOUT')
  })

  it('falls back to a generic NETWORK_ERROR for anything else', () => {
    const err = handleNetworkError(new Error('socket hang up'))
    expect(err.code).toBe('NETWORK_ERROR')
    expect(err.message).toContain('socket hang up')
  })
})
