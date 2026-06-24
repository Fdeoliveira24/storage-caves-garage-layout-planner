import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

let Composition;
let Config;
let FloorPlanManagerClass;
let StateClass;
let BoundsUtil;
let CanvasManagerClass;

beforeAll(async () => {
  globalThis.window = globalThis;
  globalThis.fabric = {
    Shadow: class Shadow {
      constructor(options) {
        Object.assign(this, options);
      }
    },
  };
  await import('../js/core/Config.js');
  globalThis.Config = globalThis.window.Config;
  Config = globalThis.window.Config;
  await import('../js/utils/floor-plan-composition.js');
  globalThis.FloorPlanComposition = globalThis.window.FloorPlanComposition;
  await import('../js/utils/validation.js');
  globalThis.Validation = globalThis.window.Validation;
  await import('../js/utils/helpers.js');
  globalThis.Helpers = globalThis.window.Helpers;
  await import('../js/utils/bounds.js');
  BoundsUtil = globalThis.window.Bounds;
  await import('../js/core/State.js');
  await import('../js/managers/FloorPlanManager.js');
  await import('../js/managers/CanvasManager.js');

  Composition = globalThis.window.FloorPlanComposition;
  FloorPlanManagerClass = globalThis.window.FloorPlanManager;
  StateClass = globalThis.window.State;
  CanvasManagerClass = globalThis.window.CanvasManager;
});

describe('per-unit bounds', () => {
  const objectAt = (left, top, width, height) => ({
    getBoundingRect: () => ({ left, top, width, height }),
  });
  const unit = { widthFt: 15, heightFt: 50 };
  const bounds = { left: 100, top: 50, width: 150, height: 500 };

  it('requires an item footprint to fit wholly inside one unit', () => {
    expect(BoundsUtil.isWithinBounds(objectAt(110, 60, 40, 80), unit, bounds)).toBe(true);
    expect(BoundsUtil.isWithinBounds(objectAt(230, 60, 40, 80), unit, bounds)).toBe(false);
    expect(BoundsUtil.isWithinBounds(objectAt(90, 60, 40, 80), unit, bounds)).toBe(false);
  });

  it('detects the bottom entry zone for the assigned unit only', () => {
    expect(BoundsUtil.isInEntryZone(objectAt(120, 490, 20, 20), unit, 'bottom', bounds)).toBe(
      false,
    );
    expect(BoundsUtil.isInEntryZone(objectAt(120, 540, 20, 20), unit, 'bottom', bounds)).toBe(true);
  });
});

describe('FloorPlanComposition', () => {
  it('bottom-aligns mixed-depth units and aggregates physical totals', () => {
    const plan = Composition.composeUnits([
      Composition.createUnit(Composition.getTemplate('fp-unit-a'), 'a-1'),
      Composition.createUnit(Composition.getTemplate('fp-unit-e'), 'e-1'),
    ]);

    expect(plan.kind).toBe('unit-combo');
    expect(plan.widthFt).toBe(36);
    expect(plan.heightFt).toBe(55);
    expect(plan.area).toBe(1700);
    expect(plan.units[0]).toMatchObject({ instanceId: 'a-1', offsetXFt: 0, offsetYFt: 0 });
    expect(plan.units[1]).toMatchObject({ instanceId: 'e-1', offsetXFt: 22, offsetYFt: 20 });
  });

  it('supports duplicate templates and caps a composition at MAX_FLOOR_PLAN_UNITS', () => {
    const cap = Config.MAX_FLOOR_PLAN_UNITS;
    let plan = null;
    for (let index = 0; index < cap + 1; index += 1) {
      plan = Composition.addUnit(plan, 'fp-unit-b');
    }

    expect(plan.units).toHaveLength(cap);
    expect(new Set(plan.units.map((unit) => unit.instanceId)).size).toBe(cap);
    expect(plan.widthFt).toBe(15 * cap);
    expect(plan.area).toBe(825 * cap);
  });

  it('normalizes a legacy single floor plan without losing its dimensions', () => {
    const legacy = {
      id: 'fp-unit-f',
      name: "Units F - 18'×50'",
      widthFt: 18,
      heightFt: 50,
      area: 900,
      doorWidth: 14,
      doorHeight: 14,
    };

    const normalized = Composition.normalizeFloorPlan(legacy);
    expect(normalized.units).toHaveLength(1);
    expect(normalized.id).toBe('fp-unit-f');
    expect(normalized.units[0]).toMatchObject({
      templateId: 'fp-unit-f',
      widthFt: 18,
      heightFt: 50,
      area: 900,
    });
  });

  it('normalizes legacy state during load without forcing combo entry zones', () => {
    const state = new StateClass();
    const combo = Composition.composeUnits([
      {
        ...Composition.createUnit(Composition.getTemplate('fp-unit-a'), 'a-1'),
        entryZonePosition: 'left',
      },
      Composition.createUnit(Composition.getTemplate('fp-unit-b'), 'b-1'),
    ]);
    state.loadState({ floorPlan: combo, settings: { entryZonePosition: 'left' } });

    expect(state.get('floorPlan.kind')).toBe('unit-combo');
    expect(state.get('floorPlan.units')).toHaveLength(2);
    expect(state.get('floorPlan.units.0.entryZonePosition')).toBe('left');
    expect(state.get('settings.entryZonePosition')).toBe('left');
  });

  it('reorders and removes instances without changing their identities', () => {
    const initial = Composition.composeUnits([
      Composition.createUnit(Composition.getTemplate('fp-unit-a'), 'a-1'),
      Composition.createUnit(Composition.getTemplate('fp-unit-b'), 'b-1'),
      Composition.createUnit(Composition.getTemplate('fp-unit-c'), 'c-1'),
    ]);
    const reordered = Composition.reorderUnit(initial, 'c-1', 0);
    const removed = Composition.removeUnit(reordered, 'b-1');

    expect(reordered.units.map((unit) => unit.instanceId)).toEqual(['c-1', 'a-1', 'b-1']);
    expect(removed.units.map((unit) => unit.instanceId)).toEqual(['c-1', 'a-1']);
  });
});

describe('FloorPlanManager composite operations', () => {
  let state;
  let canvas;
  let eventBus;
  let manager;

  beforeEach(() => {
    state = new StateClass();
    let bounds = {};
    canvas = {
      floorPlanPosition: null,
      floorPlanLocked: false,
      getUnitBoundsMap: vi.fn(() => bounds),
      captureItemUnitAssignments: vi.fn(),
      resetViewport: vi.fn(),
      drawFloorPlan: vi.fn((plan) => {
        bounds = Object.fromEntries(
          plan.units.map((unit) => [
            unit.instanceId,
            {
              left: unit.offsetXFt * 10,
              top: unit.offsetYFt * 10,
              width: unit.widthFt * 10,
              height: unit.heightFt * 10,
            },
          ]),
        );
      }),
      reflowItemsForUnitChanges: vi.fn(),
      getFloorPlanPosition: vi.fn(() => ({ left: 200, top: 200 })),
      getFloorPlanBounds: vi.fn(() => ({ left: 0, top: 0, width: 370, height: 550 })),
      getUnitBounds: vi.fn((instanceId) => bounds[instanceId] || null),
      clear: vi.fn(),
    };
    eventBus = { emit: vi.fn() };
    manager = new FloorPlanManagerClass(state, eventBus, canvas);
  });

  it('builds an instant mixed combo without changing the default entry edge', () => {
    state.set('settings.entryZonePosition', 'left');
    expect(manager.addFloorPlan('fp-unit-a')).toBe(true);
    expect(manager.addFloorPlan('fp-unit-e')).toBe(true);

    expect(manager.getUnits()).toHaveLength(2);
    expect(state.get('settings.entryZonePosition')).toBe('left');
    expect(manager.getArea()).toBe(1700);
    expect(eventBus.emit).toHaveBeenLastCalledWith(
      'floorplan:changed',
      expect.objectContaining({ kind: 'unit-combo' }),
    );
  });

  it('updates the entry edge for a selected unit without changing the others', () => {
    state.set('settings.entryZonePosition', 'left');
    expect(manager.addFloorPlan('fp-unit-a')).toBe(true);
    expect(manager.addFloorPlan('fp-unit-e')).toBe(true);

    const [firstUnit, secondUnit] = manager.getUnits();
    expect(manager.setUnitEntryZonePosition(secondUnit.instanceId, 'right')).toBe(true);

    const units = manager.getUnits();
    expect(units.find((unit) => unit.instanceId === firstUnit.instanceId).entryZonePosition).toBe(
      undefined,
    );
    expect(units.find((unit) => unit.instanceId === secondUnit.instanceId).entryZonePosition).toBe(
      'right',
    );
    expect(state.get('settings.entryZonePosition')).toBe('left');
    expect(canvas.drawFloorPlan).toHaveBeenLastCalledWith(
      expect.objectContaining({ kind: 'unit-combo' }),
      expect.objectContaining({ preserveViewport: true, suppressStateEvent: true }),
    );
  });

  it('enforces the MAX_FLOOR_PLAN_UNITS limit and clears the canvas when the last unit is removed', () => {
    const cap = Config.MAX_FLOOR_PLAN_UNITS;
    for (let index = 0; index < cap; index += 1) manager.addFloorPlan('fp-unit-b');
    expect(manager.addFloorPlan('fp-unit-c')).toBe(false);
    expect(manager.getUnits()).toHaveLength(cap);

    const ids = manager.getUnits().map((unit) => unit.instanceId);
    // Remove down to the last remaining unit...
    for (let index = cap - 1; index > 0; index -= 1) {
      expect(manager.removeFloorPlan(ids[index])).toBe(true);
    }
    // ...and removing that final one should succeed too, clearing the
    // floor plan entirely rather than refusing.
    expect(manager.removeFloorPlan(ids[0])).toBe(true);
    expect(state.get('floorPlan')).toBeNull();
    expect(canvas.clear).toHaveBeenCalled();
  });

  it('moves retained-unit items through the canvas reflow contract', () => {
    manager.addFloorPlan('fp-unit-a');
    manager.addFloorPlan('fp-unit-b');
    const secondId = manager.getUnits()[1].instanceId;
    expect(manager.reorderFloorPlan(secondId, 0)).toBe(true);

    expect(canvas.captureItemUnitAssignments).toHaveBeenCalled();
    expect(canvas.reflowItemsForUnitChanges).toHaveBeenCalled();
  });

  it('removes multiple selected unit instances in one composition update', () => {
    manager.addFloorPlan('fp-unit-a');
    manager.addFloorPlan('fp-unit-b');
    manager.addFloorPlan('fp-unit-c');
    const ids = manager.getUnits().map((unit) => unit.instanceId);
    eventBus.emit.mockClear();
    canvas.reflowItemsForUnitChanges.mockClear();

    expect(manager.removeFloorPlans([ids[0], ids[2]])).toBe(true);
    expect(manager.getUnits().map((unit) => unit.instanceId)).toEqual([ids[1]]);
    expect(canvas.reflowItemsForUnitChanges).toHaveBeenCalledTimes(1);
    expect(canvas.reflowItemsForUnitChanges.mock.calls[0][2]).toEqual([ids[0], ids[2]]);
    expect(eventBus.emit).toHaveBeenCalledTimes(1);
    expect(eventBus.emit).toHaveBeenCalledWith(
      'floorplan:changed',
      expect.objectContaining({ units: [expect.objectContaining({ instanceId: ids[1] })] }),
    );
  });

  it('calculates occupancy from assigned items only', () => {
    manager.addFloorPlan('fp-unit-e');
    state.set('items', [
      { lengthFt: 10, widthFt: 10, unitInstanceId: manager.getUnits()[0].instanceId },
      { lengthFt: 10, widthFt: 10, unitInstanceId: null },
    ]);

    expect(manager.getOccupiedArea()).toBe(100);
    expect(manager.getOccupancyPercentage()).toBeCloseTo((100 / 490) * 100);
  });
});

describe('CanvasManager item reflow', () => {
  const makeUnitGroup = (instanceId, left = 0, top = 0) => ({
    left,
    top,
    customData: { isFloorPlan: true, isFloorPlanUnit: true, unitInstanceId: instanceId },
    set(values) {
      Object.assign(this, values);
    },
    setCoords() {},
    moveTo() {},
  });

  const attachFloorRect = (group, width, height, offsetX = 0, offsetY = 0) => {
    group.floorPlanRect = {
      width,
      height,
      calcTransformMatrix: () => [1, 0, 0, 1, group.left + offsetX, group.top + offsetY],
    };
    return group;
  };

  it('keeps a homogeneous multi-selection of floor-plan units for batch deletion', () => {
    const state = new StateClass();
    const manager = new CanvasManagerClass('canvas', state, { emit: vi.fn() });
    const unitA = makeUnitGroup('a-1');
    const unitB = makeUnitGroup('b-1');
    const activeSelection = {
      type: 'activeSelection',
      getObjects: () => [unitA, unitB],
      set(values) {
        Object.assign(this, values);
      },
    };
    manager.canvas = {
      getActiveObject: () => activeSelection,
      requestRenderAll: vi.fn(),
    };

    expect(manager._normalizeSelection()).toEqual([unitA, unitB]);
    expect(manager.getSelectedFloorPlanUnitIds()).toEqual(['a-1', 'b-1']);
    expect(activeSelection.lockMovementX).toBe(true);
    expect(activeSelection.lockMovementY).toBe(true);
    expect(activeSelection.hasControls).toBe(false);
  });

  it('starts units separated and snaps nearby edges flush', () => {
    const state = new StateClass();
    const plan = Composition.composeUnits([
      Composition.createUnit(Composition.getTemplate('fp-unit-a'), 'a-1'),
      Composition.createUnit(Composition.getTemplate('fp-unit-e'), 'e-1'),
    ]);
    state.set('floorPlan', plan);
    const manager = new CanvasManagerClass('canvas', state, { emit: vi.fn() });
    const unitA = makeUnitGroup('a-1');
    const unitE = makeUnitGroup('e-1');
    manager.floorPlanUnitGroups = new Map([
      ['a-1', unitA],
      ['e-1', unitE],
    ]);
    manager.canvas = {
      getCenter: () => ({ left: 400, top: 300 }),
      renderAll: vi.fn(),
    };

    manager._positionFloorPlanGroup();
    let boundsA = manager.getUnitBounds('a-1');
    let boundsE = manager.getUnitBounds('e-1');
    expect(boundsE.left - (boundsA.left + boundsA.width)).toBe(20);
    expect(boundsE.top + boundsE.height).toBe(boundsA.top + boundsA.height);

    unitE.set({
      left: boundsA.left + boundsA.width + 5 + boundsE.width / 2,
      top: boundsA.top + boundsA.height + 5 - boundsE.height / 2,
    });
    manager._snapUnitToNeighbors(unitE);
    manager._updateFloorPlanBounds();
    boundsA = manager.getUnitBounds('a-1');
    boundsE = manager.getUnitBounds('e-1');
    expect(boundsE.left - (boundsA.left + boundsA.width)).toBe(0);
    expect(boundsE.top + boundsE.height).toBe(boundsA.top + boundsA.height);
  });

  it('snaps the actual floor rectangles when group decorations offset their centers', () => {
    const state = new StateClass();
    state.set(
      'floorPlan',
      Composition.composeUnits([
        Composition.createUnit(Composition.getTemplate('fp-unit-a'), 'a-1'),
        Composition.createUnit(Composition.getTemplate('fp-unit-e'), 'e-1'),
      ]),
    );
    const manager = new CanvasManagerClass('canvas', state, { emit: vi.fn() });
    const unitA = attachFloorRect(makeUnitGroup('a-1', 0, 0), 220, 550, 3, -4);
    const unitE = attachFloorRect(makeUnitGroup('e-1', 191, 98), 140, 350, -2, 5);
    manager.floorPlanUnitGroups = new Map([
      ['a-1', unitA],
      ['e-1', unitE],
    ]);
    manager.canvas = { getZoom: () => 1 };

    expect(manager._snapUnitToNeighbors(unitE)).toBe(true);
    const boundsA = manager._getUnitBoundsForGroup(unitA);
    const boundsE = manager._getUnitBoundsForGroup(unitE);
    expect(boundsE.left).toBeCloseTo(boundsA.right);
    expect(boundsE.bottom).toBeCloseTo(boundsA.bottom);
  });

  it('catches an edge crossed between drag events instead of leaving an overlap', () => {
    const state = new StateClass();
    state.set(
      'floorPlan',
      Composition.composeUnits([
        Composition.createUnit(Composition.getTemplate('fp-unit-a'), 'a-1'),
        Composition.createUnit(Composition.getTemplate('fp-unit-e'), 'e-1'),
      ]),
    );
    const manager = new CanvasManagerClass('canvas', state, { emit: vi.fn() });
    const unitA = makeUnitGroup('a-1', 0, 0);
    const unitE = makeUnitGroup('e-1', 160, 0);
    unitE._lastUnitPosition = { left: 200, top: 0 };
    manager.floorPlanUnitGroups = new Map([
      ['a-1', unitA],
      ['e-1', unitE],
    ]);
    manager.canvas = { getZoom: () => 1 };

    expect(manager._snapUnitToNeighbors(unitE)).toBe(true);
    const boundsA = manager._getUnitBoundsForGroup(unitA);
    const boundsE = manager._getUnitBoundsForGroup(unitE);
    expect(boundsE.left).toBe(boundsA.right);
  });

  it('does not snap parallel edges when the units are far apart on the other axis', () => {
    const state = new StateClass();
    state.set(
      'floorPlan',
      Composition.composeUnits([
        Composition.createUnit(Composition.getTemplate('fp-unit-a'), 'a-1'),
        Composition.createUnit(Composition.getTemplate('fp-unit-e'), 'e-1'),
      ]),
    );
    const manager = new CanvasManagerClass('canvas', state, { emit: vi.fn() });
    const unitA = makeUnitGroup('a-1', 0, 0);
    const unitE = makeUnitGroup('e-1', 185, 1000);
    manager.floorPlanUnitGroups = new Map([
      ['a-1', unitA],
      ['e-1', unitE],
    ]);
    manager.canvas = { getZoom: () => 1 };

    expect(manager._snapUnitToNeighbors(unitE)).toBe(false);
    expect(unitE.left).toBe(185);
    expect(unitE.top).toBe(1000);
  });

  it('moves retained-unit items and leaves removed-unit items at their canvas coordinates', () => {
    const state = new StateClass();
    const initial = Composition.composeUnits([
      Composition.createUnit(Composition.getTemplate('fp-unit-a'), 'a-1'),
      Composition.createUnit(Composition.getTemplate('fp-unit-b'), 'b-1'),
    ]);
    const remaining = Composition.composeUnits([initial.units[0]]);
    state.set('floorPlan', remaining);

    const makeObject = (left, top, width, height, instanceId) => ({
      left,
      top,
      width,
      height,
      customData: { id: instanceId, unitInstanceId: instanceId },
      set(values) {
        Object.assign(this, values);
      },
      setCoords() {},
      getBoundingRect() {
        return {
          left: this.left - this.width / 2,
          top: this.top - this.height / 2,
          width: this.width,
          height: this.height,
        };
      },
    });

    const retainedObject = makeObject(100, 100, 20, 20, 'a-1');
    const removedObject = makeObject(300, 100, 20, 20, 'b-1');
    const items = [
      { id: 'item-a', x: 100, y: 100, unitInstanceId: 'a-1', canvasObject: retainedObject },
      { id: 'item-b', x: 300, y: 100, unitInstanceId: 'b-1', canvasObject: removedObject },
    ];
    state.set('items', items);

    const manager = new CanvasManagerClass('canvas', state, { emit: vi.fn() });
    manager.canvas = {
      requestRenderAll: vi.fn(),
      getObjects: () => [retainedObject, removedObject],
    };
    manager.unitBounds = {
      'a-1': { left: 50, top: 50, width: 220, height: 550 },
    };

    manager.reflowItemsForUnitChanges(
      {
        'a-1': { left: 0, top: 0, width: 220, height: 550 },
        'b-1': { left: 220, top: 0, width: 150, height: 550 },
      },
      manager.unitBounds,
      ['b-1'],
    );

    expect(retainedObject.left).toBe(150);
    expect(items[0].x).toBe(150);
    expect(removedObject.left).toBe(300);
    expect(items[1].unitInstanceId).toBeNull();
  });
});
