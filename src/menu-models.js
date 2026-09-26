import * as THREE from "three";

// Small, original illustrations for the sample menu. Units are scaled to roughly
// tabletop size when a model is placed in AR.
export function buildMenuModel(group, productId) {
  const material = (color, options = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.55, ...options });
  const add = (geometry, surface, x = 0, y = 0, z = 0) => {
    const object = new THREE.Mesh(geometry, surface);
    object.position.set(x, y, z);
    group.add(object);
    return object;
  };
  const cylinder = (top, bottom, height, surface, x = 0, y = 0, z = 0) =>
    add(new THREE.CylinderGeometry(top, bottom, height, 48), surface, x, y, z);
  const sphere = (radius, surface, x, y, z, sx = 1, sy = 1, sz = 1) => {
    const object = add(
      new THREE.SphereGeometry(radius, 24, 16),
      surface,
      x,
      y,
      z,
    );
    object.scale.set(sx, sy, sz);
    return object;
  };
  const ceramic = material(0xf4ead8);
  const plate = () => {
    cylinder(1.18, 1.08, 0.08, ceramic, 0, 0.06);
    const rim = add(
      new THREE.TorusGeometry(0.96, 0.025, 10, 48),
      ceramic,
      0,
      0.11,
    );
    rim.rotation.x = Math.PI / 2;
  };

  if (["croissant", "almond-croissant"].includes(productId)) {
    plate();
    const pastry = material(productId === "croissant" ? 0xc88742 : 0xa9753f);
    for (let i = -2; i <= 2; i++) {
      const part = sphere(
        0.35,
        pastry,
        i * 0.24,
        0.42 + Math.abs(i) * 0.03,
        -0.06 + Math.abs(i) * 0.1,
        1 - Math.abs(i) * 0.13,
        0.7,
        0.67,
      );
      part.rotation.y = i * 0.16;
    }
    if (productId === "almond-croissant") {
      const almond = material(0xf1d7a5);
      for (let i = 0; i < 9; i++)
        sphere(
          0.08,
          almond,
          -0.65 + i * 0.16,
          0.65,
          0.02 + (i % 3) * 0.09,
          1.2,
          0.25,
          0.48,
        );
    }
    return;
  }

  if (["avocado-toast", "breakfast-toast"].includes(productId)) {
    plate();
    const crust = material(0x9b6336);
    const bread = material(0xe5bd7d);
    const base = add(new THREE.BoxGeometry(1.45, 0.18, 1.0), crust, 0, 0.28);
    base.rotation.y = -0.13;
    const crumb = add(new THREE.BoxGeometry(1.32, 0.04, 0.88), bread, 0, 0.39);
    crumb.rotation.y = -0.13;
    if (productId === "avocado-toast") {
      const avocado = material(0x80a44d);
      const leaf = material(0x477342);
      for (let i = 0; i < 6; i++)
        sphere(
          0.25,
          avocado,
          -0.45 + (i % 3) * 0.42,
          0.48,
          -0.23 + Math.floor(i / 3) * 0.39,
          0.85,
          0.23,
          0.85,
        );
      for (let i = 0; i < 8; i++)
        sphere(
          0.025,
          leaf,
          -0.55 + (i % 4) * 0.33,
          0.55,
          -0.2 + Math.floor(i / 4) * 0.4,
        );
    } else {
      const egg = material(0xf7efd8);
      const yolk = material(0xe2a93c);
      for (const x of [-0.3, 0.3]) {
        sphere(0.4, egg, x, 0.49, 0, 1, 0.16, 0.72);
        sphere(0.16, yolk, x + 0.06, 0.58, 0.02, 1, 0.4, 1);
      }
    }
    return;
  }

  const iced = ["iced-latte", "cold-brew"].includes(productId);
  if (iced) {
    const glass = material(0xd7e6e1, {
      transparent: true,
      opacity: 0.27,
      roughness: 0.12,
      depthWrite: false,
    });
    const drink = material(productId === "cold-brew" ? 0x3d241a : 0xb78052);
    cylinder(0.57, 0.43, 1.55, glass, 0, 0.82);
    cylinder(0.47, 0.39, 1.15, drink, 0, 0.68);
    const rim = add(
      new THREE.TorusGeometry(0.57, 0.025, 10, 48),
      glass,
      0,
      1.6,
    );
    rim.rotation.x = Math.PI / 2;
    const ice = material(0xe8f0e8, { transparent: true, opacity: 0.75 });
    for (let i = 0; i < 4; i++) {
      const cube = add(
        new THREE.BoxGeometry(0.25, 0.22, 0.23),
        ice,
        (i % 2 ? 1 : -1) * 0.21,
        1.07 + i * 0.11,
        (i < 2 ? 1 : -1) * 0.17,
      );
      cube.rotation.set(0.15, i * 0.4, 0.2);
    }
    const straw = cylinder(
      0.025,
      0.025,
      1.55,
      material(0x315d49),
      0.23,
      1.44,
      0.03,
    );
    straw.rotation.z = -0.15;
  } else {
    const colors = {
      "flat-white": 0x8d5937,
      cappuccino: 0xc99d66,
      matcha: 0x77964c,
      tea: 0x8b5e3b,
    };
    const drink = material(colors[productId] || 0x8d5937);
    cylinder(0.76, 0.55, 0.86, ceramic, 0, 0.53);
    cylinder(0.73, 0.73, 0.025, drink, 0, 0.975);
    const rim = add(
      new THREE.TorusGeometry(0.76, 0.04, 12, 48),
      ceramic,
      0,
      0.99,
    );
    rim.rotation.x = Math.PI / 2;
    const handle = add(
      new THREE.TorusGeometry(0.28, 0.08, 12, 40, Math.PI * 1.7),
      ceramic,
      0.81,
      0.52,
    );
    handle.rotation.z = -Math.PI * 0.83;
    plate();
    if (
      productId === "flat-white" ||
      productId === "cappuccino" ||
      productId === "matcha"
    ) {
      const foam = material(productId === "matcha" ? 0xc9d6a5 : 0xf1dfbd);
      for (let i = 0; i < 5; i++) {
        const ring = add(
          new THREE.TorusGeometry(0.13 + i * 0.1, 0.015, 8, 40),
          foam,
          0,
          0.992,
        );
        ring.rotation.x = Math.PI / 2;
        ring.scale.x = 0.72;
      }
    }
  }
}
