/**
 * CharacterCreator
 * Applies morph overrides (bone scaling) to a VRM model.
 */

/**
 * Apply morph overrides to VRM bones for body-shape customization.
 * @param {Object} vrm - VRM instance
 * @param {Object} morphOverrides - e.g. { head: 1.1, torso: 0.95 }
 */
export function applyMorphsToVRM(vrm, morphOverrides) {
  if (!vrm || !morphOverrides) return;

  const boneMap = {
    head: "head",
    torso: "spine",
    chest: "chest",
    upperBody: "upperChest",
    leftArm: "leftUpperArm",
    rightArm: "rightUpperArm",
    leftLeg: "leftUpperLeg",
    rightLeg: "rightUpperLeg",
    hips: "hips",
  };

  for (const [key, scale] of Object.entries(morphOverrides)) {
    const boneName = boneMap[key] || key;
    try {
      const bone = vrm.humanoid?.getRawBoneNode(boneName);
      if (bone) {
        const s = typeof scale === "number" ? scale : 1;
        bone.scale.set(s, s, s);
      }
    } catch {
      // Bone not available
    }
  }
}
