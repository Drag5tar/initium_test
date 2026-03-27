import * as THREE from "three";
import {
  computeBoundsTree,
  disposeBoundsTree,
  acceleratedRaycast,
} from "three-mesh-bvh";
import Stats from "stats.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { InstanceGroups, ModifiedShop, Shop } from "../lib/types";
import { PlacementEngine } from "./PlacementEngine";

export class MapEngine {
  private readonly container: HTMLElement;
  private readonly data: ModifiedShop[];
  renderer!: THREE.WebGLRenderer;
  scene!: THREE.Scene;
  ortographicCamera!: THREE.OrthographicCamera;
  perspectiveCamera!: THREE.PerspectiveCamera;
  raycaster = new THREE.Raycaster();
  camera!: THREE.OrthographicCamera | THREE.PerspectiveCamera;
  instanceGroups: InstanceGroups = {};
  controls!: OrbitControls;
  color = new THREE.Color();
  mouse = new THREE.Vector2(1, 1);
  lastHovered?: { instanceGroupKey: string; instanceGroupId: number };
  stats = new Stats();

  private placementEngine: PlacementEngine = new PlacementEngine({
    gutter: 1,
    maxRowWidth: 150,
    startPosition: { x: -25, y: 1, z: 0 },
  });

  constructor(container: HTMLElement, data: Shop[]) {
    this.container = container;
    this.data = this.organizeData(data);
    this.init();
  }

  init() {
    THREE.BoxGeometry.prototype.computeBoundsTree = computeBoundsTree;
    THREE.BoxGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
    THREE.Mesh.prototype.raycast = acceleratedRaycast;

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setAnimationLoop(this.animate.bind(this));
    this.container.appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x202020);
    const light = new THREE.HemisphereLight(0xffffff, 0x888888, 3);
    light.position.set(0, 1, 0);
    this.scene.add(light);
    this.camera = new THREE.PerspectiveCamera(
      50,
      window.innerWidth / window.innerHeight,
      0.1,
      1000,
    );
    this.camera.position.set(0, 20, 55);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.update();
    this.raycaster.firstHitOnly = true;
    this.stats.showPanel(0);
    document.body.appendChild(this.stats.dom);
    this.container.addEventListener("resize", this.onWindowResize.bind(this));
    this.container.addEventListener("mousemove", this.onMouseMove.bind(this));

    this.generateGeometry();
  }

  private organizeData(data: Shop[]) {
    const ouptut: ModifiedShop[] = [];
    const getCoordinates = this.placementEngine.linePacking();
    data.forEach((shop) => {
      const instanceKey = `${shop.width}_${shop.depth}_${shop.height}`;
      const shopInstance: ModifiedShop = {
        ...shop,
        ...{
          instanceKey: instanceKey,
          position: getCoordinates(shop),
        },
      };
      ouptut.push(shopInstance);
      if (Object.keys(this.instanceGroups).includes(instanceKey)) {
        this.instanceGroups[instanceKey].children.push(shopInstance);
        shopInstance.instanceId =
          this.instanceGroups[instanceKey].children.length - 1;
      } else {
        shopInstance.instanceId = 0;
        this.instanceGroups[instanceKey] = {
          width: shop.width,
          depth: shop.depth,
          height: shop.height,
          children: [shopInstance],
        };
      }
    });
    return ouptut;
  }

  private generateGeometry() {
    Object.keys(this.instanceGroups).forEach((key) => {
      const group = this.instanceGroups[key];
      const geometry = new THREE.BoxGeometry(
        group.width,
        group.height,
        group.depth,
      );
      const material = new THREE.MeshStandardMaterial({ color: 0xFFFFFF });
      group.mesh = new THREE.InstancedMesh(
        geometry,
        material,
        group.children.length,
      );
      this.scene.add(group.mesh);
      const matrix = new THREE.Matrix4();
      group.children.forEach((shop, index) => {
        if (!shop.instanceId) shop.instanceId = index;
        matrix.setPosition(shop.position);
        group.mesh?.setMatrixAt(shop.instanceId, matrix);
        group.mesh?.setColorAt(shop.instanceId, this.color.setHex(shop.color));
      });
    });
  }

  resetLastHoveredColor() {
    if (!this.lastHovered) return;
    const group = this.instanceGroups[this.lastHovered.instanceGroupKey];
    const mesh = group.mesh;
    if (!mesh) return;
    const shop = group.children[this.lastHovered.instanceGroupId];
    mesh.setColorAt(this.lastHovered.instanceGroupId, this.color.setHex(shop.color));
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  private animate() {
    this.raycaster.setFromCamera(this.mouse, this.camera);

    let hasIntersection = false;
    Object.keys(this.instanceGroups).forEach((key) => {
      const mesh = this.instanceGroups[key].mesh;
      if (!mesh) return;

      const intersection = this.raycaster.intersectObject(mesh);
      if (intersection.length === 0) return;

      const instanceId = intersection[0].instanceId;
      if (typeof instanceId === "undefined") return;
      if (this.lastHovered?.instanceGroupId === instanceId && this.lastHovered.instanceGroupKey === key) {
        hasIntersection = true;
        return;
      };

      mesh.setColorAt(instanceId, this.color.setHex(0xff0000));
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      this.resetLastHoveredColor();
      this.lastHovered = {
        instanceGroupId: instanceId,
        instanceGroupKey: key,
      };
      hasIntersection = true;
    });
    if (!hasIntersection) {
        this.resetLastHoveredColor();
        this.lastHovered = undefined;
    }
    this.renderer.render(this.scene, this.camera);
    this.stats.update();
  }

  onWindowResize() {
    this.perspectiveCamera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
  onMouseMove(event: MouseEvent) {
    event.preventDefault();

    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // this.animate();
  }
}
