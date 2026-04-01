import * as THREE from "three";
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import Stats from "stats.js";
import type { InstanceGroups, ModifiedShop, Shop } from "../lib/types";
import { PlacementEngine } from "./PlacementEngine";
import { throttle } from "../lib/helpers";
import { PerspectiveSwitch } from "./AnimationEngine";
// import {
//   CameraAnimationEngine,
//   type PositionAnimation,
// } from "./AnimationEngine";

export class MapEngine {
//   private data: ModifiedShop[] = [];
  private readonly container: HTMLElement;
  private sceneSize!: { width: number; height: number };
  private renderer!: THREE.WebGLRenderer;
  private renderer2d!: CSS2DRenderer;
  private scene!: THREE.Scene;
  private raycaster = new THREE.Raycaster();
  private color = new THREE.Color();
  private mouse = new THREE.Vector2(1, 1);

  private ortographicCamera!: THREE.OrthographicCamera;
  private perspectiveCamera!: THREE.PerspectiveCamera;
  private topViewPoint: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  private perspectiveViewPoint: THREE.Vector3 = new THREE.Vector3(-55, 60, -65);
  private middlePoint: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  private perspectiveSwitch!: PerspectiveSwitch;
  private contentCenter: THREE.Vector3 = new THREE.Vector3();
  private contentSize: THREE.Vector3 = new THREE.Vector3();
  private matchPerspectiveFov: number = 35;

  private stats = new Stats();

  private instanceGroups: InstanceGroups = {};
  private shopsGroup: THREE.Group = new THREE.Group();
  private lastHovered?: ModifiedShop;
  private selectedShop?: ModifiedShop;

  private placementEngine: PlacementEngine = new PlacementEngine({
    gutter: 0.5,
    maxRowWidth: 150,
    startPosition: { x: -25, y: 1, z: 0 },
  });

  constructor(container: HTMLElement, data: Shop[]) {
    this.container = container;
    this.placementEngine.setMaxRowWidth(Math.max(data.length / 5, 50));
    this.organizeData(data);
    this.init();
  }

  init() {
    const containerSize = this.container.getBoundingClientRect();
    this.sceneSize = {
      width: containerSize.width,
      height: containerSize.height,
    };
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setAnimationLoop(this.animate.bind(this));
    this.renderer2d = new CSS2DRenderer();
    this.renderer2d.setSize(window.innerWidth, window.innerHeight);
    this.renderer2d.domElement.style.position = 'absolute';
    this.renderer2d.domElement.style.zIndex = '2';
    this.renderer2d.domElement.style.top = '0px';
    this.renderer2d.domElement.id = '2dlayer';
    this.container.appendChild(this.renderer.domElement);
    this.container.appendChild(this.renderer2d.domElement);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x202020);
    const light = new THREE.HemisphereLight(0xffffff, 0x888888, 3);
    light.position.set(0, 1, 0);
    this.scene.add(light);
    this.setupCameras();
    this.stats.showPanel(0);
    document.body.appendChild(this.stats.dom);
    window.addEventListener("resize", this.onWindowResize.bind(this));
    this.container.addEventListener("mousemove", (e: MouseEvent) =>
      throttle(this.onMouseMove.bind(this), 10)(e),
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
      const position = getCoordinates(shop);
      const shopInstance: ModifiedShop = {
        ...shop,
        ...{
          instanceKey: instanceKey,
          position,
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

    if (ouptut.length > 0) {
      this.contentCenter.copy(this.placementEngine.getContentCenter());
      this.contentSize.copy(this.placementEngine.getContentSize());
      this.middlePoint.copy(this.placementEngine.getMiddlePoint());
    }
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
      const material = new THREE.MeshStandardMaterial({ color: 0xffffff });
      const mesh = new THREE.InstancedMesh(
        geometry,
        material,
        group.children.length,
      );
      group.mesh = mesh;
      mesh.userData["id"] = key;
      this.shopsGroup.add(group.mesh);
      const matrix = new THREE.Matrix4();
      group.children.forEach((shop, index) => {
        if (!shop.instanceId) shop.instanceId = index;
        matrix.setPosition(shop.position);
        mesh.setMatrixAt(shop.instanceId, matrix);
        mesh.setColorAt(shop.instanceId, this.color.setHex(shop.color));
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      });
    });
    this.scene.add(this.shopsGroup);
  }

  private updateCameraFraming() {
    const padding = 1.1;
    const aspect = this.sceneSize.width / this.sceneSize.height;

    const contentWidth = Math.max(1, this.contentSize.x) * padding;
    const contentHeight = Math.max(1, this.contentSize.z) * padding;

    let halfW = contentWidth / 2;
    let halfH = contentHeight / 2;

    if (halfW / halfH < aspect) {
      halfW = halfH * aspect;
    } else {
      halfH = halfW / aspect;
    }

    this.ortographicCamera.left = -halfW;
    this.ortographicCamera.right = halfW;
    this.ortographicCamera.top = halfH;
    this.ortographicCamera.bottom = -halfH;
    this.ortographicCamera.near = -2000;
    this.ortographicCamera.far = 4000;
    this.ortographicCamera.zoom = 1;

    const targetFov = this.matchPerspectiveFov;
    const distance = halfH / Math.tan(THREE.MathUtils.degToRad(targetFov / 2));
    this.topViewPoint.set(
      this.contentCenter.x,
      Math.max(10, distance),
      this.contentCenter.z,
    );

    this.perspectiveCamera.fov = targetFov;
    this.perspectiveCamera.aspect = aspect;
    this.perspectiveCamera.near = Math.max(0.1, distance / 100);
    this.perspectiveCamera.far = Math.max(5000, distance * 10);

    this.ortographicCamera.position.copy(this.topViewPoint);
    this.perspectiveCamera.position.copy(this.perspectiveViewPoint);

    this.ortographicCamera.up.set(0, 0, -1);
    this.ortographicCamera.lookAt(this.middlePoint);
    this.perspectiveCamera.lookAt(this.middlePoint);

    this.ortographicCamera.updateProjectionMatrix();
    this.perspectiveCamera.updateProjectionMatrix();
  }

  setupCameras() {
    this.perspectiveCamera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
    this.ortographicCamera = new THREE.OrthographicCamera(
      -1,
      1,
      1,
      -1,
      -500,
      1500,
    );

    this.updateCameraFraming();

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
    this.raycaster.setFromCamera(
      this.mouse,
      this.perspectiveSwitch.getCamera(),
    );
    if (
      !this.raycaster.ray.intersectsBox(this.placementEngine.getContentBounds())
    )
      return;

    const intersections = this.raycaster.intersectObject(
      this.shopsGroup,
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
    const containerSize = this.container.getBoundingClientRect();
    this.sceneSize = {
      width: containerSize.width,
      height: containerSize.height,
    };
    this.updateCameraFraming();

    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
  onMouseMove(event: MouseEvent) {
    event.preventDefault();

    const prevPosition = this.mouse.clone();

    this.mouse.x =
      (event.clientX / this.container.getBoundingClientRect().width) * 2 - 1;
    this.mouse.y =
      -(event.clientY / this.container.getBoundingClientRect().height) * 2 + 1;

    if (prevPosition.distanceTo(this.mouse) < 0.0008) return;

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
  }

  toggleView(e: KeyboardEvent) {
    if (e.code !== "Space") return;
    e.preventDefault();
    this.perspectiveSwitch?.changePerspective(undefined, {
      matchFov: this.matchPerspectiveFov,
    });
  }
}
