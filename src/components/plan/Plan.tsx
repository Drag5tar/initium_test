import { useEffect, useRef, useState } from "react"
import { generateData } from "../../lib/dataGenerator"
import type { Shop } from "../../lib/types"
import { MapEngine } from "../../map/MapEngine";

export const Plan = () => {
    const containerRef = useRef(null);
    const [data] = useState<Shop[]>(generateData(200));
    const [map, setMap] = useState<MapEngine | null>(null);


    useEffect(() => {
        if (!containerRef.current || data.length === 0 || map) return;
        setMap(new MapEngine(containerRef.current, data));
    }, [containerRef, data, map]);

    return (
        <section className="fh" ref={containerRef}>

        </section>
    )
}