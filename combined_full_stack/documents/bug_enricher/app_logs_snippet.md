# Application logs — export job — 2025-03-18T14:32:01Z

```
2025-03-18T14:32:01.204Z INFO  export.start user=jchen reportId=rpt-q1-2025 format=pdf
2025-03-18T14:32:01.891Z DEBUG chart.render count=12 engine=canvas
2025-03-18T14:32:45.102Z WARN  chart.render slow frameMs=420 chartId=rev-trend
2025-03-18T14:33:12.440Z ERROR pdf.fontLoad Failed to load embedded font "Inter-SemiBold" — CORS blocked
2025-03-18T14:33:12.441Z ERROR export.fail reportId=rpt-q1-2025 err=FontLoadError
2025-03-18T14:33:12.502Z ERROR window.onerror Uncaught TypeError: Cannot read properties of null (reading 'removeChild')
    at cleanupOverlay (export-overlay.tsx:88)
    at onExportFail (export-overlay.tsx:102)
```

**User agent:** Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15
