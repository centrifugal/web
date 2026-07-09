import { useMemo } from 'react'
import { alpha, useTheme } from '@mui/material/styles'

import { EChart } from './EChart'
import { TrendSeries, isInlineUnit, formatTrendValue } from './trendFormat'

// Categorical palette for stacked/multi-series trends. Leads with the theme primary so single-series
// charts match the rest of the UI (sparklines, leaderboard bars), then a balanced set that reads on
// both light and dark backgrounds.
const seriesPalette = (primary: string): string[] => [
  primary,
  '#22c3aa',
  '#f2a93b',
  '#e26d8a',
  '#9b7bd8',
  '#4aa3df',
  '#8bc34a',
  '#ef6f53',
  '#00acc1',
  '#c0ca33',
]

interface TimeSeriesChartProps {
  buckets: number[] // unix milliseconds
  series: TrendSeries[]
  unit?: string
  chartType?: 'line' | 'area' | 'bar'
  stacked?: boolean
  height?: number
  group?: string
}

// TimeSeriesChart builds the ECharts option for a trend (theme colors baked in so dark/light
// changes flow through a normal option update) and renders it via the generic EChart wrapper.
// Null data points render as gaps (no data) — what the backend emits for GapNull trends.
export const TimeSeriesChart = ({
  buckets,
  series,
  unit,
  chartType = 'line',
  stacked = false,
  height = 420,
  group,
}: TimeSeriesChartProps) => {
  const theme = useTheme()

  const option = useMemo(() => {
    const isDark = theme.palette.mode === 'dark'
    const textColor = theme.palette.text.primary
    const axisLineColor = theme.palette.divider
    const palette = seriesPalette(theme.palette.primary.main)
    const multiSeries = series.length > 1

    // Unit-aware formatting: scale bytes, suffix ms/%, SI-abbreviate counts. When the unit is
    // rendered inline per value (bytes/ms/%), drop the axis name to avoid "1.2 MB/s … B/s".
    const axisName = isInlineUnit(unit) ? '' : unit || ''
    // Reserve headroom for the axis name so it isn't clipped at the canvas top (the name renders
    // above the axis end); when there's no name, keep the plot tight.
    const gridTop = axisName ? 34 : 16

    // Wrapping (plain) legend instead of the scroll legend's single paginated row, so every series
    // is visible at once. Reserve bottom space for the wrapped rows so they don't overlap the plot;
    // ~3 items/row is a conservative estimate (long series names fit fewer). Capped so a large
    // series count can't swallow the whole plot — beyond the cap rows simply wrap tighter.
    const legendRows = multiSeries
      ? Math.min(4, Math.ceil(series.length / 3))
      : 0
    const legendHeight = legendRows * 24

    return {
      color: palette,
      // Initial paint gets a brief fade-in; data refreshes (filter/zoom/live update) snap in
      // place. echarts' default 1000ms left-to-right "sweep" re-runs on every setOption and reads
      // as flicker on a dashboard, so updates are instant and only the first render animates.
      animation: true,
      animationDuration: 260,
      animationEasing: 'cubicOut',
      animationDurationUpdate: 0,
      textStyle: { color: textColor },
      tooltip: {
        trigger: 'axis',
        // Follow the cursor with no easing — the default 0.4s transition makes the tooltip and
        // crosshair lag behind the pointer, which feels sluggish when scrubbing across the chart.
        transitionDuration: 0,
        hideDelay: 0,
        // Render the tooltip on <body> (not inside the chart div) so a MUI Card's overflow/stacking
        // context can't clip it or push it behind adjacent cards.
        appendToBody: true,
        // Place it on whichever side of the cursor has room (and clamp vertically) so a tall
        // multi-series tooltip never sits on top of the data being inspected.
        position: (
          point: number[],
          _p: unknown,
          _dom: unknown,
          _r: unknown,
          size: { contentSize: number[]; viewSize: number[] }
        ) => {
          const [x, y] = point
          const [tw, th] = size.contentSize
          const [vw, vh] = size.viewSize
          const left = x < vw / 2 ? x + 18 : x - tw - 18
          const top = Math.min(Math.max(8, y - th / 2), vh - th - 8)
          return [Math.max(8, left), top]
        },
        // animation:false → the crosshair jumps straight to the hovered point instead of gliding.
        axisPointer: {
          type: 'line',
          animation: false,
          lineStyle: { color: axisLineColor },
        },
        backgroundColor: theme.palette.background.paper,
        borderColor: theme.palette.divider,
        borderWidth: 1,
        padding: [8, 12],
        textStyle: { color: textColor, fontSize: 12 },
        extraCssText: `border-radius:8px;box-shadow:0 4px 18px ${alpha(
          '#000',
          isDark ? 0.5 : 0.18
        )};`,
        formatter: (params: any[]) => {
          if (!params || params.length === 0) return ''
          const header = `<div style="font-size:11px;opacity:0.6;margin-bottom:4px">${new Date(
            params[0].axisValue
          ).toLocaleString()}</div>`
          const rows = params
            .map(p => {
              const raw = Array.isArray(p.value) ? p.value[1] : p.value
              if (raw === null || raw === undefined) return ''
              return `${p.marker} ${p.seriesName}: <b>${formatTrendValue(
                raw,
                unit
              )}</b>`
            })
            .filter(Boolean)
          return header + rows.join('<br/>')
        },
      },
      // Legend at the very bottom — keeps the top free so the y-axis unit name never collides
      // with it.
      legend: {
        show: multiSeries,
        bottom: 0,
        type: 'plain',
        textStyle: { color: textColor },
      },
      grid: {
        left: 64,
        right: 24,
        top: gridTop,
        // No slider anymore: room for the x-axis labels (24), plus the wrapped legend rows.
        bottom: 24 + legendHeight,
      },
      xAxis: {
        type: 'time',
        axisLine: { lineStyle: { color: axisLineColor } },
        axisTick: { show: false },
        axisLabel: { color: textColor, hideOverlap: true },
      },
      yAxis: {
        type: 'value',
        name: axisName,
        nameGap: 14,
        nameTextStyle: { color: textColor, align: 'left' },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: axisLineColor, type: 'dashed' } },
        axisLabel: {
          color: textColor,
          formatter: (value: number) => formatTrendValue(value, unit),
        },
      },
      // Grafana-style range zoom: drag across the plot to select a time window (no minimap). The
      // toolbox dataZoom feature provides the rubber-band select; EChart arms it via the global
      // cursor. The feature must stay show:true — the toolbox skips a hidden feature's view, which
      // is what builds the brush controller — so instead the icon is made invisible with
      // itemSize:0 / showTitle:false. yAxisIndex:false keeps the drag to the x (time) axis only.
      toolbox: {
        itemSize: 0,
        showTitle: false,
        feature: {
          dataZoom: { yAxisIndex: false },
        },
      },
      dataZoom: [
        // Holds the x-axis zoom state that the drag-select writes to. Wheel/drag-pan are off so
        // the gesture is unambiguously "select a range" and page scrolling is never hijacked.
        {
          type: 'inside',
          zoomOnMouseWheel: false,
          moveOnMouseWheel: false,
          moveOnMouseMove: false,
        },
      ],
      series: series.map((s, idx) => {
        const c = palette[idx % palette.length]
        // Area fill rules: stacked → flat tint (bands stay legible); a single series → vertical
        // gradient for depth; multiple *overlaid* (unstacked) series → no fill (plain lines), since
        // overlapping fills would occlude each other.
        const areaStyle =
          chartType === 'area' && (stacked || !multiSeries)
            ? stacked
              ? { color: alpha(c, isDark ? 0.38 : 0.28) }
              : {
                  color: {
                    type: 'linear',
                    x: 0,
                    y: 0,
                    x2: 0,
                    y2: 1,
                    colorStops: [
                      { offset: 0, color: alpha(c, isDark ? 0.5 : 0.4) },
                      { offset: 1, color: alpha(c, 0.02) },
                    ],
                  },
                }
            : undefined
        return {
          name: s.name,
          type: chartType === 'bar' ? 'bar' : 'line',
          stack: stacked ? 'total' : undefined,
          itemStyle: {
            color: c,
            borderRadius: chartType === 'bar' && !stacked ? [3, 3, 0, 0] : 0,
          },
          lineStyle: chartType === 'bar' ? undefined : { width: 2 },
          areaStyle,
          showSymbol: false,
          smooth: false,
          connectNulls: false,
          // Highlight the hovered line (thicken it) but do NOT blur the others — dimming every
          // other series on hover made comparison jumpy and hid the data you weren't pointing at.
          emphasis: { focus: 'none', lineStyle: { width: 3 } },
          blur: { lineStyle: { opacity: 1 }, areaStyle: { opacity: 1 } },
          data: buckets.map((b, i) => [b, s.data[i] ?? null]),
        }
      }),
    }
  }, [buckets, series, unit, chartType, stacked, theme])

  return (
    <EChart option={option} style={{ width: '100%', height }} group={group} />
  )
}

export default TimeSeriesChart
