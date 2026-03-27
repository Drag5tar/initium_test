import * as THREE from 'three';

export type GeneratorOptions = {
    minWidth: number,
    maxWidth: number,
    minDepth: number,
    maxDepth: number,
    height: number,
}

export type Shop = {
    id: string,
    name: string,
    width: number,
    depth: number,
    color: number,
    height: number
}

export type ModifiedShop = Shop & {
    instanceKey: string,
    instanceId?: number,
    position: THREE.Vector3,
}

export type InstanceGroup = {
    width: number,
    depth: number,
    height: number,
    mesh?: THREE.InstancedMesh,
    children: ModifiedShop[]
};

export type InstanceGroups = Record<string, InstanceGroup>;
