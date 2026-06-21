import { describe, it, expect } from 'vitest';
import { nextNoteText } from './NotesEditor';

describe('nextNoteText (#1189 — notes editor sync)', () => {
  it('keeps the local edit while the user is typing (preserves a trailing space)', () => {
    // The bug: an incoming trimmed snapshot overwrote the in-progress edit,
    // deleting the trailing space and jumping the cursor to the end.
    expect(nextNoteText({ local: 'hello ', external: 'hello', isEditing: true })).toBe('hello ');
  });

  it('keeps the local edit even when external is empty/stale while editing', () => {
    expect(nextNoteText({ local: 'work in progress', external: '', isEditing: true })).toBe('work in progress');
  });

  it('takes the external value when not editing (first load)', () => {
    expect(nextNoteText({ local: '', external: 'loaded note', isEditing: false })).toBe('loaded note');
  });

  it('takes the external value when not editing (update from another device)', () => {
    expect(nextNoteText({ local: 'old', external: 'updated elsewhere', isEditing: false })).toBe('updated elsewhere');
  });
});
