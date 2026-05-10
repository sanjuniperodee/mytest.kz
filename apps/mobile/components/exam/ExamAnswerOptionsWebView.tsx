import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { StyleSheet, View } from "react-native"
import WebView from "react-native-webview"
import type { WebView as WebViewType } from "react-native-webview"
import { useRichHtmlLayoutGate } from "@/lib/exam/rich-html-layout-gate"
import type { Locale } from "@/lib/api/i18n"
import { resolveMediaUrl } from "@/lib/api/client"
import type { AnswerOption } from "@/lib/api/types"
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

function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;")
}

export type ExamOptionThemeColors = {
  foreground: string
  background: string
  card: string
  border: string
  mutedForeground: string
  secondary: string
}

type Props = {
  questionId: string
  layoutSlotId: string
  options: AnswerOption[]
  locale: Locale
  imageUrls?: string[]
  fixedContentWidth: number
  colors: ExamOptionThemeColors
  selectedIds: string[]
  minHeight?: number
  onOptionPress: (optionId: string) => void
}

export function ExamAnswerOptionsWebView({
  questionId,
  layoutSlotId,
  options,
  locale,
  imageUrls,
  fixedContentWidth,
  colors,
  selectedIds,
  minHeight = 72,
  onOptionPress,
}: Props) {
  const layoutGate = useRichHtmlLayoutGate()
  const webRef = useRef<WebViewType>(null)
  const [contentHeight, setContentHeight] = useState(minHeight)
  const settledHeightRef = useRef(minHeight)
  const heightBurstMaxRef = useRef(minHeight)
  const heightDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const quietAfterHeightRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const viewportWidth = Math.max(1, Math.floor(fixedContentWidth))

  const optionsMarkup = useMemo(() => {
    if (options.length === 0) return ""
    const rows: string[] = []
    for (let i = 0; i < options.length; i++) {
      const opt = options[i]!
      const letter = String.fromCharCode(65 + i)
      const body = renderRichTextHtml(opt.content ?? opt.text, { locale, imageUrls })
      const idAttr = escapeAttr(opt.id)
      let extra = ""
      if (opt.imageUrl && String(opt.imageUrl).trim()) {
        const src = escapeAttr(resolveMediaUrl(String(opt.imageUrl).trim()))
        extra = `<div class="exam-opt-extra-img"><img class="markdown-inline-image" src="${src}" alt="" /></div>`
      }
      rows.push(
        `<div class="exam-opt-row" data-opt-id="${idAttr}" role="button" tabindex="0">` +
          `<div class="exam-opt-letter">${letter}</div>` +
          `<div class="exam-opt-body">${body || " "}</div>` +
          extra +
          `</div>`,
      )
    }
    return rows.join("")
  }, [options, locale, imageUrls])

  const htmlDoc = useMemo(() => {
    if (!optionsMarkup) return null
    const katexCss = bodyHtmlNeedsKatexAssets(optionsMarkup) ? KATEX_MIN_CSS : ""
    const c = colors
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
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    -webkit-font-smoothing: antialiased;
    background: transparent;
  }
  .exam-opt-list { display: flex; flex-direction: column; gap: 8px; width: 100%; }
  .exam-opt-row {
    display: flex;
    flex-direction: row;
    align-items: flex-start;
    gap: 12px;
    border-radius: 10px;
    border: 1px solid ${c.border};
    background: ${c.card};
    padding: 12px 16px;
    -webkit-tap-highlight-color: transparent;
    cursor: pointer;
    touch-action: manipulation;
    color: ${c.foreground};
    max-width: 100%;
  }
  .exam-opt-row.exam-opt-on {
    border-color: ${c.foreground};
    background: ${c.foreground};
    color: ${c.background};
  }
  .exam-opt-letter {
    flex-shrink: 0;
    margin-top: 2px;
    width: 24px;
    height: 24px;
    border-radius: 12px;
    border: 1px solid ${c.border};
    background: ${c.secondary};
    color: ${c.mutedForeground};
    font-size: 11px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .exam-opt-row.exam-opt-on .exam-opt-letter {
    border-color: ${c.background};
    background: ${c.background};
    color: ${c.foreground};
  }
  .exam-opt-body {
    flex: 1;
    min-width: 0;
    font-size: 16px;
    line-height: 1.45;
    overflow-wrap: anywhere;
    word-break: break-word;
  }
  .exam-opt-body .katex-display { margin: 8px 0; overflow-x: auto; max-width: 100%; }
  img.markdown-inline-image {
    max-width: 100% !important;
    height: auto;
    border-radius: 10px;
    margin: 8px 0;
  }
  .exam-opt-extra-img { width: 100%; }
</style></head><body><div class="exam-opt-list">${optionsMarkup}</div></body></html>`
  }, [optionsMarkup, viewportWidth, colors])

  const webViewInstanceKey = useMemo(
    () => `examopts:${questionId}:${viewportWidth}:${fnv1a32(optionsMarkup)}`,
    [questionId, viewportWidth, optionsMarkup],
  )

  const applySelectionJs = useCallback(
    (ids: string[]) => {
      return `(function(){
        try {
          var ids = ${JSON.stringify(ids)};
          var set = {};
          for (var i = 0; i < ids.length; i++) set[ids[i]] = true;
          document.querySelectorAll('.exam-opt-row').forEach(function(row){
            var id = row.getAttribute('data-opt-id');
            if (id && set[id]) row.classList.add('exam-opt-on');
            else row.classList.remove('exam-opt-on');
          });
        } catch (e) {}
        true;
      })();`
    },
    [],
  )

  const applyMeasureJs = useCallback(() => {
    return `(function(){
      try {
        var h = Math.max(
          document.body.scrollHeight,
          document.documentElement.scrollHeight,
          document.body.offsetHeight || 0
        );
        window.ReactNativeWebView.postMessage(String(h));
      } catch (e) {}
      true;
    })();`
  }, [])

  useEffect(() => {
    webRef.current?.injectJavaScript(applySelectionJs(selectedIds))
  }, [applySelectionJs, selectedIds])

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
      layoutGate?.reportSlotReady(layoutSlotId)
    }, 180)
  }, [layoutGate, layoutSlotId])

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

  const onMessage = useCallback(
    (data: string) => {
      const t = data.trimStart()
      if (t.startsWith("{")) {
        try {
          const msg = JSON.parse(data) as { t?: string; id?: string }
          if (msg.t === "opt" && typeof msg.id === "string") onOptionPress(msg.id)
        } catch {
          /* ignore */
        }
        return
      }
      onHeightMessage(data)
    },
    [onHeightMessage, onOptionPress],
  )

  useEffect(() => {
    if (!htmlDoc && layoutGate) layoutGate.reportSlotReady(layoutSlotId)
  }, [htmlDoc, layoutGate, layoutSlotId])

  if (!htmlDoc) return null

  const clickBridge = `
(function(){
  document.addEventListener('click', function(e){
 var row = e.target && e.target.closest ? e.target.closest('.exam-opt-row') : null;
    if (!row) return;
    var id = row.getAttribute('data-opt-id');
    if (id) window.ReactNativeWebView.postMessage(JSON.stringify({t:'opt',id:id}));
  }, true);
  true;
})();`

  const injectedMeasure = `
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
})();`

  return (
    <View
      style={[
        styles.wrap,
        {
          height: Math.max(minHeight, contentHeight),
          width: viewportWidth,
          maxWidth: viewportWidth,
          alignSelf: "flex-start",
        },
      ]}
    >
      <WebView
        ref={webRef}
        key={webViewInstanceKey}
        originWhitelist={["*"]}
        source={{ html: htmlDoc }}
        style={[styles.web, { width: viewportWidth, maxWidth: viewportWidth }]}
        scrollEnabled={false}
        nestedScrollEnabled
        setSupportMultipleWindows={false}
        onMessage={(e) => onMessage(e.nativeEvent.data)}
        onLoadEnd={() => {
          const w = webRef.current
          if (!w) return
          w.injectJavaScript(applySelectionJs(selectedIds))
          w.injectJavaScript(applyMeasureJs())
        }}
        injectedJavaScript={`${clickBridge}\n${injectedMeasure}\ntrue;`}
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
