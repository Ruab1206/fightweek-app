import { describe, it, expect } from 'vitest';
import { resolveFighterKey } from './constants';

describe('resolveFighterKey (#1191)', () => {
  const emailForName: Record<string, string> = {
    San: 'sankarem00@gmail.com',
    Caroline: 'carolinemollerh@gmail.com',
  };

  it('returns the email path key when the name is mapped', () => {
    expect(resolveFighterKey('San', emailForName)).toBe('sankarem00@gmail.com');
    expect(resolveFighterKey('Caroline', emailForName)).toBe('carolinemollerh@gmail.com');
  });

  it('falls back to the name when there is no email mapping', () => {
    expect(resolveFighterKey('Chris', emailForName)).toBe('Chris');
  });

  it('falls back to the name when the map is empty (config not yet loaded)', () => {
    expect(resolveFighterKey('San', {})).toBe('San');
  });
});
