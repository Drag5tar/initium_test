import { shopColors, shopNames } from "./data";
import { getRandomInt } from "./helpers";
import type { GeneratorOptions, Shop } from "./types";

const defaultOptions: GeneratorOptions = {
    minWidth: 5,
    maxWidth: 8,
    minDepth: 5,
    maxDepth: 6,
    height: 2,
}

export const generateData = (amount: number = 100, options: GeneratorOptions = defaultOptions): Shop[] => {
    const output: Shop[] = [];
    const {minWidth, maxWidth, minDepth, maxDepth, height} = options;
    for (let i = 0; i < amount; i++) {
        const name = i >= shopNames.length ? `${shopNames[Math.floor(i % shopNames.length)]}_${(Math.floor(i / shopNames.length))}` : shopNames[i];
        output.push({
            id: `shop_${i+1}`,
            name: name,
            width: getRandomInt(minWidth, maxWidth),
            depth: getRandomInt(minDepth, maxDepth),
            height: height,
            color: shopColors[getRandomInt(0, shopColors.length - 1)],
        });
    }
    return output;
}