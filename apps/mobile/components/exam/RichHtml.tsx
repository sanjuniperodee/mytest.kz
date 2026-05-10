import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { StyleSheet, View, useWindowDimensions } from "react-native"
import WebView from "react-native-webview"
import type { WebView as WebViewType } from "react-native-webview"
import { useRichHtmlLayoutGate } from "@/lib/exam/rich-html-layout-gate"
import { useAppTheme } from "@/lib/theme/provider"
import type { Locale } from "@/lib/api/i18n"
import { renderRichTextHtml } from "@/lib/exam/rich-html"
import { KATEX_MIN_CSS } from "@/lib/exam/katex-inline-css"

function fnv1a32(input: string): string {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(36)
}

type Props = {
  value: unknown
  locale: Locale
  imageUrls?: string[]
  minHeight?: number
  /** Override body text color (e.g. selected answer row). */
  bodyColor?: string
  /**
   * Pixel width for HTML viewport / layout — prefer parent-measured column width so WebView
   * does not feed layout loops (options growing wider on each re-render / selection).
   */
  fixedContentWidth?: number
}

export function RichHtml({
  value,
  locale,
  imageUrls,
  minHeight = 80,
  bodyColor,
  fixedContentWidth,
}: Props) {
  const { colors } = useAppTheme()
  const layoutGate = useRichHtmlLayoutGate()
  const { width: screenW } = useWindowDimensions()
  const [contentHeight, setContentHeight] = useState(minHeight)
  const settledHeightRef = useRef(minHeight)
  const heightBurstMaxRef = useRef(minHeight)
  const heightDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const quietAfterHeightRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const slotReportedRef = useRef(false)
  const webRef = useRef<WebViewType>(null)

  const useFixed = typeof fixedContentWidth === "number" && fixedContentWidth > 0

  /** Без ожидания onLayout: при отсутствии fixedContentWidth — оценка по окну (или передайте fixedContentWidth с родителя). */
  const viewportWidth = useFixed
    ? Math.max(1, Math.floor(fixedContentWidth))
    : Math.max(240, Math.floor(screenW) - 48)

  const bodyHtml = useMemo(
    () => renderRichTextHtml(value, { locale, imageUrls }),
    [value, locale, imageUrls],
  )

  /** Текст і KaTeX — окремо від кольору рядка відповіді, щоб WebView не remount при виборі (без стрибків висоти). */
  const htmlDoc = useMemo(() => {
    if (!bodyHtml) return null
    return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=${viewportWidth}, initial-scale=1, maximum-scale=1"/>
<style>
${KATEX_MIN_CSS}
</style>
<style>
  * { box-sizing: border-box; }
  html {
    width: ${viewportWidth}px !important;
    max-width: ${viewportWidth}px !important;
    overflow-x: hidden !important;
    margin: 0;
    padding: 0;
  }
  body {
    width: ${viewportWidth}px !important;
    max-width: ${viewportWidth}px !important;
    overflow-x: hidden !important;
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 16px;
    line-height: 1.45;
    color: var(--exam-fg, ${colors.foreground});
    background: transparent;
    overflow-wrap: anywhere;
    word-break: break-word;
  }
  img.markdown-inline-image { max-width: 100% !important; height: auto; border-radius: 8px; margin: 8px 0; }
  .katex-display { margin: 8px 0; overflow-x: auto; max-width: 100%; box-sizing: border-box; }
</style></head><body>${bodyHtml}</body></html>`
  }, [bodyHtml, colors.foreground, viewportWidth])

  const webViewInstanceKey = useMemo(
    () => `${viewportWidth}:${bodyHtml.length}:${fnv1a32(bodyHtml)}`,
    [viewportWidth, bodyHtml],
  )

  const examFg = bodyColor ?? colors.foreground

  const applyExamFgAndMeasure = useCallback(() => {
    return `(function(){
      try {
        document.documentElement.style.setProperty('--exam-fg', ${JSON.stringify(examFg)});
        var h = Math.max(
          document.body.scrollHeight,
          document.documentElement.scrollHeight,
          document.body.offsetHeight || 0
        );
        window.ReactNativeWebView.postMessage(String(h));
      } catch (e) {}
      true;
    })();`
  }, [examFg])

  useEffect(() => {
    webRef.current?.injectJavaScript(applyExamFgAndMeasure())
  }, [applyExamFgAndMeasure])

  useEffect(() => {
    if (!bodyHtml && layoutGate) {
      layoutGate.reportSlotReady()
    }
  }, [bodyHtml, layoutGate])

  useEffect(() => {
    settledHeightRef.current = minHeight
    heightBurstMaxRef.current = minHeight
    setContentHeight(minHeight)
    slotReportedRef.current = false
    if (heightDebounceRef.current) {
      clearTimeout(heightDebounceRef.current)
      heightDebounceRef.current = null
    }
    if (quietAfterHeightRef.current) {
      clearTimeout(quietAfterHeightRef.current)
      quietAfterHeightRef.current = null
    }
  }, [htmlDoc, minHeight])

  useEffect(() => {
    return () => {
      if (heightDebounceRef.current) clearTimeout(heightDebounceRef.current)
      if (quietAfterHeightRef.current) clearTimeout(quietAfterHeightRef.current)
    }
  }, [])

  const scheduleQuietReport = useCallback(() => {
    if (!layoutGate || slotReportedRef.current) return
    if (quietAfterHeightRef.current) {
      clearTimeout(quietAfterHeightRef.current)
      quietAfterHeightRef.current = null
    }
    quietAfterHeightRef.current = setTimeout(() => {
      quietAfterHeightRef.current = null
      if (slotReportedRef.current) return
      slotReportedRef.current = true
      layoutGate.reportSlotReady()
    }, 480)
  }, [layoutGate])

  const onHeightMessage = useCallback(
    (raw: string) => {
      const h = Number(raw)
      if (!Number.isFinite(h) || h <= 0) return
      const next = Math.max(minHeight, Math.ceil(h) + 8)
      if (next > 16000) return
      heightBurstMaxRef.current = Math.max(heightBurstMaxRef.current, next)
      if (quietAfterHeightRef.current) {
        clearTimeout(quietAfterHeightRef.current)
        quietAfterHeightRef.current = null
      }
      if (heightDebounceRef.current) clearTimeout(heightDebounceRef.current)
      heightDebounceRef.current = setTimeout(() => {
        heightDebounceRef.current = null
        const final = heightBurstMaxRef.current
        if (Math.abs(final - settledHeightRef.current) >= 2 || settledHeightRef.current <= minHeight) {
          settledHeightRef.current = final
          setContentHeight(final)
        }
        heightBurstMaxRef.current = minHeight
        scheduleQuietReport()
      }, 160)
    },
    [minHeight, scheduleQuietReport],
  )

  if (!htmlDoc) return null

  const beforeLoaded = `(function(){
    try {
      document.documentElement.style.setProperty('--exam-fg', ${JSON.stringify(examFg)});
    } catch (e) {}
    true;
  })();`

  return (
    <View
      style={[
        styles.wrap,
        useFixed
          ? {
              height: Math.max(minHeight, contentHeight),
              width: viewportWidth,
              maxWidth: viewportWidth,
              alignSelf: "flex-start",
            }
          : {
              height: Math.max(minHeight, contentHeight),
            },
      ]}
    >
      <WebView
        ref={webRef}
        key={webViewInstanceKey}
        originWhitelist={["*"]}
        source={{ html: htmlDoc }}
        style={[
          styles.web,
          useFixed ? { width: viewportWidth, maxWidth: viewportWidth } : undefined,
        ]}
        scrollEnabled={false}
        nestedScrollEnabled
        setSupportMultipleWindows={false}
        onMessage={(e) => onHeightMessage(e.nativeEvent.data)}
        onLoadEnd={() => webRef.current?.injectJavaScript(applyExamFgAndMeasure())}
        injectedJavaScriptBeforeContentLoaded={beforeLoaded}
        injectedJavaScript={`
          (function(){
            var debounceMs = 100;
            var t = null;
            function measure(){
              try {
                var h = Math.max(
                  document.body.scrollHeight,
                  document.documentElement.scrollHeight,
                  document.body.offsetHeight || 0
                );
                window.ReactNativeWebView.postMessage(String(h));
              } catch(e) {}
            }
            function schedule(){
              if (t) clearTimeout(t);
              t = setTimeout(measure, debounceMs);
            }
            measure();
            window.addEventListener('load', schedule);
            document.addEventListener('readystatechange', function(){
              if (document.readyState === 'complete') schedule();
            });
            var imgs = document.getElementsByTagName('img');
            for (var i = 0; i < imgs.length; i++) {
              imgs[i].addEventListener('load', schedule);
              imgs[i].addEventListener('error', schedule);
            }
            requestAnimationFrame(function(){ schedule(); });
            setTimeout(schedule, 250);
            setTimeout(schedule, 700);
          })();
          true;
        `}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    maxWidth: "100%",
    alignSelf: "stretch",
    flexShrink: 1,
    overflow: "hidden",
  },
  web: {
    width: "100%",
    height: "100%",
    flexShrink: 1,
    backgroundColor: "transparent",
  },
})
