# The app, in parts

`src/app.js` is made by `python3 build.py` by joining these files in name order. They share one scope (the first file
opens it, the last closes it), so a name defined in one part can be used in the others. Edit these files, never `src/app.js`.

| File | What it holds |
| --- | --- |
| 00-core | Shared helpers, variables and default settings |
| 01-files | Loading COSMED and Lode files, starting a test |
| 02-compute | All calculations: averaging, outliers, left-out periods, stage values, regressions, suggestions |
| 03-test-details | Test details panel (type, data checks, presets) and the Stages block (chart editor, table, steps and blocks forms) |
| 04-tabs-guide | Tabs, guided steps, (i) pop-ups, rendering |
| 05-protocol | Protocol tab: stacked panels, zoom, panel heights, leaving out periods |
| 06-threshold-charts | Draggable VT/LT lines and fitted lines shared by the threshold charts |
| 07-incremental | Thresholds and VO₂peak tab |
| 08-oxynet | Oxynet input and charts |
| 09-step-tests | Step tests tab |
| 10-lactate | Lactate tab |
| 11-prolonged | Prolonged exercise tab |
| 12-summary | Summary tab, results table, methods paragraph |
| 13-reports | Word reports |
| 14-save-export | Save, open and export |
| 14b-what-to-look-for | "What to look for" reference charts (simulated example, VT1 and VT2 signs) |
| 15-undo-presets-start | Undo/redo, unsaved-work warning, lab presets, start-up |
