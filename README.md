# Lab CPET tool

Browser-based analysis of cardiopulmonary exercise tests.

**Created by SangHoon Yoon.** © 2026 SangHoon Yoon. Free to use and adapt under the [MIT licence](LICENSE), keeping this credit. To cite it, use [CITATION.cff](CITATION.cff) (GitHub's "Cite this repository" button). Third-party parts and their licences: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

**Use it online:** https://sanghoon-yoon.github.io/lab-cpet-tool/ (or download `dist/lab-cpet-tool.html` and open it offline). Your data never leave your browser: the page has no server and sends nothing anywhere.

> **A tool to help, not to rely on.** Suggested thresholds and fits only assist. Always look at the data yourself, place and check every threshold, and confirm results against your usual method. Not a medical device.

**Try it without your own data:** on the start page, choose "Try an example test" (a simulated incremental cycling test with lactate; not a real person).

Single-file browser tool for COSMED gas-exchange tests. Open `dist/lab-cpet-tool.html`; it runs offline and no data leave the computer.

- Treadmill: COSMED export only (speed comes from that file). Cycling: COSMED and Lode exports, or COSMED with the power steps entered by hand.
- A session recorded as several COSMED files is joined by the clock times in the file headers.
- Incremental tests: VO2peak, VT1, VT2, stage table, maximal-effort criteria, Oxynet suggestions. Without a Lode file, enter the power steps by hand.
- Incremental tests with a separate VO2max phase: thresholds from the longer stages, then VO2max from shorter stages after a recovery block.
- Prolonged trials with step tests: any number of steps and step length, VT1 per test, stage comparison, and analysis of each gas recording during the steady exercise (oxidation, energy, efficiency or economy, drift).
- Export: Excel (long format, stages, thresholds, checks, settings, methods) and long-format CSV.

Develop: edit `src/` (the app itself is in `src/app/`, see its README), then run `python3 build.py`. Every push to `main` republishes the website. Tests: `node test/run.js`; `test/e2e.js` and `test/e2e2.js` need Playwright. The tests read participant sample files that are deliberately not in this repository.
`src/gdcore.js` and `src/parse.js` started from the GlyDurability2026 app. Plotly 2.35.2 (gl2d bundle, MIT) and SheetJS 0.18.5 (Apache 2.0) are in `vendor/`. Oxynet models come from pyoxynet 1.0.2 (Andrea Zignoli and the Oxynet team, MIT); `tools/export_oxynet.py` converts them and `src/oxynet.js` runs them.
