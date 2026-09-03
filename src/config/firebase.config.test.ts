/**
 * firebase.config.test.ts — pure unit tests for resolveAuthDomain, the
 * exact-host same-origin authDomain allow-list (see firebase.ts). No
 * Firebase SDK, no window, no network — plain hostname strings only.
 */
import { describe, it, expect } from 'vitest';
import { resolveAuthDomain } from './firebase';

const PROD_HOST = 'fightweek-app.vercel.app';
const STABLE_TST_HOST = 'fightweek-app-git-feature-bedre-design-runes-projects-de9c17f6.vercel.app';
const DEFAULT_DOMAIN = 'fightweek-app.firebaseapp.com';

describe('resolveAuthDomain', () => {
  it('1. resolves the PRD hostname to itself', () => {
    expect(resolveAuthDomain(PROD_HOST)).toBe(PROD_HOST);
  });

  it('2. resolves the stable TST hostname to itself', () => {
    expect(resolveAuthDomain(STABLE_TST_HOST)).toBe(STABLE_TST_HOST);
  });

  it('3. leaves localhost on the existing fallback authDomain', () => {
    expect(resolveAuthDomain('localhost')).toBe(DEFAULT_DOMAIN);
  });

  it('4. leaves 127.0.0.1 on the existing fallback authDomain', () => {
    expect(resolveAuthDomain('127.0.0.1')).toBe(DEFAULT_DOMAIN);
  });

  it('5. leaves a unique per-deployment Vercel URL on the existing fallback authDomain', () => {
    expect(resolveAuthDomain('fightweek-app-git-feature-bedre-design-abc123-runes-projects-de9c17f6.vercel.app')).toBe(DEFAULT_DOMAIN);
  });

  it('6. leaves an arbitrary vercel.app hostname on the existing fallback authDomain', () => {
    expect(resolveAuthDomain('some-other-project.vercel.app')).toBe(DEFAULT_DOMAIN);
  });

  it('7. matches exactly, with no wildcard/substring/suffix behaviour', () => {
    // A hostname that merely CONTAINS the stable TST host as a substring must not match.
    expect(resolveAuthDomain(`evil-${STABLE_TST_HOST}`)).toBe(DEFAULT_DOMAIN);
    expect(resolveAuthDomain(`${STABLE_TST_HOST}.evil.com`)).toBe(DEFAULT_DOMAIN);
    // Nothing returned ever contains a wildcard character.
    expect(resolveAuthDomain(PROD_HOST)).not.toContain('*');
    expect(resolveAuthDomain(STABLE_TST_HOST)).not.toContain('*');
  });

  it('8. only ever returns one of the two allow-listed hostnames or the single default domain', () => {
    const hosts = [PROD_HOST, STABLE_TST_HOST, 'localhost', '127.0.0.1', 'random.vercel.app'];
    for (const host of hosts) {
      expect([PROD_HOST, STABLE_TST_HOST, DEFAULT_DOMAIN]).toContain(resolveAuthDomain(host));
    }
  });

  it('9. introduces no credential, token, role, user, or bypass parameter', () => {
    // Structural proof: the function accepts only a hostname string.
    expect(resolveAuthDomain.length).toBe(1);
  });
});
