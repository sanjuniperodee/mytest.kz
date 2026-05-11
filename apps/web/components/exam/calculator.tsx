"use client"

import { useCallback, useEffect, useReducer, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { XIcon } from "lucide-react"
import { cn } from "@/lib/utils"

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

interface CalculatorProps {
  open: boolean
  onClose: () => void
}

export function Calculator({ open, onClose }: CalculatorProps) {
  const [state, dispatch] = useReducer(calcReducer, initialState)
  const [mounted, setMounted] = useState(false)
  /** Pointer, touch и click часто дают два события за один тап — одно действие. */
  const lastPadAt = useRef(0)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  const applyPad = useCallback(
    (action: CalcAction) => {
      const t = performance.now()
      if (t - lastPadAt.current < 35) return
      lastPadAt.current = t
      dispatch(action)
    },
    [dispatch],
  )

  const pad = useCallback(
    (
      label: string,
      action: CalcAction,
      className = "",
      ariaLabel?: string,
    ) => {
      return (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            applyPad(action)
          }}
          onPointerUp={(e) => {
            e.stopPropagation()
            if (e.pointerType === "mouse" && e.button !== 0) return
            applyPad(action)
          }}
          onTouchEnd={(e) => {
            e.stopPropagation()
            e.preventDefault()
            applyPad(action)
          }}
          onKeyDown={(e) => {
            if (e.key !== "Enter" && e.key !== " ") return
            e.preventDefault()
            e.stopPropagation()
            dispatch(action)
          }}
          aria-label={ariaLabel}
          className={cn(
            "flex h-14 w-full cursor-pointer touch-manipulation select-none items-center justify-center rounded-lg text-lg font-medium transition-colors active:bg-accent",
            className,
          )}
        >
          {label}
        </button>
      )
    },
    [applyPad, dispatch],
  )

  if (!mounted || !open) return null

  return createPortal(
    <div
      data-no-translate
      className="fixed inset-0 z-[10000] flex items-center justify-center p-2"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default border-0 bg-black/50 p-0"
        aria-label="Закрыть калькулятор"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="exam-calculator-title"
        className="relative z-10 w-[min(100vw-1rem,20rem)] rounded-xl border border-border bg-background p-0 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative border-b border-border px-4 pb-3 pt-4">
          <h2 id="exam-calculator-title" className="text-lg font-semibold leading-none">
            Калькулятор
          </h2>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onClose()
            }}
            onPointerUp={(e) => {
              e.stopPropagation()
              if (e.pointerType === "mouse" && e.button !== 0) return
              onClose()
            }}
            onTouchEnd={(e) => {
              e.stopPropagation()
              e.preventDefault()
              onClose()
            }}
            className="ring-offset-background focus:ring-ring absolute top-3 right-3 inline-flex rounded-md p-2 opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden"
            aria-label="Закрыть"
          >
            <XIcon className="size-4" />
          </button>
        </div>
        <div className="flex items-center justify-end border-b border-border bg-secondary px-3 py-2 text-2xl font-medium tabular-nums">
          {state.display}
        </div>

        <div className="grid grid-cols-4 gap-2 p-4">
          {pad("AC", { type: "clear" }, "bg-secondary hover:bg-secondary/80 text-sm")}
          {pad("⌫", { type: "back" }, "bg-secondary hover:bg-secondary/80")}
          {pad("÷", { type: "op", op: "/" }, "bg-secondary hover:bg-secondary/80")}
          {pad("×", { type: "op", op: "*" }, "bg-secondary hover:bg-secondary/80")}

          {pad("7", { type: "digit", d: "7" })}
          {pad("8", { type: "digit", d: "8" })}
          {pad("9", { type: "digit", d: "9" })}
          {pad("−", { type: "op", op: "-" }, "bg-secondary hover:bg-secondary/80")}

          {pad("4", { type: "digit", d: "4" })}
          {pad("5", { type: "digit", d: "5" })}
          {pad("6", { type: "digit", d: "6" })}
          {pad("+", { type: "op", op: "+" }, "bg-secondary hover:bg-secondary/80")}

          {pad("1", { type: "digit", d: "1" })}
          {pad("2", { type: "digit", d: "2" })}
          {pad("3", { type: "digit", d: "3" })}
          {pad("=", { type: "eq" }, "bg-foreground text-background hover:bg-foreground/90")}

          {pad("0", { type: "digit", d: "0" }, "col-span-2")}
          {pad(".", { type: "dot" })}
        </div>
      </div>
    </div>,
    document.body,
  )
}
