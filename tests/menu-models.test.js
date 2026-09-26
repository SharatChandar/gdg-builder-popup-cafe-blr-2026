import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { menu } from "../server/domain.js";
import { buildMenuModel } from "../src/menu-models.js";

test("each menu item has a drawable illustrative model", () => {
  for (const product of menu) {
    const group = new THREE.Group();
    buildMenuModel(group, product.id);
    assert.ok(group.children.length > 2, `${product.name} has no model`);
    for (const part of group.children) {
      assert.ok(part.geometry, `${product.name} has a missing shape`);
      part.geometry.dispose();
      part.material.dispose();
    }
  }
});
