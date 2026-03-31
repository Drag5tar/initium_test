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
import { throttle } from "../lib/helpers";
import { PerspectiveSwitch } from "./AnimationEngine";
// import {
//   CameraAnimationEngine,
//   type PositionAnimation,
// } from "./AnimationEngine";

export class MapEngine {
  private readonly container: HTMLElement;
  private sceneSize!: { width: number; height: number };
  renderer!: THREE.WebGLRenderer;
  scene!: THREE.Scene;
  raycaster = new THREE.Raycaster();
  controls!: OrbitControls;
  color = new THREE.Color();
  mouse = new THREE.Vector2(1, 1);

  ortographicCamera!: THREE.OrthographicCamera;
  perspectiveCamera!: THREE.PerspectiveCamera;
  camera!: THREE.OrthographicCamera | THREE.PerspectiveCamera;
  topViewPoint: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  perspectiveViewPoint: THREE.Vector3 = new THREE.Vector3(-45, 60, -55);
  topViewRotation: THREE.Quaternion = new THREE.Quaternion();
  perspectiveViewRotation: THREE.Quaternion = new THREE.Quaternion();
  middlePoint: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  perspectiveSwitch!: PerspectiveSwitch;

  stats = new Stats();

  instanceGroups: InstanceGroups = {};
  instanceGroupsMeshes: THREE.InstancedMesh[] = [];
  lastHovered?: ModifiedShop;
  selectedShop?: ModifiedShop;

  private placementEngine: PlacementEngine = new PlacementEngine({
    gutter: 1,
    maxRowWidth: 150,
    startPosition: { x: -25, y: 1, z: 0 },
  });

  constructor(container: HTMLElement, data: Shop[]) {
    this.container = container;
    this.placementEngine.setMaxRowWidth(data.length / 2);
    this.organizeData(data);
    this.init();
  }

  init() {
    const containerSize = this.container.getBoundingClientRect();
    console.log(containerSize);
    this.sceneSize = {
      width: containerSize.width,
      height: containerSize.height,
    };
    THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
    THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
    THREE.Mesh.prototype.raycast = acceleratedRaycast;
    this.raycaster.firstHitOnly = true;

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
    this.setupCameras();
    // this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    // this.controls.update();
    this.stats.showPanel(0);
    document.body.appendChild(this.stats.dom);
    window.addEventListener("resize", this.onWindowResize.bind(this));
    this.container.addEventListener("mousemove", (e: MouseEvent) =>
      throttle(this.onMouseMove.bind(this), 5)(e),
    );
    this.container.addEventListener("click", this.onClick.bind(this));
    document.body.addEventListener("keyup", (e) => {
      this.toggleView(e);
    });

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
      geometry.computeBoundsTree();
      const material = new THREE.MeshStandardMaterial({ color: 0xffffff });
      const mesh = new THREE.InstancedMesh(
        geometry,
        material,
        group.children.length,
      );
      group.mesh = mesh;
      mesh.userData["id"] = key;
      this.scene.add(group.mesh);
      const matrix = new THREE.Matrix4();
      group.children.forEach((shop, index) => {
        if (!shop.instanceId) shop.instanceId = index;
        matrix.setPosition(shop.position);
        mesh.setMatrixAt(shop.instanceId, matrix);
        mesh.setColorAt(shop.instanceId, this.color.setHex(shop.color));
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      });
      if (!this.instanceGroupsMeshes.includes(group.mesh))
        this.instanceGroupsMeshes.push(group.mesh);
    });
  }

  setupCameras() {
    this.topViewPoint = this.placementEngine.getMiddlePoint();
    this.middlePoint = this.placementEngine.getMiddlePoint();
    this.topViewPoint.y = 100;
    this.middlePoint.y = 0;
    this.perspectiveCamera = new THREE.PerspectiveCamera(
      35,
      window.innerWidth / window.innerHeight,
      0.1,
      1000,
    );
    // const scaleMultiplier = 20;
    this.ortographicCamera = new THREE.OrthographicCamera(
      this.sceneSize.width / -2,
      this.sceneSize.width / 2,
      this.sceneSize.height / 2,
      this.sceneSize.height / -2,
      -500,
      1500,
    );
    this.ortographicCamera.zoom = 10;
    this.perspectiveCamera.position.copy(this.perspectiveViewPoint);
    this.ortographicCamera.position.copy(this.topViewPoint);
    this.perspectiveCamera.lookAt(this.middlePoint);
    this.ortographicCamera.lookAt(this.middlePoint);
    this.perspectiveCamera.updateProjectionMatrix();
    this.ortographicCamera.updateProjectionMatrix();
    this.scene.add(this.perspectiveCamera);
    this.scene.add(this.ortographicCamera);
    this.perspectiveSwitch = new PerspectiveSwitch(
      {
        "2d": {
          camera: this.ortographicCamera,
        },
        "3d": {
          camera: this.perspectiveCamera,
        },
      },
      "3d",
    );
    this.perspectiveSwitch.getCamera();
    // const upVector = new THREE.Vector3(0, 10, 0);
    // const topViewMatrix = new THREE.Matrix4().lookAt(
    //   this.topViewPoint,
    //   this.middlePoint,
    //   upVector,
    // );
    // const perspectiveViewMatrix = new THREE.Matrix4().lookAt(
    //   this.perspectiveViewPoint,
    //   this.middlePoint,
    //   upVector,
    // );
    // this.topViewRotation.setFromRotationMatrix(topViewMatrix);
    // this.perspectiveViewRotation.setFromRotationMatrix(perspectiveViewMatrix);
  }

  setShopColor(shop: ModifiedShop, color: number) {
    if (shop.instanceId === undefined) return;
    const mesh = this.instanceGroups[shop.instanceKey].mesh;
    if (!mesh || !mesh.instanceColor) return;
    mesh.setColorAt(shop.instanceId, this.color.setHex(color));
    mesh.instanceColor.needsUpdate = true;
  }

  resetLastHoveredColor() {
    if (
      !this.lastHovered ||
      this.lastHovered.instanceId === undefined ||
      this.lastHovered.id === this.selectedShop?.id
    )
      return;
    this.setShopColor(this.lastHovered, this.lastHovered.color);
  }

  checkIntersections() {
    console.log('checking intersections');
    this.raycaster.setFromCamera(this.mouse, this.perspectiveSwitch.getCamera());

    const intersections = this.raycaster.intersectObjects(
      this.instanceGroupsMeshes,
    );

    if (intersections.length > 0) {
      const intersection = intersections[0];
      const groupId = intersection.object.userData.id;
      const instanceId = intersection.instanceId;
      const group = this.instanceGroups[groupId];
      const mesh = group.mesh;
      if (typeof instanceId === "undefined" || !mesh) return;
      const shop = group.children[instanceId];
      if (this.lastHovered === shop) return;

      if (shop.id !== this.selectedShop?.id) {
        mesh.setColorAt(instanceId, this.color.setHex(0xff0000));
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      }

      this.resetLastHoveredColor();
      this.lastHovered = shop;
    } else {
      this.resetLastHoveredColor();
      this.lastHovered = undefined;
    }
  }

  private animate() {
    this.renderer.render(this.scene, this.perspectiveSwitch.getCamera());
    this.perspectiveSwitch?.update();
    this.stats.update();
  }

  onWindowResize() {
    this.perspectiveCamera.aspect = window.innerWidth / window.innerHeight;
    this.perspectiveSwitch.getCamera().updateProjectionMatrix();

    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
  onMouseMove(event: MouseEvent) {
    event.preventDefault();

    this.mouse.x =
      (event.clientX / this.container.getBoundingClientRect().width) * 2 - 1;
    this.mouse.y =
      -(event.clientY / this.container.getBoundingClientRect().height) * 2 + 1;

    this.checkIntersections();
  }
  onClick() {
    this.checkIntersections();
    if (
      !this.lastHovered ||
      this.lastHovered.instanceId === undefined ||
      this.lastHovered.id === this.selectedShop?.id
    )
      return;
    if (this.selectedShop) {
      this.setShopColor(this.selectedShop, this.selectedShop?.color);
    }
    this.selectedShop = this.lastHovered;
    this.setShopColor(this.selectedShop, 0xee9bd4);
    console.table({
      ID: this.selectedShop.id,
      Name: this.selectedShop.name,
      Position: this.selectedShop.position,
    });
    this.animate();
  }

//   resetInactiveCamera() {
//     const camera =
//       this.activeCamera === "2d"
//         ? this.perspectiveCamera
//         : this.ortographicCamera;
//     if (this.activeCamera === "2d") {
//       camera.position.copy(this.perspectiveViewPoint);
//       camera.quaternion.copy(this.perspectiveViewRotation);
//     } else {
//       camera.position.copy(this.topViewPoint);
//       camera.quaternion.copy(this.topViewRotation);
//     }
//   }

  toggleView(e: KeyboardEvent) {
    console.log(e);
    if (e.code !== "Space") return;
    e.preventDefault();
    console.log(this.camera);
    this.perspectiveSwitch?.changePerspective()
  }
}
