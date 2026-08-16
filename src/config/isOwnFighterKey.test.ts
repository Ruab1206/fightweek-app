import { describe, it, expect } from 'vitest';
import { isOwnFighterKey } from './constants';

describe('isOwnFighterKey', () => {
  it('returns true for exact matching values', () => {
    expect(isOwnFighterKey('fighter@example.com', 'fighter@example.com')).toBe(true);
  });

  it('returns true when only casing differs', () => {
    expect(isOwnFighterKey('Fighter@Example.com', 'fighter@example.com')).toBe(true);
  });

  it('returns true when only surrounding whitespace differs', () => {
    expect(isOwnFighterKey('  fighter@example.com  ', 'fighter@example.com')).toBe(true);
  });

  it('returns false when the values differ', () => {
    expect(isOwnFighterKey('fighter@example.com', 'other@example.com')).toBe(false);
  });

  it('returns false when fighterKey is empty', () => {
    expect(isOwnFighterKey('', 'fighter@example.com')).toBe(false);
  });

  it('returns false when fighterKey is whitespace-only', () => {
    expect(isOwnFighterKey('   ', 'fighter@example.com')).toBe(false);
  });

  it('returns false when userEmail is null', () => {
    expect(isOwnFighterKey('fighter@example.com', null)).toBe(false);
  });

  it('returns false when userEmail is undefined', () => {
    expect(isOwnFighterKey('fighter@example.com', undefined)).toBe(false);
  });

  it('returns false when userEmail is empty', () => {
    expect(isOwnFighterKey('fighter@example.com', '')).toBe(false);
  });

  it('returns false when userEmail is whitespace-only', () => {
    expect(isOwnFighterKey('fighter@example.com', '   ')).toBe(false);
  });

  it('returns false for an administrator viewing another fighter', () => {
    // The admin's own authenticated email differs from the fighter they selected
    // to view — no role/admin check exists here, only the identity mismatch.
    expect(isOwnFighterKey('other-fighter@example.com', 'admin@example.com')).toBe(false);
  });
});
