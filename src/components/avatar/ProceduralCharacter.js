"use client";

import * as THREE from "three";

/**
 * ProceduralCharacter - Premium 3D cartoon character with polished aesthetics
 * Matches reference image with smooth, round character design
 */

export class ProceduralCharacter {
  constructor(scene, config = {}) {
    this.scene = scene;
    this.config = {
      skinTone: config.skinTone || new THREE.Color(0xf4c4a0),
      hairColor: config.hairColor || new THREE.Color(0x1a1a1a),
      clothingColor: config.clothingColor || new THREE.Color(0x7ec97e),
      accentColor: config.accentColor || new THREE.Color(0xf580d0),
      eyeColor: config.eyeColor || new THREE.Color(0x3d3d5c),
      scale: config.scale || 1.5,
      ...config,
    };
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.materialCache = {};
    this.animationState = {
      emotion: "neutral",
      blinkProgress: 0,
      mouthOpenness: 0,
      headTilt: 0,
    };
  }

  createCharacter() {
    this.createHead();
    this.createBody();
    this.createArms();
    this.createHair();
    return this.group;
  }

  /**
   * PERFECT SMOOTH HEAD - Exactly like reference image
   */
  createHead() {
    const headGeometry = new THREE.SphereGeometry(0.95, 32, 32);
    const headMaterial = new THREE.MeshStandardMaterial({
      color: this.config.skinTone,
      roughness: 0.55,
      metalness: 0.0,
      envMapIntensity: 1.0,
    });

    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.y = 1.3;
    head.castShadow = true;
    head.receiveShadow = true;
    head.scale.set(1, 1, 1); // Perfect circle

    this.head = head;
    this.materialCache.headMaterial = headMaterial;
    this.group.add(head);

    this.createEyes(head.position);
    this.createNose(head.position);
    this.createMouth(head.position);
    this.createEars(head.position);
  }

  /**
   * LARGE EXPRESSIVE EYES - Like reference image with shine
   */
  createEyes(headPos) {
    const eyeGeometry = new THREE.SphereGeometry(0.28, 32, 32);
    const eyeMaterial = new THREE.MeshStandardMaterial({
      color: this.config.eyeColor,
      roughness: 0.2,
      metalness: 0.0,
      envMapIntensity: 1.2,
    });

    // Left eye
    const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    leftEye.position.set(-0.35, headPos.y + 0.2, 0.78);
    leftEye.castShadow = true;
    this.group.add(leftEye);

    // Right eye
    const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    rightEye.position.set(0.35, headPos.y + 0.2, 0.78);
    rightEye.castShadow = true;
    this.group.add(rightEye);

    // PERFECT HIGHLIGHTS - Large shiny spots
    const highlightGeometry = new THREE.SphereGeometry(0.11, 16, 16);
    const highlightMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
    });

    const leftHighlight = new THREE.Mesh(highlightGeometry, highlightMaterial);
    leftHighlight.position.set(-0.22, headPos.y + 0.3, 0.88);
    this.group.add(leftHighlight);

    const rightHighlight = new THREE.Mesh(highlightGeometry, highlightMaterial);
    rightHighlight.position.set(0.48, headPos.y + 0.3, 0.88);
    this.group.add(rightHighlight);

    // Eyebrows - subtle dark
    const browGeometry = new THREE.BoxGeometry(0.4, 0.1, 0.05);
    const browMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(this.config.hairColor).multiplyScalar(0.8),
      roughness: 0.7,
    });

    const leftBrow = new THREE.Mesh(browGeometry, browMaterial);
    leftBrow.position.set(-0.35, headPos.y + 0.6, 0.76);
    this.group.add(leftBrow);

    const rightBrow = new THREE.Mesh(browGeometry, browMaterial);
    rightBrow.position.set(0.35, headPos.y + 0.6, 0.76);
    this.group.add(rightBrow);

    this.eyes = { left: leftEye, right: rightEye };
  }

  /**
   * Small cute nose
   */
  createNose(headPos) {
    const noseGeometry = new THREE.SphereGeometry(0.1, 16, 16);
    const noseMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(this.config.skinTone).multiplyScalar(0.88),
      roughness: 0.65,
    });

    const nose = new THREE.Mesh(noseGeometry, noseMaterial);
    nose.position.set(0, headPos.y - 0.05, 0.82);
    this.group.add(nose);
  }

  /**
   * Cute smile mouth
   */
  createMouth(headPos) {
    this.mouthGroup = new THREE.Group();

    const mouthGeometry = new THREE.TorusGeometry(
      0.22,
      0.05,
      8,
      16,
      0,
      Math.PI,
    );
    const mouthMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xdb9595),
      roughness: 0.45,
    });

    const mouth = new THREE.Mesh(mouthGeometry, mouthMaterial);
    mouth.position.set(0, headPos.y - 0.35, 0.8);
    mouth.rotation.x = Math.PI;
    this.mouthGroup.add(mouth);

    this.mouth = mouth;
    this.group.add(this.mouthGroup);
  }

  /**
   * Cute rounded ears
   */
  createEars(headPos) {
    const earGeometry = new THREE.SphereGeometry(0.2, 16, 16);
    earGeometry.scale(0.9, 1.3, 0.6);

    const earMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(this.config.skinTone).multiplyScalar(1.18),
      roughness: 0.6,
    });

    const leftEar = new THREE.Mesh(earGeometry, earMaterial);
    leftEar.position.set(-1.0, headPos.y + 0.1, 0.2);
    leftEar.castShadow = true;
    this.group.add(leftEar);

    const rightEar = new THREE.Mesh(earGeometry, earMaterial);
    rightEar.position.set(1.0, headPos.y + 0.1, 0.2);
    rightEar.castShadow = true;
    this.group.add(rightEar);
  }

  /**
   * POLISHED HAIR - Smooth and shiny like reference
   */
  createHair() {
    const hairGroup = new THREE.Group();
    const hairMaterial = new THREE.MeshStandardMaterial({
      color: this.config.hairColor,
      roughness: 0.5,
      metalness: 0.0,
      envMapIntensity: 1.1,
    });
    this.materialCache.hairMaterial = hairMaterial;

    // Top hair - smooth pompadour
    const topHairGeometry = new THREE.SphereGeometry(1.0, 32, 24);
    topHairGeometry.scale(1.0, 1.6, 0.9);

    const topHair = new THREE.Mesh(topHairGeometry, hairMaterial);
    topHair.position.y = 2.05;
    topHair.position.z = 0.08;
    topHair.castShadow = true;
    topHair.receiveShadow = true;
    hairGroup.add(topHair);

    // Side hair - smooth spheres
    const sideHairGeometry = new THREE.SphereGeometry(0.32, 16, 16);

    const leftSideHair = new THREE.Mesh(sideHairGeometry, hairMaterial);
    leftSideHair.position.set(-0.9, 1.4, 0.4);
    leftSideHair.scale.set(1.2, 1.0, 0.7);
    leftSideHair.castShadow = true;
    hairGroup.add(leftSideHair);

    const rightSideHair = new THREE.Mesh(sideHairGeometry, hairMaterial);
    rightSideHair.position.set(0.9, 1.4, 0.4);
    rightSideHair.scale.set(1.2, 1.0, 0.7);
    rightSideHair.castShadow = true;
    hairGroup.add(rightSideHair);

    // Back hair
    const backHairGeometry = new THREE.SphereGeometry(0.65, 16, 16);
    const backHair = new THREE.Mesh(backHairGeometry, hairMaterial);
    backHair.position.set(0, 1.0, -0.35);
    backHair.scale.set(1.15, 0.9, 0.8);
    backHair.castShadow = true;
    hairGroup.add(backHair);

    this.group.add(hairGroup);
    this.hair = hairGroup;
  }

  /**
   * NICE BODY - Clean hoodie with accent stripe
   */
  createBody() {
    const torsoGeometry = new THREE.CapsuleGeometry(0.6, 1.0, 10, 16);
    const torsoMaterial = new THREE.MeshStandardMaterial({
      color: this.config.clothingColor,
      roughness: 0.55,
      metalness: 0.0,
    });

    const torso = new THREE.Mesh(torsoGeometry, torsoMaterial);
    torso.position.y = 0.2;
    torso.castShadow = true;
    torso.receiveShadow = true;
    this.group.add(torso);
    this.materialCache.torsoMaterial = torsoMaterial;

    // Accent stripe
    const stripeGeometry = new THREE.BoxGeometry(1.35, 0.2, 0.12);
    const stripeMaterial = new THREE.MeshStandardMaterial({
      color: this.config.accentColor,
      roughness: 0.4,
      metalness: 0.05,
    });

    const stripe = new THREE.Mesh(stripeGeometry, stripeMaterial);
    stripe.position.set(0, 0.5, 0.62);
    stripe.castShadow = true;
    this.group.add(stripe);
    this.materialCache.stripeMaterial = stripeMaterial;

    this.torso = torso;
  }

  /**
   * NICE ARMS - Proportional and smooth
   */
  createArms() {
    const armGeometry = new THREE.CapsuleGeometry(0.22, 0.85, 8, 12);
    const armMaterial = new THREE.MeshStandardMaterial({
      color: this.config.skinTone,
      roughness: 0.58,
      metalness: 0.0,
    });
    this.materialCache.armMaterial = armMaterial;

    // Left arm
    const leftArm = new THREE.Mesh(armGeometry, armMaterial);
    leftArm.position.set(-0.8, 0.6, 0);
    leftArm.rotation.z = Math.PI / 5;
    leftArm.castShadow = true;
    leftArm.receiveShadow = true;
    this.group.add(leftArm);

    // Right arm
    const rightArm = new THREE.Mesh(armGeometry, armMaterial);
    rightArm.position.set(0.8, 0.6, 0);
    rightArm.rotation.z = -Math.PI / 5;
    rightArm.castShadow = true;
    rightArm.receiveShadow = true;
    this.group.add(rightArm);

    // Hands - smooth spheres
    const handGeometry = new THREE.SphereGeometry(0.18, 16, 16);
    const handMaterial = new THREE.MeshStandardMaterial({
      color: this.config.skinTone,
      roughness: 0.6,
    });

    const leftHand = new THREE.Mesh(handGeometry, handMaterial);
    leftHand.position.set(-1.15, 0.1, 0.2);
    leftHand.castShadow = true;
    this.group.add(leftHand);

    const rightHand = new THREE.Mesh(handGeometry, handMaterial);
    rightHand.position.set(1.15, 0.1, 0.2);
    rightHand.castShadow = true;
    this.group.add(rightHand);

    this.arms = { left: leftArm, right: rightArm };
  }

  /**
   * Set emotion with intensity
   */
  setEmotion(emotion = "neutral", intensity = 0.7) {
    this.animationState.emotion = emotion;
    this.animationState.expressionIntensity = intensity;

    switch (emotion) {
      case "happy":
        this.showHappyExpression(intensity);
        break;
      case "sad":
        this.showSadExpression(intensity);
        break;
      case "surprised":
        this.showSurprisedExpression(intensity);
        break;
      case "anxious":
        this.showAnxiousExpression(intensity);
        break;
      case "calm":
        this.showCalmExpression(intensity);
        break;
      default:
        this.showNeutralExpression(intensity);
    }
  }

  showNeutralExpression(intensity = 0.7) {}

  showHappyExpression(intensity = 0.7) {
    if (this.head) {
      this.head.rotation.z = 0.05 * intensity;
    }
  }

  showSadExpression(intensity = 0.7) {
    if (this.head) {
      this.head.rotation.x = -0.08 * intensity;
    }
  }

  showSurprisedExpression(intensity = 0.7) {
    if (this.head) {
      this.head.scale.y = 1.05 * intensity;
    }
  }

  showAnxiousExpression(intensity = 0.7) {
    if (this.head) {
      this.head.position.y -= 0.02 * intensity;
    }
  }

  showCalmExpression(intensity = 0.7) {
    if (this.head) {
      this.head.rotation.z = -0.03 * intensity;
    }
  }

  /**
   * Idle animations - smooth head tilt
   */
  update(deltaTime = 0.016) {
    if (this.head) {
      const tilt = Math.sin(Date.now() * 0.0008) * 0.08;
      this.head.rotation.z = tilt;
    }
  }

  /**
   * Update all colors efficiently
   */
  updateColors(config) {
    if (config.skinTone) {
      this.config.skinTone = new THREE.Color(config.skinTone);
      if (this.materialCache.headMaterial) {
        this.materialCache.headMaterial.color.set(config.skinTone);
      }
      if (this.materialCache.armMaterial) {
        this.materialCache.armMaterial.color.set(config.skinTone);
      }
    }

    if (config.hairColor) {
      this.config.hairColor = new THREE.Color(config.hairColor);
      if (this.materialCache.hairMaterial) {
        this.materialCache.hairMaterial.color.set(config.hairColor);
      }
    }

    if (config.clothingColor) {
      this.config.clothingColor = new THREE.Color(config.clothingColor);
      if (this.materialCache.torsoMaterial) {
        this.materialCache.torsoMaterial.color.set(config.clothingColor);
      }
    }

    if (config.accentColor) {
      this.config.accentColor = new THREE.Color(config.accentColor);
      if (this.materialCache.stripeMaterial) {
        this.materialCache.stripeMaterial.color.set(config.accentColor);
      }
    }
  }

  getGroup() {
    return this.group;
  }
}
