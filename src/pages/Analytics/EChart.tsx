import { CSSProperties, useEffect, useMemo, useRef, useState } from 'react'

// Reusable Apache ECharts wrapper following the standard echarts-in-React pattern
// (https://www.taniarascia.com/apache-echarts-react/): a single container ref, an init/dispose
// effect, a setOption effect, and a debounced ResizeObserver.
//
// echarts ships as an ESM package ("type": "module") which Create React App's NodeNext module
// resolution rejects for a static import (TS1479), so it is loaded via a cached dynamic import —
// this also lazy-loads the (large) charting bundle only when a chart first renders.
let echartsPromise: Promise<any> | null = null
const loadECharts = (): Promise<any> => {
  if (!echartsPromise) echartsPromise = import('echarts')
  return echartsPromise
}

function debounce(fn: () => void, ms: number): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined
  return () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(fn, ms)
  }
}

interface EChartProps {
  option: any
  style?: CSSProperties
  // group connects charts so their tooltip crosshair and zoom stay in sync (see echarts.connect).
  group?: string
}

export const EChart = ({
  option,
  style = { width: '100%', height: '420px' },
  group,
}: EChartProps) => {
  const chartRef = useRef<HTMLDivElement | null>(null)
  // Latest option, so the init effect can paint immediately after the async module load
  // without depending on effect-ordering against the setOption effect.
  const optionRef = useRef(option)
  optionRef.current = option

  // Legend "solo" interaction state: click isolates a series; modifier-click keeps the old toggle.
  const soloedRef = useRef<string | null>(null)
  const applyingRef = useRef(false)
  const modifierRef = useRef(false)

  // Whether the x-axis is currently zoomed in — drives the "Reset zoom" button's visibility.
  const [zoomed, setZoomed] = useState(false)

  const resetZoom = () => {
    const el = chartRef.current
    if (!el) return
    loadECharts().then(echarts =>
      echarts
        .getInstanceByDom(el)
        ?.dispatchAction({ type: 'dataZoom', start: 0, end: 100 })
    )
  }

  const resizeChart = useMemo(
    () =>
      debounce(() => {
        const el = chartRef.current
        if (!el) return
        loadECharts().then(echarts => echarts.getInstanceByDom(el)?.resize())
      }, 50),
    []
  )

  // 1. Initialize on mount, dispose on unmount. Register a ResizeObserver for layout changes.
  useEffect(() => {
    const el = chartRef.current
    if (!el) return
    let disposed = false
    let resizeObserver: ResizeObserver | null = null

    // Track modifier keys so a modifier-click on the legend keeps the default per-series toggle.
    const onKey = (e: KeyboardEvent) => {
      modifierRef.current = e.altKey || e.metaKey || e.ctrlKey
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKey)

    loadECharts().then(echarts => {
      if (disposed || !chartRef.current) return
      // StrictMode double-invokes effects; reuse an existing instance instead of leaking one.
      const chart = echarts.getInstanceByDom(el) ?? echarts.init(el)
      chart.setOption(optionRef.current, true)
      // Join the connect group so hovering/zooming one chart syncs the crosshair across all.
      if (group) {
        chart.group = group
        echarts.connect(group)
      }
      // Legend "solo": plain click isolates a series (mutes others); clicking it again restores
      // all. Modifier-click keeps ECharts' default toggle (mute/unmute individual series).
      chart.on('legendselectchanged', (p: any) => {
        if (applyingRef.current) return
        const names = Object.keys(p.selected || {})
        if (names.length <= 1) return
        if (modifierRef.current) {
          soloedRef.current = null
          return
        }
        const clicked = p.name
        applyingRef.current = true
        if (soloedRef.current === clicked) {
          soloedRef.current = null
          chart.dispatchAction({ type: 'legendAllSelect' })
        } else {
          soloedRef.current = clicked
          names.forEach(n =>
            chart.dispatchAction({
              type: n === clicked ? 'legendSelect' : 'legendUnSelect',
              name: n,
            })
          )
        }
        applyingRef.current = false
      })
      // Grafana-style range zoom: arm the toolbox dataZoom "select" cursor so a plain drag across
      // the plot picks a time window (no minimap/slider needed). echarts disarms the cursor after
      // each selection, so re-arm on every zoom to keep drag-to-select permanently available.
      const armRangeZoom = () =>
        chart.dispatchAction({
          type: 'takeGlobalCursor',
          key: 'dataZoomSelect',
          dataZoomSelectActive: true,
        })
      armRangeZoom()
      chart.on('datazoom', () => {
        armRangeZoom()
        // Reflect the current x-range in the reset button: shown whenever we're not at 0–100%.
        const dz: any = (chart.getOption() as any)?.dataZoom?.[0]
        setZoomed(!!dz && (dz.start > 0.01 || dz.end < 99.99))
      })
      // Double-click anywhere on the plot resets to the full range (connected charts reset too,
      // since the dataZoom action propagates through the connect group).
      chart.getZr().on('dblclick', () => {
        chart.dispatchAction({ type: 'dataZoom', start: 0, end: 100 })
      })
      resizeObserver = new ResizeObserver(() => resizeChart())
      resizeObserver.observe(el)
    })

    return () => {
      disposed = true
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKey)
      if (resizeObserver) {
        if (el) resizeObserver.unobserve(el)
        resizeObserver.disconnect()
      }
      loadECharts().then(echarts => {
        if (el) echarts.getInstanceByDom(el)?.dispose()
      })
    }
  }, [resizeChart, group])

  // 2. Re-render whenever the option changes (notMerge so removed series don't linger).
  useEffect(() => {
    const el = chartRef.current
    if (!el) return
    soloedRef.current = null // new data resets the legend to all series shown
    loadECharts().then(echarts =>
      echarts.getInstanceByDom(el)?.setOption(option, true)
    )
  }, [option])

  return (
    <div style={{ position: 'relative', ...style }}>
      <div ref={chartRef} style={{ width: '100%', height: '100%' }} />
      {zoomed && (
        <button
          type="button"
          onClick={resetZoom}
          // Theme-neutral overlay (semi-transparent grey works on both light and dark paper);
          // appears top-right only while zoomed in. Double-clicking the plot does the same thing.
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            zIndex: 1,
            font: 'inherit',
            fontSize: 12,
            lineHeight: 1,
            padding: '5px 10px',
            cursor: 'pointer',
            color: 'inherit',
            background: 'rgba(127,127,127,0.14)',
            border: '1px solid rgba(127,127,127,0.35)',
            borderRadius: 6,
            backdropFilter: 'blur(2px)',
          }}
        >
          Reset zoom
        </button>
      )}
    </div>
  )
}

export default EChart
