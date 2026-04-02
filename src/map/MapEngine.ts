import * as THREE from "three";
import Stats from "stats.js";
import type { InstanceGroups, ModifiedShop, Shop } from "../lib/types";
import { PlacementEngine } from "./PlacementEngine";
import { ShopLabelsEngine } from "./ShopLabelsEngine";
import { PerspectiveSwitch } from "./AnimationEngine";
import { throttle } from "../lib/helpers";

export class MapEngine {
  private data: ModifiedShop[] = [];
  private readonly container: HTMLElement;
  private readonly packingType: "line" | "grid" = "line";
  private sceneSize!: { width: number; height: number };
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private shopLabelsEngine!: ShopLabelsEngine;
  private raycaster = new THREE.Raycaster();
  private color = new THREE.Color();
  private mouse = new THREE.Vector2(1, 1);

  private ortographicCamera!: THREE.OrthographicCamera;
  private perspectiveCamera!: THREE.PerspectiveCamera;
  private topViewPoint: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  private perspectiveViewPoint: THREE.Vector3 = new THREE.Vector3(-65, 60, -70);
  private middlePoint: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  private perspectiveSwitch!: PerspectiveSwitch;
  private contentCenter: THREE.Vector3 = new THREE.Vector3();
  private contentSize: THREE.Vector3 = new THREE.Vector3();
  private matchPerspectiveFov: number = 30;

  private stats = new Stats();

  private instanceGroups: InstanceGroups = {};
  private shopsGroup: THREE.Group = new THREE.Group();
  private readonly shopsById = new Map<string, ModifiedShop>();
  private readonly shopsByName = new Map<string, ModifiedShop[]>();
  private lastHovered?: ModifiedShop;
  private selectedShop?: ModifiedShop;

  private placementEngine: PlacementEngine = new PlacementEngine({
    gutter: 0.5,
    maxRowWidth: 250,
    maxShopWidth: 8,
    maxShopDepth: 6,
    startPosition: { x: -25, y: 1, z: 0 },
    gridSize: { width: 100, depth: 100 },
  });

  constructor(
    container: HTMLElement,
    data: Shop[],
    packingType?: "line" | "grid",
  ) {
    this.container = container;
    this.placementEngine.setMaxRowWidth(Math.max(data.length / 4, 75));
    this.packingType = packingType || "line";
    this.data = this.organizeData(data);
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

    this.container.appendChild(this.renderer.domElement);

    this.shopLabelsEngine = new ShopLabelsEngine(this.container);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x202020);

    const light = new THREE.HemisphereLight(0xffffff, 0x888888, 3);
    light.position.set(0, 1, 0);
    this.scene.add(light);

    this.setupCameras();
    this.stats.showPanel(0);
    document.body.appendChild(this.stats.dom);

    this.generateGeometry();
    this.shopLabelsEngine.buildLabels(this.data);
    this.scene.add(this.shopLabelsEngine.group);

    window.addEventListener("resize", this.onWindowResize.bind(this));
    this.container.addEventListener("mousemove", (e: MouseEvent) =>
      throttle(this.onMouseMove.bind(this), 10)(e),
    );
    this.container.addEventListener("click", this.onClick.bind(this));
    document.body.addEventListener("keyup", (e) => {
      this.toggleView(e);
    });
  }

  private organizeData(data: Shop[]) {
    const ouptut: ModifiedShop[] = [];
    this.shopsById.clear();
    this.shopsByName.clear();
    const getCoordinates =
      this.packingType === "line"
        ? this.placementEngine.linePacking()
        : this.placementEngine.gridPacking();
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

  private setupCameras() {
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

  private checkIntersections() {
    this.raycaster.setFromCamera(
      this.mouse,
      this.perspectiveSwitch.getCamera(),
    );
    if (
      !this.raycaster.ray.intersectsBox(this.placementEngine.getContentBounds())
    )
      return;

    const intersections = this.raycaster.intersectObject(this.shopsGroup);

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
      this.shopLabelsEngine.setHoveredShop(shop);
    } else {
      this.resetLastHoveredColor();
      this.lastHovered = undefined;
      this.shopLabelsEngine.setHoveredShop(undefined);
    }
  }

  private animate() {
    const cam = this.perspectiveSwitch.getCamera();
    this.renderer.render(this.scene, cam);
    this.shopLabelsEngine.updateLayout(cam, this.renderer.domElement);
    this.shopLabelsEngine.render(this.scene, cam);
    this.perspectiveSwitch?.update();
    this.stats.update();
  }


  public toggleView(e: KeyboardEvent) {
    if (e.code !== "Space") return;
    e.preventDefault();
    this.perspectiveSwitch?.changePerspective(undefined, {
      matchFov: this.matchPerspectiveFov,
    });
  }

  // Event handlers
  private onWindowResize() {
    const containerSize = this.container.getBoundingClientRect();
    this.sceneSize = {
      width: containerSize.width,
      height: containerSize.height,
    };
    this.updateCameraFraming();

    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.shopLabelsEngine.setSize(window.innerWidth, window.innerHeight);
    const cam = this.perspectiveSwitch.getCamera();
    this.shopLabelsEngine.updateLayout(cam, this.renderer.domElement);
    this.shopLabelsEngine.render(this.scene, cam);
  }

  private onMouseMove(event: MouseEvent) {
    event.preventDefault();

    const prevPosition = this.mouse.clone();

    this.mouse.x =
      (event.clientX / this.container.getBoundingClientRect().width) * 2 - 1;
    this.mouse.y =
      -(event.clientY / this.container.getBoundingClientRect().height) * 2 + 1;

    if (prevPosition.distanceTo(this.mouse) < 0.0008) return;

    this.checkIntersections();
  }

  private onClick() {
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
    this.shopLabelsEngine.setSelectedShop(this.selectedShop);
    console.table({
      ID: this.selectedShop.id,
      Name: this.selectedShop.name,
      Position: this.selectedShop.position,
    });
  }

  // Helpers
  public getShopById(id: string) {
    return this.shopsById.get(id);
  }

  public getShopsByName(name: string) {
    return this.shopsByName.get(name) || [];
  }

  private setShopColor(shop: ModifiedShop, color: number) {
    if (shop.instanceId === undefined) return;
    const mesh = this.instanceGroups[shop.instanceKey].mesh;
    if (!mesh || !mesh.instanceColor) return;
    mesh.setColorAt(shop.instanceId, this.color.setHex(color));
    mesh.instanceColor.needsUpdate = true;
  }

  private resetLastHoveredColor() {
    if (
      !this.lastHovered ||
      this.lastHovered.instanceId === undefined ||
      this.lastHovered.id === this.selectedShop?.id
    )
      return;
    this.setShopColor(this.lastHovered, this.lastHovered.color);
  }
}
