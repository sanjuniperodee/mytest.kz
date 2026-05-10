import { useReducer } from "react"
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native"
import { useAppTheme } from "@/lib/theme/provider"

type Op = "+" | "-" | "*" | "/"

interface CalcState {
  display: string
  stored: number | null
  pendingOp: Op | null
  fresh: boolean
}

type CalcAction =
  | { type: "digit"; d: string }
  | { type: "dot" }
  | { type: "op"; op: Op }
  | { type: "eq" }
  | { type: "clear" }
  | { type: "back" }

const initialState: CalcState = {
  display: "0",
  stored: null,
  pendingOp: null,
  fresh: true,
}

function compute(a: number, b: number, op: Op): number {
  switch (op) {
    case "+":
      return a + b
    case "-":
      return a - b
    case "*":
      return a * b
    case "/":
      return b === 0 ? NaN : a / b
  }
}

function formatDisplay(n: number): string {
  if (!Number.isFinite(n)) return "Error"
  const rounded = Number(n.toPrecision(12))
  if (!Number.isFinite(rounded)) return "Error"
  let s = String(rounded)
  if (s === "-0") s = "0"
  return s
}

function calcReducer(state: CalcState, action: CalcAction): CalcState {
  if (state.display === "Error" && action.type !== "clear" && action.type !== "back") {
    if (action.type === "digit") {
      return { ...initialState, display: action.d, fresh: false }
    }
    return state
  }

  switch (action.type) {
    case "digit": {
      const { d } = action
      if (state.fresh) {
        return { ...state, display: d === "." ? "0." : d, fresh: false }
      }
      if (d === "0" && state.display === "0") return state
      if (state.display === "0" && d !== ".") return { ...state, display: d }
      if (state.display.replace("-", "").length >= 14) return state
      return { ...state, display: state.display + d }
    }
    case "dot": {
      if (state.fresh) return { ...state, display: "0.", fresh: false }
      if (state.display.includes(".")) return state
      return { ...state, display: `${state.display}.` }
    }
    case "op": {
      const cur = parseFloat(state.display)
      if (!Number.isFinite(cur))
        return { display: "Error", stored: null, pendingOp: null, fresh: true }

      if (state.pendingOp !== null && state.stored !== null && !state.fresh) {
        const res = compute(state.stored, cur, state.pendingOp)
        if (!Number.isFinite(res)) {
          return { display: "Error", stored: null, pendingOp: null, fresh: true }
        }
        return {
          display: formatDisplay(res),
          stored: res,
          pendingOp: action.op,
          fresh: true,
        }
      }

      return {
        ...state,
        stored: cur,
        pendingOp: action.op,
        fresh: true,
      }
    }
    case "eq": {
      if (state.pendingOp === null || state.stored === null) {
        return { ...state, fresh: true }
      }
      const cur = parseFloat(state.display)
      if (!Number.isFinite(cur))
        return { display: "Error", stored: null, pendingOp: null, fresh: true }
      const res = compute(state.stored, cur, state.pendingOp)
      if (!Number.isFinite(res)) {
        return { display: "Error", stored: null, pendingOp: null, fresh: true }
      }
      return {
        display: formatDisplay(res),
        stored: null,
        pendingOp: null,
        fresh: true,
      }
    }
    case "clear":
      return initialState
    case "back": {
      if (state.fresh) return state
      if (state.display.length <= 1) return { ...state, display: "0", fresh: true }
      const next = state.display.slice(0, -1)
      return { ...state, display: next === "-" ? "0" : next }
    }
    default:
      return state
  }
}

function Key({
  label,
  onPress,
  emphasis,
  wide,
}: {
  label: string
  onPress: () => void
  emphasis?: boolean
  wide?: boolean
}) {
  const { colors } = useAppTheme()
  const bg = emphasis ? colors.foreground : colors.secondary
  const fg = emphasis ? colors.background : colors.foreground
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.key,
        wide && styles.keyWide,
        { backgroundColor: bg, opacity: pressed ? 0.88 : 1 },
      ]}
    >
      <Text style={[styles.keyText, { color: fg }]}>{label}</Text>
    </Pressable>
  )
}

export function Calculator({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const { colors } = useAppTheme()
  const [state, dispatch] = useReducer(calcReducer, initialState)

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.center}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.head, { borderColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.foreground }]}>Калькулятор</Text>
            <Pressable hitSlop={12} onPress={onClose} accessibilityLabel="Закрыть">
              <Text style={{ fontSize: 18, color: colors.mutedForeground }}>✕</Text>
            </Pressable>
          </View>
          <View style={[styles.display, { backgroundColor: colors.secondary }]}>
            <Text style={[styles.displayText, { color: colors.foreground }]}>
              {state.display}
            </Text>
          </View>

          <View style={styles.padWrap}>
            <View style={styles.row}>
              <Key label="AC" onPress={() => dispatch({ type: "clear" })} />
              <Key label="⌫" onPress={() => dispatch({ type: "back" })} />
              <Key label="÷" onPress={() => dispatch({ type: "op", op: "/" })} />
              <Key label="×" onPress={() => dispatch({ type: "op", op: "*" })} />
            </View>
            <View style={styles.row}>
              <Key label="7" onPress={() => dispatch({ type: "digit", d: "7" })} />
              <Key label="8" onPress={() => dispatch({ type: "digit", d: "8" })} />
              <Key label="9" onPress={() => dispatch({ type: "digit", d: "9" })} />
              <Key label="−" onPress={() => dispatch({ type: "op", op: "-" })} />
            </View>
            <View style={styles.row}>
              <Key label="4" onPress={() => dispatch({ type: "digit", d: "4" })} />
              <Key label="5" onPress={() => dispatch({ type: "digit", d: "5" })} />
              <Key label="6" onPress={() => dispatch({ type: "digit", d: "6" })} />
              <Key label="+" onPress={() => dispatch({ type: "op", op: "+" })} />
            </View>
            <View style={styles.row}>
              <Key label="1" onPress={() => dispatch({ type: "digit", d: "1" })} />
              <Key label="2" onPress={() => dispatch({ type: "digit", d: "2" })} />
              <Key label="3" onPress={() => dispatch({ type: "digit", d: "3" })} />
              <Key label="=" emphasis onPress={() => dispatch({ type: "eq" })} />
            </View>
            <View style={styles.row}>
              <Key label="0" wide onPress={() => dispatch({ type: "digit", d: "0" })} />
              <Key label="." onPress={() => dispatch({ type: "dot" })} />
              <View style={styles.spacer} />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    maxWidth: 400,
    alignSelf: "center",
    width: "100%",
  },
  head: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    fontSize: 17,
    fontWeight: "600",
  },
  display: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: "flex-end",
  },
  displayText: {
    fontSize: 26,
    fontVariant: ["tabular-nums"],
    fontWeight: "500",
  },
  padWrap: {
    padding: 12,
    gap: 8,
  },
  row: {
    flexDirection: "row",
    gap: 8,
  },
  key: {
    flex: 1,
    minHeight: 52,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  keyWide: {
    flex: 2,
  },
  spacer: {
    flex: 1,
  },
  keyText: {
    fontSize: 18,
    fontWeight: "600",
  },
})
