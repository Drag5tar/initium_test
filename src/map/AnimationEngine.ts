import * as THREE from "three";

export type PositionAnimation = {
    startPosition: THREE.Vector3,
    endPosition: THREE.Vector3,
    startRotation: THREE.Euler,
    endRotation: THREE.Euler,
    animationProgress: number,
    onStart: <T extends (...args: Parameters<T>[]) => unknown>() => unknown,
    onEnd: <T extends (...args: Parameters<T>[]) => unknown>() => unknown,
    target: THREE.Object3D | THREE.Camera,
    delta: number
}

export class PositionAnimationEngine {
    private animationQueue: PositionAnimation[] = [];
    private currentAnimation?: PositionAnimation;

    constructor() {

    }

    addAnimation(anim: PositionAnimation) {
        if (this.animationQueue.includes(anim)) return;
        this.animationQueue.push(anim);
    }

    onAnimationEnd() {
        this.currentAnimation = undefined;
        this.animationQueue.shift();
    }
    
    onAnimationStart() {
        
    }

    public update() {
        if (!this.currentAnimation) return;
        let {animationProgress} = this.currentAnimation;
        const {target, delta, onStart, onEnd, startPosition, endPosition, startRotation, endRotation} = this.currentAnimation;
        if (animationProgress === 0) onStart();
        animationProgress += delta;
        target.position.lerpVectors(startPosition, endPosition, animationProgress);
        const fromQuat = new THREE.Quaternion().setFromEuler(startRotation);
        const toQuat = new THREE.Quaternion().setFromEuler(endRotation);
        const currentQuat = new THREE.Quaternion().slerpQuaternions(fromQuat, toQuat, animationProgress);
        target.rotation.setFromQuaternion(currentQuat);
        if (animationProgress >= 1) {
            this.onAnimationEnd();
            onEnd();
        }
    }


}