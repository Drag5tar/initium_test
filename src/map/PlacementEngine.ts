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
    maxRowWidth: 200,
    startPosition: {
      x: 0,
      y: 0,
      z: 0,
    },
  };
  private firstObjectPosition: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  private lastObjectPosition: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  private middlePoint?: THREE.Vector3;
  private maximumCoordinate: THREE.Vector3 = new THREE.Vector3(0, 0, 0);

  constructor(options: PlacementEngineOptions) {
    this.options = options;
  }

  setFirstObjectPosition(x: number, y: number, z: number) {
    this.firstObjectPosition = new THREE.Vector3(x, y, z);
  }

  setLastObjectPosition(x: number, y: number, z: number) {
    this.lastObjectPosition = new THREE.Vector3(x, y, z);
    this.updateMaximumCoordinate(x, y, z);
  }

  updateMaximumCoordinate(x: number, y: number, z: number) {
    if (x > this.maximumCoordinate.x) this.maximumCoordinate.setX(x);
    if (y > this.maximumCoordinate.y) this.maximumCoordinate.setY(y);
    if (z > this.maximumCoordinate.z) this.maximumCoordinate.setZ(z);
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
      if (lastPosition === this.options.startPosition) {
        this.setFirstObjectPosition(xPos, yPos, zPos);
      }
      lastPosition = { x: xPos + shop.width / 2, y: 1, z: zPos };
      this.setLastObjectPosition(xPos, yPos, zPos);
      return new THREE.Vector3(xPos, yPos, zPos);
    };
  }

  public getFirstObjectPosition() {
    return this.firstObjectPosition;
  }

  public getLastObjectPosition() {
    return this.lastObjectPosition;
  }
  public getMaxPosition() {
    return this.maximumCoordinate;
  }

  public getMiddlePoint() {
    console.log(
      "gmp",
      this.firstObjectPosition,
      this.maximumCoordinate,
      this.middlePoint,
    );
    if (this.middlePoint) return this.middlePoint;
    if (!this.firstObjectPosition || !this.maximumCoordinate)
      return new THREE.Vector3(0, 0, 0);
    this.middlePoint = new THREE.Vector3().lerpVectors(
      this.firstObjectPosition,
      this.maximumCoordinate,
      0.5,
    );
    return this.middlePoint.clone();
  }
}
