import logger from "../logger.js";

/**
 * If a custom AA condition animation exists for the specified name, registers the appropriate hook with AA
 * to be able to replace the default condition animation by the custom one.
 *
 * @param {*} condition condition for which to replace its AA animation by a custom one (it must be a value from CONFIG.DND5E.conditionTypes).
 * @param {*} macroData the midi-qol macro data.
 * @param {*} originItemName the name of item used for AA customization of the condition.
 * @param {*} conditionItemUuid the UUID of the item applying the condition.
 */
export function configureCustomAAForCondition(condition, macroData, originItemName, conditionItemUuid) {
  // Get default condition label
  const statusName = CONFIG.DND5E.conditionTypes[condition];
  const customStatusName = `${statusName} [${originItemName}]`;
  if (AutomatedAnimations.AutorecManager.getAutorecEntries().aefx.find((a) => a.label === customStatusName)) {
    const aaHookId = Hooks.on("AutomatedAnimations-WorkflowStart", (data) => {
      if (
        data.item instanceof CONFIG.ActiveEffect.documentClass
        && data.item.label === statusName
        && data.item.origin === macroData.sourceItemUuid
      ) {
        data.recheckAnimation = true;
        data.item.label = customStatusName;
        Hooks.off("AutomatedAnimations-WorkflowStart", aaHookId);
      }
    });
    // Make sure that the hook is removed when the special spell effect is completed
    Hooks.once(`midi-qol.RollComplete.${conditionItemUuid}`, () => {
      Hooks.off("AutomatedAnimations-WorkflowStart", aaHookId);
    });
  }
}

/**
 * Adds a save advantage effect for the next save on the specified target actor.
 *
 * @param {*} targetActor the target actor on which to add the effect.
 * @param {*} originItem the item that is the origin of the effect.
 * @param {*} ability the short ability name to use for save, e.g. str
 */
export async function addSaveAdvantageToTarget(targetActor, originItem, ability, additionLabel = "", icon = null) {
  const effectData = {
    _id: randomID(),
    changes: [
      {
        key: `flags.midi-qol.advantage.ability.save.${ability}`,
        mode: CONST.ACTIVE_EFFECT_MODES.CUSTOM,
        value: "1",
        priority: 20,
      },
    ],
    origin: originItem.uuid,
    disabled: false,
    transfer: false,
    icon,
    label: `${originItem.name}${additionLabel}: Save Advantage Large Creature`,
    duration: { turns: 1 },
    flags: {
      dae: {
        specialDuration: [`isSave.${ability}`],
      },
    },
  };
  await MidiQOL.socket().executeAsGM("createEffects", { actorUuid: targetActor.uuid, effects: [effectData] });
}

/**
 * Returns ids of tokens in template
 *
 * @param {*} templateDoc the templatedoc to check
 */
export function findContainedTokensInTemplate(templateDoc) {
  const contained = new Set();
  for (const tokenDoc of templateDoc.parent.tokens) {
    const startX = tokenDoc.width >= 1 ? 0.5 : tokenDoc.width / 2;
    const startY = tokenDoc.height >= 1 ? 0.5 : tokenDoc.height / 2;
    for (let x = startX; x < tokenDoc.width; x++) {
      for (let y = startY; y < tokenDoc.width; y++) {
        const curr = {
          x: tokenDoc.x + (x * templateDoc.parent.grid.size) - templateDoc.x,
          y: tokenDoc.y + (y * templateDoc.parent.grid.size) - templateDoc.y,
        };
        const contains = templateDoc.object.shape.contains(curr.x, curr.y);
        if (contains) contained.add(tokenDoc.id);
      }
    }
  }
  return [...contained];
}

export async function checkTargetInRange({ sourceUuid, targetUuid, distance }) {
  if (!game.modules.get("midi-qol")?.active) {
    ui.notifications.error("checkTargetInRange requires midiQoL, not checking");
    logger.error("checkTargetInRange requires midiQoL, not checking");
    return true;
  }
  const sourceToken = await fromUuid(sourceUuid);
  if (!sourceToken) return false;
  const targetsInRange = MidiQOL.findNearby(null, sourceUuid, distance);
  const isInRange = targetsInRange.reduce((result, possible) => {
    const collisionRay = new Ray(sourceToken, possible);
    const collision = canvas.walls.checkCollision(collisionRay, { mode: "any", type: "sight" });
    if (possible.uuid === targetUuid && !collision) result = true;
    return result;
  }, false);
  return isInRange;
}