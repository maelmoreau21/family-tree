import { useEffect, useRef } from 'react'
import * as f3 from '../lib/family-tree.esm.js'

// Define types for f3 to make TS happy
// Since we don't have a d.ts, we use any for now or basic interfaces
interface FamilyChartProps {
    data: any[]
    mainId: string | null
    config: {
        orientation: 'vertical' | 'horizontal'
        scale: number
        cardXSpacing: number
        cardYSpacing: number
    }
}

export function FamilyChart({ data, mainId, config }: FamilyChartProps) {
    const containerRef = useRef<HTMLDivElement>(null)
    const chartInstanceRef = useRef<any>(null)
    const storeRef = useRef<any>(null)

    useEffect(() => {
        if (!containerRef.current) return

        // Initialize Store
        const store = f3.createStore({
            data: data,
            nodeSeparation: 250,
            levelSeparation: 150
        })
        storeRef.current = store

        // Initialize Chart
        const view = f3.createChart(containerRef.current, store, f3.view(), f3.svg())
        chartInstanceRef.current = view

        // Apply initial config
        view.setTransitionTime(300)
        view.setCardXSpacing(config.cardXSpacing)
        view.setCardYSpacing(config.cardYSpacing)
        view.setOrientationVertical()

        // Initial draw
        view.updateTree({ initial: true })

        // Cleanup
        return () => {
            // f3 might not have a destroy, but we should clear the container
            if (containerRef.current) {
                containerRef.current.innerHTML = ''
            }
        }
    }, []) // Run once on mount (or if we want to re-create on drastic changes)

    // React to Data Updates
    useEffect(() => {
        if (!storeRef.current || !chartInstanceRef.current) return
        const store = storeRef.current
        const chart = chartInstanceRef.current

        // Check if data actually changed
        // For now, naive update
        store.updateData(data)

        if (mainId && mainId !== store.getMainId()) {
            chart.updateMainId(mainId)
        }

        chart.updateTree({ initial: false })

    }, [data, mainId])

    return (
        <div
            ref={containerRef}
            className="canvas"
            style={{ width: '100%', height: '100%', position: 'relative' }}
        />
    )
}
