import { shopNames } from "./data";
import { getRandomInt } from "./helpers";
import type { GeneratorOptions, Shop } from "./types";

const defaultOptions: GeneratorOptions = {
    minWidth: 3,
    maxWidth: 8,
    minDepth: 3,
    maxDepth: 6,
    height: 2,
}

export const generateData = (amount: number = 1000, options: GeneratorOptions = defaultOptions): Shop[] => {
    const output: Shop[] = [];
    const {minWidth, maxWidth, minDepth, maxDepth, height} = options;
    for (let i = 0; i < amount; i++) {
        const name = i >= shopNames.length ? `${shopNames[Math.floor(i % shopNames.length)]}_${(Math.floor(i / shopNames.length))}` : shopNames[i];
        output.push({
            id: `shop_${i}`,
            name: name,
            width: getRandomInt(minWidth, maxWidth),
            depth: getRandomInt(minDepth, maxDepth),
            height: height,
            color: Math.random() * 0xffffff,
        });
    }
    return output;
}