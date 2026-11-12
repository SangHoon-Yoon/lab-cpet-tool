# History of changes

Newest first. Version numbers read major.minor.patch: the middle number goes up for new features, the last for fixes
and small changes. The first stays 0 until the tool is ready for the whole lab. `git log` has every commit.

| Date | Version | Change |
| --- | --- | --- |
| 2026-11-13 | 0.25.0 | Lactate tab: chart under the table with LT1 and LT2 beside it; the chart marks only the two starting methods, with tick boxes for the others; arrow keys move up and down the table. Reports: optional end-tidal CO₂ (PETCO₂) figure; protocol text no longer reads an unfinished last stage as shorter stages. "Prolonged trial with step tests" renamed Durability test |
| 2026-11-13 | 0.24.0 | Lactate tab: the settings above the charts work again (curve fit, baseline in the fit, starting methods, show every method); Enter moves down a row; Add a row stays in place above the table; no rows for shorter stages at the end; resting sample labelled Baseline on the x-axis; chart height can be changed. Reports: choose which figures go in each report. Threshold status wraps inside its box on narrow windows |
| 2026-11-11 | 0.23.4 | "What to look for" reference charts at VT1 and VT2 (schematic, from the simulated model, based on Keir et al. 2022); example model refined (VE/VCO2, PETCO2 and PETO2 change before VT1, lactate flat until VT1); analysis-window chart framed |
| 2026-11-11 | 0.22.0 | Try an example test (simulated incremental cycling test with lactate; not a real person) and download the example file; "a tool to help, not to rely on" caveat on the start page, Summary, footer, research report and README |
| 2026-11-11 | 0.21.1 | Website live on GitHub Pages; report heading defaults to "Exercise test report" and is remembered per computer; institution, clinic name and participant codes removed from the public code and its history |
| 2026-11-11 | 0.21.0 | Threshold status (suggested, not checked / checked) with Confirm buttons, shown in the summary, export and reports; code split into 16 parts (built file unchanged); MIT licence, citation file and website setup |
| 2026-11-10 | 0.20.2 | Steps form closes after Apply and shows the applied steps; Data checks and Lab presets fold; Protocol panels resize while dragging |
| 2026-11-10 | 0.20.1 | Heart rate, power at VT, export and report use the time a VT line was dragged to on a time chart |
| 2026-11-10 | 0.20.0 | Leave out periods of bad data (all protocols); Protocol panels framed and resized by dragging; Oxynet ignores outlier breaths (fixes a file with extreme breaths); smooth line dragging on time charts; bolder tabs; prompt to enter steps; home button on the right |
| 2026-11-10 | 0.19.0 | Lab presets (save, apply on load, export and import); guided steps; paste lactate from Excel |
| 2026-11-10 | 0.18.1 | Lactate thresholds and copy buttons moved under the lactate chart |
| 2026-11-10 | 0.18.0 | Word reports: client report from the clinic template, and a research report |
| 2026-11-10 | 0.17.0 | Lactate tab with all lactater (Exphyslab) methods; LT lines; copy between LT and VT |
| 2026-11-10 | 0.16.0 | Undo and redo (Ctrl+Z); warning before closing with unsaved work |
| 2026-11-10 | 0.15.0 | Resizable Protocol panels; optional shorter stages; outlier rule in an i pop-up |
| 2026-11-09 | 0.14.0 | Oxynet charts: Use these lines button and model explanations |
| 2026-11-09 | 0.13.1 | Incremental tab renamed Thresholds and VO₂peak (or VO₂max) |
| 2026-11-09 | 0.13.0 | Incremental: highlight the analysis window on a time chart |
| 2026-11-09 | 0.12.3 | Shorter stages start at an intensity, with the same increment |
| 2026-11-09 | 0.12.2 | Remove a wrongly added file; Test details start closed |
| 2026-11-09 | 0.12.1 | Summary sections open and close |
| 2026-11-09 | 0.12.0 | Editable highlights; i pop-ups for instructions |
| 2026-11-09 | 0.11.0 | Step tests: a separate data range for each test |
| 2026-11-09 | 0.10.0 | Step tests: choose data on a time chart; optional VT2 lines |
| 2026-11-05 | 0.9.0 | Option to leave out the start of the first stage |
| 2026-11-05 | 0.8.0 | Every incremental stage included by default |
| 2026-11-05 | 0.7.0 | Home button on every figure |
| 2026-11-05 | 0.6.0 | Threshold phase followed by a VO₂max phase |
| 2026-11-04 | 0.5.0 | Protocol chart tools and outlier handling refined |
| 2026-11-04 | 0.4.0 | Prolonged exercise analysis; live threshold dragging |
| 2026-11-04 | 0.3.0 | First version in this repository: loading COSMED and Lode files, Protocol chart, incremental thresholds with Oxynet, step-test analysis (0.1 and 0.2 were earlier drafts) |

## Notes on some releases

- **0.20.0 Oxynet and extreme breaths.** One sample file had single breaths with VO₂ of 0 and 10 L/min and PETCO₂ of
  5 mmHg. Oxynet rescales each input to 0–1 using its minimum and maximum, so one extreme breath squeezed every
  other value together and the suggestions went wrong. Oxynet input now always leaves out flagged outlier breaths.
  On that file: CNN 3.73 / 3.87 L/min, LSTM 3.57 / 4.37 L/min (VT1 / VT2).
- **0.20.1 Dragging on time charts.** The time axis maps to VO₂ through a cumulative maximum (so VO₂ never goes down).
  Plateaus in that map made lines jump; the dragged time is now kept (`S.picks.incT`, helper `vtTime`) and used for
  heart rate, power, export and reports.
- **0.21.0 Code split.** `src/app.js` became 16 ordered parts in `src/app/`; the built file was checked byte-identical.
- **0.21.1 Privacy clean-up.** The repository went public. A participant name fragment, participant codes and the
  clinic name were removed from all files and the whole git history (rewritten and force-pushed); old workflow runs
  were deleted. Sample files were renamed locally to match.
- **0.23.x "What to look for".** Original schematic charts drawn from the example model, not copied from the paper
  (the paper is not open access, so its figures are not reproduced). Shapes follow Keir et al. (2022) Fig. 2:
  VE/VCO₂ falls to VT1, PETCO₂ rises to VT1 (axis 25–45 mmHg as in the paper), PETO₂ falls in a straight line to
  VT1, lactate flat until VT1.
- **After 0.23.4 (not a release).** Tests made portable (`test/paths.js`, `npm test`), and the user guide and this
  history moved into the repository, to continue the work in Claude Code.
