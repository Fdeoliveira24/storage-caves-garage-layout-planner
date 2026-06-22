/**
 * Keyboard shortcut + canvas gesture catalog.
 * Matching and help-modal display intentionally share this source of truth.
 */
const ShortcutRegistry = (() => {
  const CATEGORY_ORDER = [
    'Edit',
    'Selection',
    'Tools',
    'View',
    'Text',
    'Dialogs',
    'Canvas Gestures',
  ];

  const modKeys = (key) => ({
    default: [['Ctrl', key]],
    mac: [['⌘', key]],
  });

  const entries = [
    {
      id: 'redo-shift',
      category: 'Edit',
      description: 'Redo',
      context: 'Global',
      keys: { default: [['Ctrl', 'Shift', 'Z']], mac: [['⌘', 'Shift', 'Z']] },
      match: { key: 'z', mod: true, shift: true, alt: false },
      priority: 30,
    },
    {
      id: 'undo',
      category: 'Edit',
      description: 'Undo',
      context: 'Global',
      keys: modKeys('Z'),
      match: { key: 'z', mod: true, shift: false, alt: false },
      priority: 20,
    },
    {
      id: 'redo',
      category: 'Edit',
      description: 'Redo (alternate)',
      context: 'Global',
      keys: modKeys('Y'),
      match: { key: 'y', mod: true, shift: false, alt: false },
    },
    {
      id: 'save',
      category: 'Edit',
      description: 'Save layout',
      context: 'Global',
      keys: modKeys('S'),
      match: { key: 's', mod: true, shift: false, alt: false },
    },
    {
      id: 'duplicate',
      category: 'Edit',
      description: 'Duplicate selection',
      context: 'Selection required',
      keys: modKeys('D'),
      match: { key: 'd', mod: true, shift: false, alt: false },
    },
    {
      id: 'copy',
      category: 'Edit',
      description: 'Copy selection',
      context: 'Selection required',
      keys: modKeys('C'),
      match: { key: 'c', mod: true, shift: false, alt: false },
    },
    {
      id: 'paste',
      category: 'Edit',
      description: 'Paste',
      context: 'App clipboard',
      keys: modKeys('V'),
      match: { key: 'v', mod: true, shift: false, alt: false },
    },
    {
      id: 'select-all',
      category: 'Edit',
      description: 'Select all items and text',
      context: 'Garage units excluded',
      keys: modKeys('A'),
      match: { key: 'a', mod: true, shift: false, alt: false },
    },
    {
      id: 'delete',
      category: 'Edit',
      description: 'Delete selection',
      context: 'Items or garage units',
      keys: { default: [['Delete'], ['Backspace']] },
      match: { keys: ['delete', 'backspace'], mod: false, alt: false },
    },
    {
      id: 'send-back',
      category: 'Edit',
      description: 'Send selection backward',
      context: 'Selection required',
      keys: { default: [['[']] },
      match: { key: '[', mod: false, shift: false, alt: false },
    },
    {
      id: 'bring-front',
      category: 'Edit',
      description: 'Bring selection forward',
      context: 'Selection required',
      keys: { default: [[']']] },
      match: { key: ']', mod: false, shift: false, alt: false },
    },
    {
      id: 'rotate',
      category: 'Selection',
      description: 'Rotate selection 90°',
      context: 'Selection required',
      keys: { default: [['R']] },
      match: { key: 'r', mod: false, shift: false, alt: false },
    },
    {
      id: 'nudge',
      category: 'Selection',
      description: 'Nudge selection 2px',
      context: 'Selection required',
      keys: { default: [['Arrow keys']] },
      displayOnly: true,
    },
    {
      id: 'nudge-large',
      category: 'Selection',
      description: 'Nudge selection 10px',
      context: 'Selection required',
      keys: { default: [['Shift', 'Arrow keys']] },
      displayOnly: true,
    },
    ...['left', 'right', 'up', 'down'].flatMap((direction) => {
      const key = `arrow${direction}`;
      return [
        {
          id: `nudge-${direction}`,
          display: false,
          match: { key, mod: false, shift: false, alt: false },
        },
        {
          id: `nudge-large-${direction}`,
          display: false,
          match: { key, mod: false, shift: true, alt: false },
          priority: 20,
        },
      ];
    }),
    {
      id: 'escape',
      category: 'Selection',
      description: 'Cancel active tool or clear selection',
      context: 'Context-sensitive',
      keys: { default: [['Esc']] },
      match: { key: 'escape' },
    },
    {
      id: 'text-tool',
      category: 'Tools',
      description: 'Toggle text tool',
      context: 'Canvas',
      keys: { default: [['T']] },
      match: { key: 't', mod: false, shift: false, alt: false },
    },
    {
      id: 'measure',
      category: 'Tools',
      description: 'Toggle measurement tool',
      context: 'Canvas',
      keys: { default: [['M']] },
      match: { key: 'm', mod: false, shift: false, alt: false },
    },
    {
      id: 'snap-grid',
      category: 'View',
      description: 'Enable or disable snap-to-grid',
      context: 'Canvas',
      keys: { default: [['Shift', 'G']] },
      match: { key: 'g', mod: false, shift: true, alt: false },
      priority: 20,
    },
    {
      id: 'toggle-grid',
      category: 'View',
      description: 'Show or hide grid',
      context: 'Canvas',
      keys: { default: [['G']] },
      match: { key: 'g', mod: false, shift: false, alt: false },
    },
    {
      id: 'toggle-rulers',
      category: 'View',
      description: 'Show or hide rulers',
      context: 'Canvas',
      keys: { default: [['Shift', 'R']] },
      match: { key: 'r', mod: false, shift: true, alt: false },
      priority: 20,
    },
    {
      id: 'zoom-in',
      category: 'View',
      description: 'Zoom in',
      context: 'Canvas',
      keys: { default: [['+'], ['=']] },
      match: { keys: ['+', '='], mod: false, alt: false },
    },
    {
      id: 'zoom-out',
      category: 'View',
      description: 'Zoom out',
      context: 'Canvas',
      keys: { default: [['−']] },
      match: { key: '-', mod: false, shift: false, alt: false },
    },
    {
      id: 'fit-view',
      category: 'View',
      description: 'Fit floor plan to canvas',
      context: 'Floor plan required',
      keys: { default: [['0']] },
      match: { key: '0', mod: false, shift: false, alt: false },
    },
    {
      id: 'focus-search',
      category: 'View',
      description: 'Open Items and focus search',
      context: 'Desktop',
      keys: { default: [['/']] },
      match: { key: '/', mod: false, shift: false, alt: false },
    },
    {
      id: 'help',
      category: 'View',
      description: 'Open keyboard shortcuts',
      context: 'Global',
      keys: { default: [['?']] },
      match: { key: '?', mod: false, alt: false },
      priority: 30,
    },
    {
      id: 'pan',
      category: 'View',
      description: 'Temporarily enable canvas pan',
      context: 'Hold while dragging',
      keys: { default: [['Space']] },
      match: { code: 'Space', mod: false, shift: false, alt: false },
    },
    {
      id: 'bold',
      category: 'Text',
      description: 'Toggle bold',
      context: 'Text selected',
      keys: modKeys('B'),
      match: { key: 'b', mod: true, shift: false, alt: false },
    },
    {
      id: 'italic',
      category: 'Text',
      description: 'Toggle italic',
      context: 'Text selected',
      keys: modKeys('I'),
      match: { key: 'i', mod: true, shift: false, alt: false },
    },
    {
      id: 'underline',
      category: 'Text',
      description: 'Toggle underline',
      context: 'Text selected',
      keys: modKeys('U'),
      match: { key: 'u', mod: true, shift: false, alt: false },
    },
    {
      id: 'dialog-confirm',
      category: 'Dialogs',
      description: 'Confirm dialog or prompt',
      context: 'Dialog open',
      keys: { default: [['Enter']] },
      displayOnly: true,
    },
    {
      id: 'dialog-close',
      category: 'Dialogs',
      description: 'Close or cancel',
      context: 'Dialog or panel open',
      keys: { default: [['Esc']] },
      displayOnly: true,
    },
    {
      id: 'dialog-focus',
      category: 'Dialogs',
      description: 'Move focus forward or backward',
      context: 'Dialog or Clients panel',
      keys: { default: [['Tab'], ['Shift', 'Tab']] },
      displayOnly: true,
    },
    {
      id: 'gesture-select',
      type: 'gesture',
      category: 'Canvas Gestures',
      description: 'Select an object',
      context: 'Canvas',
      keys: { default: [['Click']] },
      displayOnly: true,
    },
    {
      id: 'gesture-multi-select',
      type: 'gesture',
      category: 'Canvas Gestures',
      description: 'Add items or garage units to selection',
      context: 'Canvas',
      keys: { default: [['Shift', 'Click']] },
      displayOnly: true,
    },
    {
      id: 'gesture-box-select',
      type: 'gesture',
      category: 'Canvas Gestures',
      description: 'Select multiple items',
      context: 'Start on empty canvas',
      keys: { default: [['Drag selection box']] },
      displayOnly: true,
    },
    {
      id: 'gesture-move',
      type: 'gesture',
      category: 'Canvas Gestures',
      description: 'Move an item or garage unit',
      context: 'Canvas',
      keys: { default: [['Drag object']] },
      displayOnly: true,
    },
    {
      id: 'gesture-rotate',
      type: 'gesture',
      category: 'Canvas Gestures',
      description: 'Rotate freely',
      context: 'Selected item',
      keys: { default: [['Drag rotation handle']] },
      displayOnly: true,
    },
    {
      id: 'gesture-zoom',
      type: 'gesture',
      category: 'Canvas Gestures',
      description: 'Zoom canvas',
      context: 'Canvas',
      keys: { default: [['Mouse wheel']] },
      displayOnly: true,
    },
    {
      id: 'gesture-pan',
      type: 'gesture',
      category: 'Canvas Gestures',
      description: 'Pan canvas',
      context: 'Canvas',
      keys: { default: [['Space', 'Drag']] },
      displayOnly: true,
    },
    {
      id: 'gesture-unit-snap',
      type: 'gesture',
      category: 'Canvas Gestures',
      description: 'Snap nearby garage edges together',
      context: 'Automatic near an edge',
      keys: { default: [['Drag garage unit']] },
      displayOnly: true,
    },
  ];

  function normalizeKey(key) {
    if (key === ' ') return 'space';
    return String(key || '').toLowerCase();
  }

  function matches(event, match) {
    if (!match) return false;
    const key = normalizeKey(event.key);
    const mod = !!(event.ctrlKey || event.metaKey);
    if (match.code && event.code !== match.code) return false;
    if (match.key && key !== normalizeKey(match.key)) return false;
    if (match.keys && !match.keys.map(normalizeKey).includes(key)) return false;
    if (typeof match.mod === 'boolean' && mod !== match.mod) return false;
    if (typeof match.shift === 'boolean' && !!event.shiftKey !== match.shift) return false;
    if (typeof match.alt === 'boolean' && !!event.altKey !== match.alt) return false;
    return true;
  }

  function getAction(event) {
    const matchable = entries
      .filter((entry) => entry.match && !entry.displayOnly)
      .sort((a, b) => (b.priority || 0) - (a.priority || 0));
    return matchable.find((entry) => matches(event, entry.match))?.id || null;
  }

  function isMacPlatform(platform) {
    const value =
      platform ||
      (typeof navigator !== 'undefined' &&
        (navigator.userAgentData?.platform || navigator.platform)) ||
      '';
    return /mac|iphone|ipad|ipod/i.test(String(value));
  }

  function getDisplayGroups(platform) {
    const keyVariant = isMacPlatform(platform) ? 'mac' : 'default';
    return CATEGORY_ORDER.map((category) => ({
      category,
      entries: entries
        .filter((entry) => entry.display !== false && entry.category === category)
        .map((entry) => ({
          id: entry.id,
          type: entry.type || 'keyboard',
          description: entry.description,
          context: entry.context,
          keySets: entry.keys?.[keyVariant] || entry.keys?.default || [],
        })),
    })).filter((group) => group.entries.length > 0);
  }

  return Object.freeze({
    entries: Object.freeze(entries),
    getAction,
    getDisplayGroups,
    isMacPlatform,
  });
})();

if (typeof window !== 'undefined') {
  window.ShortcutRegistry = ShortcutRegistry;
}
if (typeof globalThis !== 'undefined') {
  globalThis.ShortcutRegistry = ShortcutRegistry;
}
