import * as THREE from "three";
import {
  CSS2DObject,
  CSS2DRenderer,
} from "three/addons/renderers/CSS2DRenderer.js";
import type { ModifiedShop } from "../lib/types";

export class ShopLabelsEngine {
  readonly group = new THREE.Group();
  readonly css2dRenderer: CSS2DRenderer;

  private entries: { shop: ModifiedShop; label: CSS2DObject }[] = [];
  private readonly labelByShopId = new Map<string, HTMLElement>();
  private hoveredShopId?: string;
  private selectedShopId?: string;

  private readonly cornerScratch = new THREE.Vector3();
  private readonly footprintCorners = [
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3(),
  ];

  constructor(container: HTMLElement) {
    this.css2dRenderer = new CSS2DRenderer();
    this.css2dRenderer.setSize(window.innerWidth, window.innerHeight);
    this.css2dRenderer.domElement.style.position = "absolute";
    this.css2dRenderer.domElement.style.left = "0";
    this.css2dRenderer.domElement.style.top = "0";
    this.css2dRenderer.domElement.style.pointerEvents = "none";
    this.css2dRenderer.domElement.style.zIndex = "2";
    container.appendChild(this.css2dRenderer.domElement);
  }

  buildLabels(shops: ModifiedShop[]) {
    for (const shop of shops) {
      const element = document.createElement("div");
      element.classList.add("label");
      element.textContent = shop.name;
      const label = new CSS2DObject(element);
      label.position.copy(shop.position);
      this.group.add(label);
      this.entries.push({ shop, label });
      this.labelByShopId.set(shop.id, element);
    }
  }

  setHoveredShop(shop: ModifiedShop | undefined) {
    const nextId = shop?.id;
    if (this.hoveredShopId === nextId) return;

    if (this.hoveredShopId !== undefined) {
      this.labelByShopId.get(this.hoveredShopId)?.classList.remove("hovered");
    }
    this.hoveredShopId = nextId;
    if (nextId !== undefined) {
      this.labelByShopId.get(nextId)?.classList.add("hovered");
    }
  }

  setSelectedShop(shop: ModifiedShop | undefined) {
    const nextId = shop?.id;
    if (this.selectedShopId === nextId) return;

    if (this.selectedShopId !== undefined) {
      this.labelByShopId.get(this.selectedShopId)?.classList.remove("selected");
    }
    this.selectedShopId = nextId;
    if (nextId !== undefined) {
      this.labelByShopId.get(nextId)?.classList.add("selected");
    }
  }

  updateLayout(camera: THREE.Camera, canvas: HTMLCanvasElement) {
    if (this.entries.length === 0) return;

    const canvasRect = canvas.getBoundingClientRect();

    for (const { shop, label } of this.entries) {
      const element = label.element;
      element.style.visibility = "visible";

      const cx = shop.position.x;
      const cy = shop.position.y;
      const cz = shop.position.z;
      const hw = shop.width / 2;
      const hd = shop.depth / 2;

      this.footprintCorners[0].set(cx - hw, cy, cz - hd);
      this.footprintCorners[1].set(cx + hw, cy, cz - hd);
      this.footprintCorners[2].set(cx - hw, cy, cz + hd);
      this.footprintCorners[3].set(cx + hw, cy, cz + hd);

      let minPx = Infinity;
      let maxPx = -Infinity;
      let minPy = Infinity;
      let maxPy = -Infinity;

      for (const corner of this.footprintCorners) {
        this.cornerScratch.copy(corner).project(camera);
        const px = (this.cornerScratch.x * 0.5 + 0.5) * canvasRect.width;
        const py = (-this.cornerScratch.y * 0.5 + 0.5) * canvasRect.height;
        minPx = Math.min(minPx, px);
        maxPx = Math.max(maxPx, px);
        minPy = Math.min(minPy, py);
        maxPy = Math.max(maxPy, py);
      }

      const w = Math.max(0, maxPx - minPx);
      const h = Math.max(0, maxPy - minPy);
      element.style.width = `${w}px`;
      element.style.height = `${h}px`;
    }
  }

  setSize(width: number, height: number) {
    this.css2dRenderer.setSize(width, height);
  }

  render(scene: THREE.Scene, camera: THREE.Camera) {
    this.css2dRenderer.render(scene, camera);
  }
}
