import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { validateSampleRate } from '../validateSampleRate.js'

describe('validateSampleRate', () => {
  let warnSpy

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    warnSpy.mockRestore()
  })

  it('returns defaultValue when envVar is undefined', () => {
    expect(validateSampleRate(undefined, 0.5)).toBe(0.5)
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('returns defaultValue when envVar is empty string', () => {
    expect(validateSampleRate('', 0.1)).toBe(0.1)
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('returns parsed float for a valid value', () => {
    expect(validateSampleRate('0.25', 1.0)).toBe(0.25)
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('accepts boundary value 0', () => {
    expect(validateSampleRate('0', 0.5)).toBe(0)
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('accepts boundary value 1', () => {
    expect(validateSampleRate('1', 0.5)).toBe(1)
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('warns and returns default for value > 1', () => {
    expect(validateSampleRate('1.5', 0.1)).toBe(0.1)
    expect(warnSpy).toHaveBeenCalledOnce()
    expect(warnSpy.mock.calls[0][0]).toContain('1.5')
  })

  it('warns and returns default for negative value', () => {
    expect(validateSampleRate('-0.1', 0.5)).toBe(0.5)
    expect(warnSpy).toHaveBeenCalledOnce()
  })

  it('warns and returns default for non-numeric string', () => {
    expect(validateSampleRate('high', 0.1)).toBe(0.1)
    expect(warnSpy).toHaveBeenCalledOnce()
    expect(warnSpy.mock.calls[0][0]).toContain('high')
  })

  it('warns and returns default for NaN', () => {
    expect(validateSampleRate('NaN', 0.5)).toBe(0.5)
    expect(warnSpy).toHaveBeenCalledOnce()
  })
})
