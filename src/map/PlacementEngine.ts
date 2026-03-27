import * as THREE from "three";
import type { Shop } from "../lib/types";

export type PlacementEngineOptions = {
  gutter: number;
  maxRowWidth: number;
  startPosition: { x: number; y: number; z: number };
};

export class PlacementEngine {
  options: PlacementEngineOptions = {
    gutter: 1,
    maxRowWidth: 100,
    startPosition: {
      x: 0,
      y: 0,
      z: 0,
    },
  };

  constructor(options: PlacementEngineOptions) {
    this.options = options;
  }

  public setMaxRowWidth(width: number) {
    this.options.maxRowWidth = width;
  }

  public linePacking() {
    let lastPosition = this.options.startPosition;
    let maxRowDepth = 0;

    return (shop: Shop): THREE.Vector3 => {
      let xPos = lastPosition.x + this.options.gutter + shop.width / 2;
      let zPos = lastPosition.z;
      if (xPos + shop.width / 2 > this.options.maxRowWidth) {
        xPos =
          this.options.startPosition.x + this.options.gutter + shop.width / 2;
        zPos = lastPosition.z + maxRowDepth + this.options.gutter;
      }
      const yPos = shop.height / 2;
      if (maxRowDepth < shop.depth) maxRowDepth = shop.depth;
      lastPosition = { x: xPos + shop.width / 2, y: 1, z: zPos };
      return new THREE.Vector3(xPos, yPos, zPos);
    };
  }
}
