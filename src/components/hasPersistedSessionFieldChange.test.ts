import { describe, it, expect } from 'vitest';
import { hasPersistedSessionFieldChange } from './SessionModal';

const base = {
  name: 'MMA Sparring',
  category: 'MMA',
  start: '17:00',
  end: '18:30',
  location: 'Klub A',
  status: 'active',
  cancellationReason: '',
  cancellationTime: null,
};

describe('hasPersistedSessionFieldChange', () => {
  it('returns false when original is null (new session — no prompt possible)', () => {
    expect(hasPersistedSessionFieldChange(null, base)).toBe(false);
  });

  it('returns false when nothing changed', () => {
    expect(hasPersistedSessionFieldChange(base, { ...base })).toBe(false);
  });

  it('returns true when name changed', () => {
    expect(hasPersistedSessionFieldChange(base, { ...base, name: 'MMA Sparring (renamed)' })).toBe(true);
  });

  it('returns true when start changed', () => {
    expect(hasPersistedSessionFieldChange(base, { ...base, start: '18:00' })).toBe(true);
  });

  it('returns true when end changed', () => {
    expect(hasPersistedSessionFieldChange(base, { ...base, end: '19:00' })).toBe(true);
  });

  it('returns true when category changed', () => {
    expect(hasPersistedSessionFieldChange(base, { ...base, category: 'BJJ' })).toBe(true);
  });

  it('returns true when location changed', () => {
    expect(hasPersistedSessionFieldChange(base, { ...base, location: 'Klub B' })).toBe(true);
  });

  it('returns true when status (cancel toggle) changed', () => {
    expect(hasPersistedSessionFieldChange(base, { ...base, status: 'cancelled', cancellationReason: 'Aflyst', cancellationTime: '2026-09-04T10:00:00.000Z' })).toBe(true);
  });

  it('treats missing vs empty-string cancellationReason as equal (no false positive)', () => {
    const original = { ...base, cancellationReason: undefined as unknown as string };
    expect(hasPersistedSessionFieldChange(original, { ...base, cancellationReason: '' })).toBe(false);
  });
});
