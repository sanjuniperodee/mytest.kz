import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { StyleSheet, View, useWindowDimensions } from "react-native"
import WebView from "react-native-webview"
import type { WebView as WebViewType } from "react-native-webview"
import { useRichHtmlLayoutGate } from "@/lib/exam/rich-html-layout-gate"
import { useAppTheme } from "@/lib/theme/provider"
import type { Locale } from "@/lib/api/i18n"
import { bodyHtmlNeedsKatexAssets, renderRichTextHtml } from "@/lib/exam/rich-html"
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
  /** Plain rich fragment (mutually exclusive with `passageStemSplit`). */
  value?: unknown
  /**
   * One WebView for passage + stem — halves cold start vs two instances when both exist.
   */
  passageStemSplit?: { passage: string; stem: string }
  locale: Locale
  imageUrls?: string[]
  minHeight?: number
  /** Override body text color (e.g. selected answer row). */
  bodyColor?: string
  /** Режим чтения: крупнее шрифт и интерлиньяж (разбор после теста). */
  readingComfort?: boolean
  /**
   * Pixel width for HTML viewport / layout — prefer parent-measured column width so WebView
   * does not feed layout loops (options growing wider on each re-render / selection).
   */
  fixedContentWidth?: number
  /** Унікальний id слота для RichHtmlLayoutGate (ідемпотентний звіт «готово»). */
  layoutSlotId?: string
}

export function RichHtml({
  value,
  passageStemSplit,
  locale,
  imageUrls,
  minHeight = 80,
  bodyColor,
  fixedContentWidth,
  layoutSlotId,
  readingComfort = false,
}: Props) {
  const { colors } = useAppTheme()
  const layoutGate = useRichHtmlLayoutGate()
  const { width: screenW } = useWindowDimensions()
  const [contentHeight, setContentHeight] = useState(minHeight)
  const settledHeightRef = useRef(minHeight)
  const heightBurstMaxRef = useRef(minHeight)
  const heightDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const quietAfterHeightRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const webRef = useRef<WebViewType>(null)

  const useFixed = typeof fixedContentWidth === "number" && fixedContentWidth > 0

  /** Без ожидания onLayout: при отсутствии fixedContentWidth — оценка по окну (или передайте fixedContentWidth с родителя). */
  const viewportWidth = useFixed
    ? Math.max(1, Math.floor(fixedContentWidth))
    : Math.max(240, Math.floor(screenW) - 48)

  const bodyHtml = useMemo(() => {
    if (passageStemSplit) {
      const pHtml = renderRichTextHtml(passageStemSplit.passage, { locale, imageUrls })
      const sHtml = renderRichTextHtml(passageStemSplit.stem, { locale, imageUrls })
      if (!pHtml && !sHtml) return ""
      if (!pHtml) return sHtml
      if (!sHtml) return pHtml
      return `<div class="exam-passage">${pHtml}</div><div class="exam-stem">${sHtml}</div>`
    }
    return renderRichTextHtml(value ?? "", { locale, imageUrls })
  }, [value, passageStemSplit, locale, imageUrls])

  /** Текст і KaTeX — окремо від кольору рядка відповіді, щоб WebView не remount при виборі (без стрибків висоти). */
  const htmlDoc = useMemo(() => {
    if (!bodyHtml) return null
    const katexCss = bodyHtmlNeedsKatexAssets(bodyHtml) ? KATEX_MIN_CSS : ""
    return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=${viewportWidth}, initial-scale=1, maximum-scale=1"/>
${katexCss ? `<style>\n${katexCss}\n</style>` : ""}
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
    font-size: ${readingComfort ? "17px" : "16px"};
    line-height: ${readingComfort ? "1.55" : "1.45"};
    letter-spacing: ${readingComfort ? "-0.012em" : "0"};
    color: var(--exam-fg, ${colors.foreground});
    background: transparent;
    overflow-wrap: anywhere;
    word-break: break-word;
    -webkit-font-smoothing: antialiased;
  }
  img.markdown-inline-image { max-width: 100% !important; height: auto; border-radius: 10px; margin: ${readingComfort ? "12px" : "8px"} 0; }
  .katex-display { margin: ${readingComfort ? "12px" : "8px"} 0; overflow-x: auto; max-width: 100%; box-sizing: border-box; }
  .katex { font-size: ${readingComfort ? "1.05em" : "1em"}; }
  .exam-passage {
    border-radius: 10px;
    border: 1px solid ${colors.border};
    background: ${colors.secondary}99;
    padding: 16px;
    margin: 0 0 16px 0;
    box-sizing: border-box;
  }
  .exam-stem { margin: 0; padding: 0; }
</style></head><body>${bodyHtml}</body></html>`
  }, [bodyHtml, colors.foreground, colors.border, colors.secondary, viewportWidth, readingComfort])

  const webViewInstanceKey = useMemo(
    () =>
      `${readingComfort ? "rc1" : "rc0"}:${passageStemSplit ? "ps1" : "ps0"}:${viewportWidth}:${bodyHtml.length}:${fnv1a32(bodyHtml)}`,
    [readingComfort, passageStemSplit, viewportWidth, bodyHtml],
  )

  const reportingId = layoutSlotId ?? webViewInstanceKey

  const examFg = bodyColor ?? colors.foreground

  /** Только колір — без postMessage, інакше WKWebView після кожного tap дає scrollHeight +1–2 px і рядок «росте». */
  const applyExamFgOnly = useCallback(() => {
    return `(function(){
      try {
        document.documentElement.style.setProperty('--exam-fg', ${JSON.stringify(examFg)});
      } catch (e) {}
      true;
    })();`
  }, [examFg])

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
    webRef.current?.injectJavaScript(applyExamFgOnly())
  }, [applyExamFgOnly])

  useEffect(() => {
    if (!bodyHtml) layoutGate?.reportSlotReady(reportingId)
  }, [bodyHtml, layoutGate, reportingId])

  useEffect(() => {
    settledHeightRef.current = minHeight
    heightBurstMaxRef.current = minHeight
    setContentHeight(minHeight)
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
    if (!layoutGate) return
    if (quietAfterHeightRef.current) {
      clearTimeout(quietAfterHeightRef.current)
      quietAfterHeightRef.current = null
    }
    quietAfterHeightRef.current = setTimeout(() => {
      quietAfterHeightRef.current = null
      layoutGate?.reportSlotReady(reportingId)
    }, 180)
  }, [layoutGate, reportingId])

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
      }, 72)
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
            var debounceMs = 48;
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
            requestAnimationFrame(function(){ requestAnimationFrame(schedule); });
            setTimeout(schedule, 120);
            setTimeout(schedule, 420);
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
