import { useEffect, useMemo, useRef, useState } from "react"
import {
  type GestureResponderEvent,
  LayoutChangeEvent,
  PanResponder,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native"

function snapStep(value: number, step: number, min: number, max: number): number {
  const n = Math.round(value / step) * step
  return Math.max(min, Math.min(max, n))
}

const THUMB = 22
const TRACK_H = 5

type Props = {
  value: number
  minimumValue: number
  maximumValue: number
  step: number
  onValueChange: (v: number) => void
  onSlidingComplete?: (v: number) => void
  minimumTrackTintColor: string
  maximumTrackTintColor: string
  thumbTintColor: string
  style?: StyleProp<ViewStyle>
}

/** Slider without native RNCSlider — works when community slider isn’t linked (e.g. New Architecture builds). */
export function StepSlider({
  value,
  minimumValue,
  maximumValue,
  step,
  onValueChange,
  onSlidingComplete,
  minimumTrackTintColor,
  maximumTrackTintColor,
  thumbTintColor,
  style,
}: Props) {
  const [trackW, setTrackW] = useState(0)
  const trackWRef = useRef(0)
  const valueRef = useRef(value)
  const onValueChangeRef = useRef(onValueChange)
  const onSlidingCompleteRef = useRef(onSlidingComplete)

  useEffect(() => {
    valueRef.current = value
  }, [value])
  useEffect(() => {
    onValueChangeRef.current = onValueChange
  }, [onValueChange])
  useEffect(() => {
    onSlidingCompleteRef.current = onSlidingComplete
  }, [onSlidingComplete])

  const applyFromLocationX = (x: number) => {
    const w = trackWRef.current
    const usable = Math.max(1, w - THUMB)
    const ratio = Math.max(0, Math.min(1, (x - THUMB / 2) / usable))
    const raw = minimumValue + ratio * (maximumValue - minimumValue)
    const next = snapStep(raw, step, minimumValue, maximumValue)
    if (next !== valueRef.current) {
      valueRef.current = next
      onValueChangeRef.current(next)
    }
  }

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_: GestureResponderEvent, g) =>
          Math.abs(g.dx) > 2 || Math.abs(g.dy) > 2,
        onPanResponderGrant: (e) => {
          applyFromLocationX(e.nativeEvent.locationX)
        },
        onPanResponderMove: (e) => {
          applyFromLocationX(e.nativeEvent.locationX)
        },
        onPanResponderRelease: () => {
          onSlidingCompleteRef.current?.(valueRef.current)
        },
        onPanResponderTerminate: () => {
          onSlidingCompleteRef.current?.(valueRef.current)
        },
      }),
    [maximumValue, minimumValue, step, trackW],
  )

  const onTrackLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width
    trackWRef.current = w
    setTrackW(w)
  }

  const span = Math.max(1e-6, maximumValue - minimumValue)
  const usable = Math.max(1, trackW - THUMB)
  const ratio = (value - minimumValue) / span
  const thumbLeft = ratio * usable
  const fillW = THUMB / 2 + thumbLeft

  return (
    <View style={[styles.wrap, style]} onLayout={onTrackLayout} {...panResponder.panHandlers}>
      <View style={[styles.track, { backgroundColor: maximumTrackTintColor }]}>
        <View style={[styles.fill, { width: fillW, backgroundColor: minimumTrackTintColor }]} />
      </View>
      <View
        pointerEvents="none"
        style={[
          styles.thumb,
          {
            left: thumbLeft,
            backgroundColor: thumbTintColor,
            borderColor: minimumTrackTintColor,
          },
        ]}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    height: 40,
    justifyContent: "center",
    position: "relative",
  },
  track: {
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
    overflow: "hidden",
  },
  fill: {
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
  },
  thumb: {
    position: "absolute",
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    top: (40 - THUMB) / 2,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
})
