import { describe, it, expect } from 'vitest';
import { newSessionId } from './useSessionHandlers';

describe('newSessionId (A1 / #1185)', () => {
  it('returns a string', () => {
    expect(typeof newSessionId()).toBe('string');
  });

  it('produces unique ids even when called in a tight loop (no Date.now() collisions)', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 10000; i++) ids.add(newSessionId());
    // The old Date.now() scheme collided for ids created in the same millisecond;
    // UUIDs must all be distinct.
    expect(ids.size).toBe(10000);
  });

  it('produces ids that survive being used in a training-log note key', () => {
    // Notes are keyed `s_{date}_{sessionId}` (useActivityNotes). The id must be a
    // stable, non-empty token so the note stays attached to its session.
    const id = newSessionId();
    const noteKey = `s_2026-06-19_${id}`;
    expect(noteKey).toMatch(/^s_2026-06-19_[0-9a-f-]+$/i);
    expect(id.length).toBeGreaterThan(0);
  });
});
