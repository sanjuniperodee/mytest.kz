import { useState } from "react"
import { LayoutChangeEvent, ScrollView, StyleSheet, View } from "react-native"

type Point = { attempt: number; score: number }

/** Минимальный шаг по X между точками; при большем числе попыток график ширится и листается горизонтально */
const MIN_GAP_X = 34

function Segment({
  x1,
  y1,
  x2,
  y2,
  stroke,
  strokeWidth,
}: {
  x1: number
  y1: number
  x2: number
  y2: number
  stroke: string
  strokeWidth: number
}) {
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.hypot(dx, dy)
  if (len < 0.5) return null
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI
  return (
    <View
      pointerEvents="none"
      style={[
        styles.segment,
        {
          left: x1,
          top: y1 - strokeWidth / 2,
          width: len,
          height: strokeWidth,
          backgroundColor: stroke,
          transformOrigin: "left center",
          transform: [{ rotate: `${angle}deg` }],
        },
      ]}
    />
  )
}

export function EntProgressLineChart({
  data,
  height,
  strokeColor,
  gridColor,
  dotFill,
  yDomainMax,
}: {
  data: Point[]
  height: number
  strokeColor: string
  gridColor: string
  dotFill: string
  /** When set, Y axis spans 0…max (e.g. raw ENT points). Default 100 (percent scale). */
  yDomainMax?: number
}) {
  const [viewportW, setViewportW] = useState(0)

  const padL = 36
  const padR = 12
  const padT = 12
  const padB = 28

  const onViewportLayout = (e: LayoutChangeEvent) => {
    setViewportW(e.nativeEvent.layout.width)
  }

  const viewportInner = Math.max(0, viewportW - padL - padR)
  const span = Math.max(1, data.length - 1)
  const minInnerForPoints = span * MIN_GAP_X
  const innerW =
    viewportW > 0 ? Math.max(viewportInner, minInnerForPoints) : 0
  const chartTotalW = innerW + padL + padR
  const needsHScroll = viewportW > 0 && chartTotalW > viewportW + 1

  const ymax = Math.max(1, yDomainMax ?? 100)

  const innerH = Math.max(0, height - padT - padB)

  const coords = data.map((d, i) => {
    const x =
      padL + (data.length <= 1 ? innerW / 2 : (i / Math.max(1, data.length - 1)) * innerW)
    const ratio = Math.min(1, Math.max(0, d.score / ymax))
    const y = padT + innerH * (1 - ratio)
    return { x, y }
  })

  const gridYs = [0, 25, 50, 75, 100].map((pct) => padT + innerH * (1 - pct / 100))

  const chartInner =
    viewportW > 0 && innerW > 0 ? (
      <View style={{ height, width: chartTotalW }} pointerEvents="box-none">
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {gridYs.map((gy, idx) => (
            <View
              key={`g-${idx}`}
              style={{
                position: "absolute",
                left: padL,
                top: gy,
                width: innerW,
                height: StyleSheet.hairlineWidth,
                backgroundColor: gridColor,
              }}
            />
          ))}
          {coords.map((c, i) => {
            if (i === 0) return null
            const prev = coords[i - 1]
            return (
              <Segment
                key={`s-${i}`}
                x1={prev.x}
                y1={prev.y}
                x2={c.x}
                y2={c.y}
                stroke={strokeColor}
                strokeWidth={3}
              />
            )
          })}
          {coords.map((c, i) => (
            <View
              key={`d-${i}`}
              pointerEvents="none"
              style={[
                styles.dot,
                {
                  left: c.x - 4,
                  top: c.y - 4,
                  backgroundColor: dotFill,
                  borderColor: strokeColor,
                },
              ]}
            />
          ))}
        </View>
      </View>
    ) : null

  return (
    <View style={{ width: "100%" }} onLayout={onViewportLayout}>
      {needsHScroll ? (
        <ScrollView
          horizontal
          nestedScrollEnabled
          showsHorizontalScrollIndicator
          bounces={false}
          keyboardShouldPersistTaps="handled"
        >
          {chartInner}
        </ScrollView>
      ) : (
        chartInner
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  segment: {
    position: "absolute",
    borderRadius: 1,
  },
  dot: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 2,
  },
})
