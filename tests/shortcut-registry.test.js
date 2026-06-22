import { beforeAll, describe, expect, it } from 'vitest';

let Registry;

beforeAll(async () => {
  await import('../js/data/shortcuts.js');
  Registry = globalThis.ShortcutRegistry;
});

const keyEvent = (key, options = {}) => ({
  key,
  code: options.code || '',
  ctrlKey: options.ctrlKey || false,
  metaKey: options.metaKey || false,
  shiftKey: options.shiftKey || false,
  altKey: options.altKey || false,
});

describe('ShortcutRegistry matching', () => {
  it.each([
    ['undo', keyEvent('z', { ctrlKey: true })],
    ['undo', keyEvent('z', { metaKey: true })],
    ['redo-shift', keyEvent('Z', { metaKey: true, shiftKey: true })],
    ['redo', keyEvent('y', { ctrlKey: true })],
    ['save', keyEvent('s', { ctrlKey: true })],
    ['duplicate', keyEvent('d', { metaKey: true })],
    ['copy', keyEvent('c', { ctrlKey: true })],
    ['paste', keyEvent('v', { metaKey: true })],
    ['select-all', keyEvent('a', { ctrlKey: true })],
    ['delete', keyEvent('Delete')],
    ['delete', keyEvent('Backspace')],
    ['send-back', keyEvent('[')],
    ['bring-front', keyEvent(']')],
    ['rotate', keyEvent('r')],
    ['escape', keyEvent('Escape')],
    ['text-tool', keyEvent('t')],
    ['measure', keyEvent('m')],
    ['snap-grid', keyEvent('G', { shiftKey: true })],
    ['toggle-grid', keyEvent('g')],
    ['toggle-rulers', keyEvent('R', { shiftKey: true })],
    ['zoom-in', keyEvent('+', { shiftKey: true })],
    ['zoom-in', keyEvent('=')],
    ['zoom-out', keyEvent('-')],
    ['fit-view', keyEvent('0')],
    ['focus-search', keyEvent('/')],
    ['help', keyEvent('?', { shiftKey: true })],
    ['pan', keyEvent(' ', { code: 'Space' })],
    ['bold', keyEvent('b', { ctrlKey: true })],
    ['italic', keyEvent('i', { metaKey: true })],
    ['underline', keyEvent('u', { ctrlKey: true })],
    ['nudge-left', keyEvent('ArrowLeft')],
    ['nudge-right', keyEvent('ArrowRight')],
    ['nudge-up', keyEvent('ArrowUp')],
    ['nudge-down', keyEvent('ArrowDown')],
    ['nudge-large-left', keyEvent('ArrowLeft', { shiftKey: true })],
    ['nudge-large-right', keyEvent('ArrowRight', { shiftKey: true })],
    ['nudge-large-up', keyEvent('ArrowUp', { shiftKey: true })],
    ['nudge-large-down', keyEvent('ArrowDown', { shiftKey: true })],
  ])('maps %s', (action, event) => {
    expect(Registry.getAction(event)).toBe(action);
  });

  it('does not intercept browser-modified text and reload shortcuts', () => {
    expect(Registry.getAction(keyEvent('t', { ctrlKey: true }))).toBeNull();
    expect(Registry.getAction(keyEvent('r', { metaKey: true }))).toBeNull();
    expect(Registry.getAction(keyEvent('r', { altKey: true }))).toBeNull();
  });

  it('prioritizes specific shifted shortcuts', () => {
    expect(Registry.getAction(keyEvent('g', { shiftKey: true }))).toBe('snap-grid');
    expect(Registry.getAction(keyEvent('r', { shiftKey: true }))).toBe('toggle-rulers');
    expect(Registry.getAction(keyEvent('z', { ctrlKey: true, shiftKey: true }))).toBe('redo-shift');
  });
});

describe('ShortcutRegistry display groups', () => {
  it('returns every planned category, including gestures', () => {
    expect(Registry.getDisplayGroups('Win32').map((group) => group.category)).toEqual([
      'Edit',
      'Selection',
      'Tools',
      'View',
      'Text',
      'Dialogs',
      'Canvas Gestures',
    ]);
  });

  it('uses platform-specific modifier labels', () => {
    const macSave = Registry.getDisplayGroups('MacIntel')
      .flatMap((group) => group.entries)
      .find((entry) => entry.id === 'save');
    const windowsSave = Registry.getDisplayGroups('Win32')
      .flatMap((group) => group.entries)
      .find((entry) => entry.id === 'save');

    expect(macSave.keySets).toEqual([['⌘', 'S']]);
    expect(windowsSave.keySets).toEqual([['Ctrl', 'S']]);
  });
});
