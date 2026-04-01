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
  private middlePoint?: THREE.Vector3;
  private contentBounds: THREE.Box3 = new THREE.Box3();
  private contentCenter: THREE.Vector3 = new THREE.Vector3();
  private contentSize: THREE.Vector3 = new THREE.Vector3();
  private boundsMin: THREE.Vector3 = new THREE.Vector3(
    Infinity,
    Infinity,
    Infinity,
  );
  private boundsMax: THREE.Vector3 = new THREE.Vector3(
    -Infinity,
    -Infinity,
    -Infinity,
  );
  private hasBounds: boolean = false;

  constructor(options: PlacementEngineOptions) {
    this.options = options;
  }

  public setMaxRowWidth(width: number) {
    this.options.maxRowWidth = width;
  }

  private resetDerivedState() {
    this.middlePoint = undefined;

    this.boundsMin.set(Infinity, Infinity, Infinity);
    this.boundsMax.set(-Infinity, -Infinity, -Infinity);
    this.contentBounds.makeEmpty();
    this.contentCenter.set(0, 0, 0);
    this.contentSize.set(0, 0, 0);
    this.hasBounds = false;
  }

  private updateBounds(shop: Shop, position: THREE.Vector3) {
    const halfW = shop.width / 2;
    const halfH = shop.height / 2;
    const halfD = shop.depth / 2;

    this.boundsMin.set(
      Math.min(this.boundsMin.x, position.x - halfW),
      Math.min(this.boundsMin.y, position.y - halfH),
      Math.min(this.boundsMin.z, position.z - halfD),
    );
    this.boundsMax.set(
      Math.max(this.boundsMax.x, position.x + halfW),
      Math.max(this.boundsMax.y, position.y + halfH),
      Math.max(this.boundsMax.z, position.z + halfD),
    );

    this.hasBounds = true;
    this.contentBounds.set(this.boundsMin, this.boundsMax);
    this.contentBounds.getCenter(this.contentCenter);
    this.contentBounds.getSize(this.contentSize);
  }

  public linePacking() {
    this.resetDerivedState();
    let lastPosition = this.options.startPosition;
    let maxRowDepth = 0;

    return (shop: Shop): THREE.Vector3 => {
      let xPos = lastPosition.x + this.options.gutter + shop.width / 2;
      let zPos = lastPosition.z;
      if (xPos + shop.width / 2 > this.options.maxRowWidth) {
        xPos =
          this.options.startPosition.x + this.options.gutter + shop.width / 2;
        zPos = lastPosition.z + maxRowDepth + this.options.gutter;
        maxRowDepth = 0;
      }
      const yPos = shop.height / 2;
      if (maxRowDepth < shop.depth) maxRowDepth = shop.depth;
      lastPosition = { x: xPos + shop.width / 2, y: 1, z: zPos };
      const position = new THREE.Vector3(xPos, yPos, zPos);
      this.updateBounds(shop, position);
      return position;
    };
  }

  public getMiddlePoint() {
    if (this.middlePoint) return this.middlePoint.clone();
    if (!this.hasBounds) return new THREE.Vector3(0, 0, 0);
    this.middlePoint = new THREE.Vector3(
      this.contentCenter.x,
      0,
      this.contentCenter.z,
    );
    return this.middlePoint.clone();
  }

  public getContentBounds() {
    return this.contentBounds.clone();
  }

  public getContentCenter() {
    return this.contentCenter.clone();
  }

  public getContentSize() {
    return this.contentSize.clone();
  }
}
