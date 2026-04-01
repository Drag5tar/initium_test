import * as THREE from "three";

export type CameraPositionParameters = {
  coordinates: THREE.Vector3;
  rotation: THREE.Quaternion;
  fov?: number;
};

export type PerspectiveList = "2d" | "3d";

export type CameraData = {
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera;
  defaultPosition?: CameraPositionParameters;
};

export type Perspectives = Record<PerspectiveList, CameraData>;

export type PerspectiveAnimationData = {
  perspective: CameraPositionParameters;
  targetPerspective: CameraPositionParameters;
  progress: number;
  switchAtTheEnd?: PerspectiveList;
};

export class PerspectiveSwitch {
  private perspectives!: Perspectives;
  private timer: THREE.Timer = new THREE.Timer();
  private animation?: PerspectiveAnimationData;
  currentPerspective!: PerspectiveList;

  constructor(perspectives: Perspectives, currentPerspective: PerspectiveList) {
    this.perspectives = perspectives;
    this.currentPerspective = currentPerspective;
    this.init();
  }

  init() {
    for (const [key] of Object.entries(this.perspectives)) {
      const perspective = this.perspectives[key as PerspectiveList];
      perspective.defaultPosition = {
        coordinates: perspective.camera.position.clone(),
        rotation: perspective.camera.quaternion.clone(),
      };
      if (perspective.camera instanceof THREE.PerspectiveCamera) {
        perspective.defaultPosition.fov = perspective.camera.fov;
      }
    }
  }

  resetCamera(perspective: CameraData) {
    const { camera, defaultPosition } = perspective;
    if (!defaultPosition)
      throw "Trying to reset a camera with no default position";
    camera.position.copy(defaultPosition.coordinates);
    camera.quaternion.copy(defaultPosition.rotation);
    if (camera instanceof THREE.PerspectiveCamera && defaultPosition.fov) {
      camera.fov = defaultPosition.fov;
    }
  }

  copyCameraPosition(
    perspective: CameraData,
    targetPerspective: CameraData,
    fov?: number,
  ) {
    if (!perspective.defaultPosition || !targetPerspective.defaultPosition)
      return;
    perspective.camera.position.copy(
      targetPerspective.defaultPosition.coordinates,
    );
    perspective.camera.quaternion.copy(
      targetPerspective.defaultPosition.rotation,
    );
    if (
      targetPerspective.camera instanceof THREE.PerspectiveCamera &&
      perspective.camera instanceof THREE.PerspectiveCamera
    ) {
      perspective.camera.fov = fov || targetPerspective.camera.fov;
    }
  }

  getNextPerspective() {
    const perspectives = Object.keys(this.perspectives) as PerspectiveList[];
    const currentPerspectiveIndex = perspectives.indexOf(
      this.currentPerspective,
    );
    if (currentPerspectiveIndex >= perspectives.length - 1) {
      return perspectives[0];
    } else {
      return perspectives[currentPerspectiveIndex + 1];
    }
  }

  changePerspective(
    targetPerspective?: PerspectiveList,
    options?: { matchFov?: number },
  ): THREE.PerspectiveCamera | THREE.OrthographicCamera | undefined {
    if (this.animation) return;
    const target = targetPerspective || this.getNextPerspective();

    const currentPerspectiveData = this.perspectives[this.currentPerspective];
    const targetPerspectiveData = this.perspectives[target];
    if (
      !currentPerspectiveData.defaultPosition ||
      !targetPerspectiveData.defaultPosition
    )
      return;
    const animation: PerspectiveAnimationData = {
      perspective: currentPerspectiveData.defaultPosition,
      targetPerspective: targetPerspectiveData.defaultPosition,
      progress: 0,
    };
    if (
      targetPerspectiveData.camera instanceof THREE.OrthographicCamera &&
      currentPerspectiveData.camera instanceof THREE.PerspectiveCamera
    ) {
      animation.targetPerspective = {
        coordinates: targetPerspectiveData.defaultPosition!.coordinates,
        rotation: targetPerspectiveData.defaultPosition!.rotation,
        fov: options?.matchFov ?? 90,
      };
      animation.switchAtTheEnd = target;
    }

    if (
      currentPerspectiveData.camera instanceof THREE.OrthographicCamera &&
      targetPerspectiveData.camera instanceof THREE.PerspectiveCamera
    ) {
      this.copyCameraPosition(
        targetPerspectiveData,
        currentPerspectiveData,
        options?.matchFov ?? 90,
      );
      this.currentPerspective = target;
      animation.perspective = {
        coordinates: currentPerspectiveData.defaultPosition!.coordinates,
        rotation: currentPerspectiveData.defaultPosition!.rotation,
        fov: options?.matchFov ?? 90,
      };
    }
    this.animation = animation;
    this.timer.update();
  }

  getCamera() {
    return this.perspectives[this.currentPerspective].camera;
  }

  onTransitionEnd() {
    console.log("on end", this.animation);
    if (this.animation?.switchAtTheEnd) {
      this.currentPerspective = this.animation.switchAtTheEnd;
    }
    this.animation = undefined;
  }

  private getFov(
    startFov: number,
    targetFov: number,
    progress: number,
  ): number {
    return startFov + (targetFov - startFov) * progress;
  }

  public update() {
    if (!this.animation) return;
    this.timer.update();
    const delta = this.timer.getDelta();
    const { perspective, targetPerspective } = this.animation;
    const camera = this.perspectives[this.currentPerspective].camera;
    this.animation.progress += delta / 2;
    const prog = this.cameraEasing(this.animation.progress);
    if (prog >= 1) {
      this.onTransitionEnd();
      return;
    }
    camera.position.lerpVectors(
      perspective.coordinates,
      targetPerspective.coordinates,
      prog,
    );
    camera.quaternion.slerpQuaternions(
      perspective.rotation,
      targetPerspective.rotation,
      prog,
    );
    if (
      camera instanceof THREE.PerspectiveCamera &&
      perspective.fov !== undefined &&
      targetPerspective.fov !== undefined
    ) {
      camera.fov = this.getFov(perspective.fov, targetPerspective.fov, prog);
    }
    camera.updateProjectionMatrix();
  }

  private cameraEasing = (x: number) => Math.ceil(x * (2 - x) * 1000) / 1000;
}
