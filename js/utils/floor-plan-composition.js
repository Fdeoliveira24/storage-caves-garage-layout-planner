/* global Config */

/**
 * Pure helpers for normalizing and composing adjacent garage units.
 * The browser app uses a single composite shape even when only one unit is active.
 */
const FloorPlanComposition = (() => {
  let instanceCounter = 0;

  function generateInstanceId(templateId = 'unit') {
    instanceCounter += 1;
    return `${templateId}-instance-${Date.now().toString(36)}-${instanceCounter}`;
  }

  function getTemplates() {
    return (typeof Config !== 'undefined' && Config.FLOOR_PLANS) || [];
  }

  function getTemplate(templateId) {
    return getTemplates().find((template) => template.id === templateId) || null;
  }

  function getShortName(plan) {
    if (!plan) return 'Unit';
    if (plan.shortName) return plan.shortName;
    const name = plan.name || plan.label || plan.id || 'Unit';
    return String(name).split(' - ')[0];
  }

  function createUnit(plan, instanceId) {
    if (!plan) return null;
    const templateId = plan.templateId || plan.id;
    const template = getTemplate(templateId) || {
      name: '',
      shortName: '',
      description: '',
    };
    const source = { ...template, ...plan };
    const widthFt = Number(source.widthFt);
    const heightFt = Number(source.heightFt);
    if (!Number.isFinite(widthFt) || widthFt <= 0 || !Number.isFinite(heightFt) || heightFt <= 0) {
      return null;
    }

    return {
      instanceId: instanceId || source.instanceId || generateInstanceId(templateId),
      templateId,
      name: source.name || template.name || templateId,
      shortName: getShortName(source),
      widthFt,
      heightFt,
      area: Number(source.area) || widthFt * heightFt,
      description: source.description || '',
      doorWidth: Number(source.doorWidth ?? source.doorWidthFt) || null,
      doorHeight: Number(source.doorHeight ?? source.doorHeightFt) || null,
      offsetXFt: Number(source.offsetXFt) || 0,
      offsetYFt: Number(source.offsetYFt) || 0,
    };
  }

  function composeUnits(inputUnits, options = {}) {
    const maxUnits = Number(options.maxUnits) || Config?.MAX_FLOOR_PLAN_UNITS || 4;
    const units = (Array.isArray(inputUnits) ? inputUnits : [])
      .slice(0, maxUnits)
      .map((unit) => createUnit(unit, unit?.instanceId))
      .filter(Boolean);

    if (!units.length) return null;

    const heightFt = Math.max(...units.map((unit) => unit.heightFt));
    let offsetXFt = 0;
    const positionedUnits = units.map((unit) => {
      const positioned = {
        ...unit,
        offsetXFt,
        offsetYFt: heightFt - unit.heightFt,
      };
      offsetXFt += unit.widthFt;
      return positioned;
    });

    const area = positionedUnits.reduce((sum, unit) => sum + unit.area, 0);
    const name = positionedUnits.map((unit) => unit.shortName).join(' + ');
    const single = positionedUnits.length === 1;

    return {
      kind: 'unit-combo',
      id: single
        ? positionedUnits[0].templateId
        : `combo-${positionedUnits.map((unit) => unit.instanceId).join('-')}`,
      name,
      description: single
        ? positionedUnits[0].description
        : `${positionedUnits.length} adjacent units`,
      widthFt: offsetXFt,
      heightFt,
      area,
      doorWidth: single ? positionedUnits[0].doorWidth : null,
      doorHeight: single ? positionedUnits[0].doorHeight : null,
      units: positionedUnits,
    };
  }

  function normalizeFloorPlan(floorPlan) {
    if (!floorPlan) return null;
    if (floorPlan.kind === 'unit-combo' && Array.isArray(floorPlan.units)) {
      return composeUnits(floorPlan.units);
    }

    const legacyUnit = createUnit(
      {
        ...floorPlan,
        templateId: floorPlan.templateId || floorPlan.id,
      },
      floorPlan.instanceId || `legacy-${floorPlan.id || 'unit'}-1`,
    );
    return legacyUnit ? composeUnits([legacyUnit]) : null;
  }

  function addUnit(floorPlan, templateId) {
    const current = normalizeFloorPlan(floorPlan);
    const template = getTemplate(templateId);
    if (!template) return current;
    const units = current?.units ? [...current.units] : [];
    if (units.length >= (Config?.MAX_FLOOR_PLAN_UNITS || 4)) return current;
    units.push(createUnit(template));
    return composeUnits(units);
  }

  function removeUnit(floorPlan, instanceId) {
    const current = normalizeFloorPlan(floorPlan);
    if (!current || current.units.length <= 1) return current;
    return composeUnits(current.units.filter((unit) => unit.instanceId !== instanceId));
  }

  function reorderUnit(floorPlan, instanceId, targetIndex) {
    const current = normalizeFloorPlan(floorPlan);
    if (!current) return null;
    const units = [...current.units];
    const currentIndex = units.findIndex((unit) => unit.instanceId === instanceId);
    if (currentIndex < 0) return current;
    const clampedIndex = Math.max(0, Math.min(units.length - 1, Number(targetIndex)));
    if (currentIndex === clampedIndex) return current;
    const [unit] = units.splice(currentIndex, 1);
    units.splice(clampedIndex, 0, unit);
    return composeUnits(units);
  }

  return {
    addUnit,
    composeUnits,
    createUnit,
    generateInstanceId,
    getShortName,
    getTemplate,
    normalizeFloorPlan,
    removeUnit,
    reorderUnit,
  };
})();

if (typeof window !== 'undefined') {
  window.FloorPlanComposition = FloorPlanComposition;
}
