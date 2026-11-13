# Lab CPET Tool: User Guide

> This copy lives in the repository and is the one to keep up to date. (It began as a Claude Doc.)

Version 0.27.0 · Created by SangHoon Yoon · Nov 4, 2026

## **Before you start**

The Lab CPET tool shows your COSMED data and helps you find VT1, VT2 and VO₂peak. You make the final threshold decisions; the tool only offers suggestions.

Open https://sanghoon-yoon.github.io/lab-cpet-tool/, or save `lab-cpet-tool.html` and open it in Chrome, Edge, Firefox or Safari. There is nothing to install, it works without internet, and your data stay on your computer.

**Validate your results.** This tool is new, so check its results against your original method (for example, exphyslab.com or Excel) before relying on them.

**A tool to help, not to rely on.** Suggested thresholds and fits only assist you. Always look at the data yourself, place and check every threshold, and confirm results against your usual method.

**Use it online or try an example.** Open https://sanghoon-yoon.github.io/lab-cpet-tool/ for the latest version. With no file at hand, click **Try an example test** on the start page: a simulated incremental cycling test (not a real person) with lactate already filled in. **Download the example file** gives the same test as a COSMED-style Excel file.

**The start page.** Three short questions come before the files. Click an answer to choose it, and click it again to clear it. Your last answers are remembered on your computer.

1. **Which test?** Incremental test; Submaximal test, then VO₂max test; or Durability test (5-step tests before and after prolonged exercise).
2. **Running or cycling?**
3. **Which data do you have?** (incremental tests only) Gas only, Gas and lactate, or Lactate only. Gas only hides the Lactate tab. Lactate only hides the gas thresholds tab.

Then add the files and click **Continue**. You can also skip the questions and just add the files: the tool then works the test out from the file, and shows every tab. If the file does not match your answer (for example you chose running but the file holds cycling power), the tool tells you.

**Lactate only, with no gas file.** Choose **Lactate only** and click **Continue without a gas file**. In **Test details**, type the name, then enter the stages under **Incremental test steps** (starting speed or power, increment, stage length, and the time the test ended) and click **Apply steps**. The **Lactate** tab then has a row for each stage: type the lactate, heart rate and RPE values. The Summary tab gives the thresholds and both reports. If you do have the COSMED export, add it instead: heart rate and RPE (from the Marker column) are then filled in for each stage.

**Which guide do I follow?**

| Your test | Follow | Files to load |
| --- | --- | --- |
| Incremental test (GXT) on a treadmill | Guide A | COSMED file |
| Incremental test (GXT) on a bike | Guide A | COSMED file, plus the Lode file if you saved it |
| Durability test (5-step tests before and after prolonged exercise) on a treadmill | Guide B | All COSMED files from the session |
| Durability test (5-step tests before and after prolonged exercise) on a bike | Guide B | COSMED file and Lode file |

Export breath-by-breath COSMED files when you can. They allow the most averaging and cleaning options.

**Moving around the Protocol chart (both guides)**

| To do this | Do this |
| --- | --- |
| Choose what to see | Click the variable buttons above the chart (up to 6) |
| Zoom in or out | Scroll over the chart, or choose the zoom tool at its top right and drag across a period |
| Move along the test | Choose the move tool and drag the chart, or drag the handles on the strip below it |
| Jump to part of the test | Use the Go to buttons |
| Go back to the whole test | Double-click the chart |
| Read exact values | Move the cursor over the chart; values appear above it |
| Change the smoothing | Use the Averaging menu |

The line under the chart gives the mean ± SD of what is currently in view. Every chart in the tool has a home button at its top right that zooms all the way out. For instructions and notes on any tab, click the round i button next to a heading or setting. To make one panel of the Protocol chart taller or shorter, drag its top or bottom edge; the other panels keep their size. To leave out noisy or wrong data, click Leave out a period above the Protocol chart and drag across the data. It is dropped from every calculation on every tab and listed in Data checks, the export and the methods paragraph; click × on the period to put it back.

**Threshold status.** Every threshold shows **suggested, not checked** until you move it, type a value, pick a method for it, or click **Confirm**; then it shows **✓ checked**. The Summary tab lists any threshold that is still a suggestion, and the export and research report carry the status, so an unreviewed suggestion never slips into a dataset unnoticed.

**Guided steps.** A bar under the tabs walks you through the analysis in order: check the test details, look over the test, place the thresholds, lactate, then save and report. Click **Next**, or any step, to go to it. Click **Hide guided steps** once you know the tool; the **Guided steps** button at the right of the tabs brings it back.

**Lab presets.** A preset keeps a protocol’s settings so the next test starts with them: test type, entered steps (used only when a file has no power or speed), averaging, windows, step-test options, lactate settings and the report heading. To make one, set up a test as usual, open **Test details**, type a name under **Lab presets** and click **Save these settings as a preset**. Next time, pick it in **Lab preset** on the load screen before clicking **Continue**. Presets stay in your browser; use **Export presets** and **Import presets** to share them with the lab. They never hold participant details, thresholds or lactate values.

## **Guide A: Incremental test (GXT)**

Use this guide to get VO₂peak, VT1 and VT2 from one incremental test.

### 1. Load the test

1. Click **Choose files**, or drag your files onto the page. To remove a wrong file, click the × next to it.
2. Click **Continue**.

### 2. Check the test details

1. Under **Test details (click it to open it)**, check the name, date, body mass and age.
2. Check that **Test type** says **Incremental test**. Change it if it doesn’t.
3. Read **What was detected**, and check that the stages match your protocol.
4. Read **Data checks**. Anything marked **!** needs a look.

### 3. No power or speed in the file: enter the steps

Skip this step if the file holds the power or speed (or you loaded a Lode file). If it has none, a yellow box above the tabs says so; click Enter the incremental test steps. If you chose running or cycling on the start page, only km/h or only W is offered.

1. Under **Incremental test steps**, enter the warm-up length and power.
2. Enter the starting power, increment and stage length. If there was a rest after each stage (for example 30 s to take blood), enter it under **Rest between stages**.
3. If you changed to 1-min stages, choose Yes under Shorter stages at the end, then enter the power (or speed) of the first 1-min stage in **Shorter stages started at**. They go up by the same increment as the longer stages.
4. Check **Test ended at**.
5. Click **Apply steps**. The form closes, and its title changes to Change the entered steps, showing what you applied.

All times are from the start of the COSMED recording. Without these steps or a Lode file, you still get VO₂peak and thresholds, but no power results.

### 3b. Check or correct the stages (any test)

Under **Test details**, open **Stages**. It lists every stage with its start, length, the rest after it, and its power or speed, whether the stages came from the file or from entered steps.

1. Click **Unlock to edit**.
2. Type a new start, length, rest or intensity. Times are minutes:seconds (or a number of minutes, such as 3 or 0.5). Changing a start, length or rest moves the stages after it by the same amount. Press Enter to move down a column.
3. **Add a stage** adds one after the last, with the same length, rest and increment. × removes a stage.
4. Or, on the **Protocol** tab, click **Edit stages** and drag the edge of a stage in the power (or speed) panel. Where two stages meet, dragging the edge moves both.
5. **Reset to original** goes back to the stages from the file or the entered steps. Ctrl+Z (⌘Z on a Mac) undoes the last change.
6. Click **Lock the stages** when done.

**Rests between stages.** If the test stopped (or slowed to a walk) for up to 2 minutes between stages, for example to take blood, the stages still count as one test. The rests are shaded grey on the Protocol chart and, by default, left out of the threshold charts and peak values; untick the box under **What was detected** to keep them.

### 4. Look over the whole test

Open the **Protocol** tab and look for anything unusual, such as mask leaks or gaps. To clean the data, open **Data processing**.

### 5. Set the analysis window and VO₂peak

1. Open the **Thresholds and VO₂peak tab (Thresholds and VO₂max if your test has a separate VO₂max phase)**.
2. Check the **Analysis window**. By default it covers all the incremental stages. If the gas data look off when the first stage starts, enter the seconds to skip in **Leave out the first**. If you have no entered stages, set its start to after the warm-up. The window is highlighted on the time chart below the settings. To change it, drag across the chart, drag either side of the highlight, or type the times. Click elsewhere on the chart to go back to the default.
3. Choose the **VO₂peak over** time your study uses: 15, 30 or 60 s.
4. Choose the **Stage means and the VO₂–power regression use the last** time: 30, 60 or 90 s. On a treadmill, it says speed instead of power.

### 6. Place VT1 and VT2

1. Look at the charts, which show V-slope, VE/VO₂, VE/VCO₂, end-tidal gases, ventilation, RER and heart rate.
2. Drag the blue **VT1** line and purple **VT2** line sideways. A line moves on every chart at once.
3. To see the charts against time, click **Time** next to **Plot thresholds against**. To add straight lines joined at VT1 and VT2, click **Fitted lines on that chart**; they refit as you drag.
4. To type a value instead, use the **Thresholds** table.
5. If there is no VT2 line, the tool found no clear break. Click **Add a VT2 line** if you can place it by eye.

Not sure what each sign looks like? Click **What to look for** (next to "Plot thresholds against") for reference charts of the typical patterns at VT1 and VT2, drawn from a simulated test and based on Keir et al. (2022).

### 7. Compare the suggestions

The **How each method placed them** table lists the suggestions. Click **Use** to move a line to one.

| Suggestion | What it is |
| --- | --- |
| V-slope, VE/VO₂, PETO₂ | Classical methods for VT1 |
| VE against VCO₂, VE/VCO₂, PETCO₂ | Classical methods for VT2 |
| Oxynet CNN and LSTM | Open-source deep-learning models, run on your computer |
| Saved in the COSMED file | Thresholds marked in the COSMED software, if any |

The Oxynet charts show the moderate, heavy and severe model outputs over time. Each dashed line passes through the crossing Oxynet used: the first crossing of moderate and heavy for VT1, and the last crossing of heavy and severe for VT2. To move both lines to one model’s thresholds, click Use these lines on that model’s chart. Click the i button on a chart for a short explanation of how that model works.

Oxynet always gets the data with flagged outlier breaths left out, because one extreme breath can distort its scaling. Oxynet results can still shift depending on the data it receives. Try both **Analysis window** and **All exercise data**.

### 8. Check it was maximal

Read **Was it maximal?** for the VO₂ plateau, RER, heart rate and RPE criteria. RPE comes from numbers typed into the COSMED marker column.

### If your test has a separate VO₂max phase

This applies to longer stages for thresholds, then a recovery walk, then shorter stages to failure.

1. Check that **Test type** says **Incremental test, then a VO₂max phase**. The tool normally finds this itself.
2. Place VT1 and VT2 as above. The charts and speed regression use only the longer stages.
3. Read VO₂max and the peak values at the top. They come from the shorter stages, and so do the **Was it maximal?** criteria.
4. Check whether VT2 was reached. If the longer stages stopped early, there may be no break to find.
5. Treat the Oxynet suggestions as a loose guide. It starts with the **VO₂max stages**, which can give values above the longer stages, and it may not place a threshold on the longer stages at all.

### 9. Save and export

See **Save and export your work** below.

## **Guide B: Durability tests (5-step tests and prolonged exercise)**

Use this guide to find VT1 in each step test, compare the tests, and analyse the prolonged exercise.

### 1. Load the session

1. Click **Choose files**, or drag your files onto the page. To remove a wrong file, click the × next to it.
2. Select everything from the session at once. If it was recorded as several COSMED files, such as 5-step test, run, 5-step test, load them together.
3. Click **Continue**.

The tool joins several COSMED files using the clock times in their headers, whatever order you select them in. Files must be from the same person and day, and in the same format.

### 2. Check the test details

1. Under **Test details (click it to open it)**, check the name, date and body mass.
2. Check that **Test type** says **Durability test (step tests before and after prolonged exercise)**. Change it if it doesn’t.
3. Read **What was detected**. Check the number of step tests, their times and their powers or speeds.
4. Untick any step test you want to leave out.
5. Read **Data checks**. Anything marked **!** needs a look. If files were joined, check they are in the right order.

### 3. Look over the whole session

Open the **Protocol** tab. Blue shading marks the step tests and red marks an all-out test. Gaps in the lines are times with no gas data, such as when the mask was off.

### 3b. Choose the data to use (optional)

At the top of the **Step tests** tab, each test has its own chart, drawn against time from that test’s start. Drag across a test’s chart, or type a start and end above it, to highlight the time you want from that test. To change it, drag either side of the highlight. To start again, click anywhere else on the chart. Each test keeps its own range, so you can choose a different range for each one.

Only data in a test’s highlighted time are used for that test’s threshold charts, suggested lines, stage means and regression. **Chart points use the last** still applies within it. Click **Use all** above a test’s chart to go back to all of that test’s data.

### 4. Place VT1 in each step test

1. Open the **Step tests** tab.
2. Under **Plot against VO₂**, choose the variables you want to see.
3. Under **Chart points use the last**, choose how much of each stage to use. The default is the whole stage. If early points in a stage stretch the chart, try a shorter time.
4. Drag the blue **VT1** line sideways. It moves on every chart for that test. Click Fitted lines on a chart to add straight lines joined at VT1. If your steps reach VT2, click **Add VT2 lines** under the table.
5. To type a value instead, use the **VT1 in each test** table.

Place VT1 by eye in each test, because the starting position is only a suggestion. Oxynet does not run here: it was built for incremental tests that reach exhaustion, and the short, symmetric 5-step test can mislead it.

### 5. Read the VT1 table

For each test, the **VT1 in each test** table gives:

- VT1 as VO₂, and as power or speed from that test’s regression
- Heart rate at VT1
- The change from test 1

### 6. Compare the tests stage by stage

1. Under **Compare the tests**, choose up to 4 variables.
2. Under **Stage means and VO₂–speed regressions use the last**, choose 30 s, 60 s or 2 min. On a bike, it says power instead of speed.
3. Read the charts. The RPE button shows the numbers typed into the COSMED marker column.

The list includes gross efficiency on the bike and running economy on the treadmill. Economy is only meaningful in a steady state, so read stages above VT1 with care.

### 7. Analyse the prolonged exercise

Open the **Prolonged exercise** tab. It analyses each gas recording during the steady work.

1. Read the summary at the top: steady power or speed, % of VT1, time, distance or work, and the change from first to last recording.
2. Choose up to 6 variables to chart, such as VO₂, heart rate, carbohydrate and fat oxidation, and efficiency or economy.
3. Under **Average the last**, choose 1, 2 or 4 min of each recording.
4. Read the **Each recording** and **Energy** tables. If there was an all-out test on the Lode, critical power and W′ appear below them.

For any other part of the session, zoom to it on the **Protocol** tab and read the mean ± SD under the chart.

### 8. Save and export

See **Save and export your work** below.

## Lactate thresholds (both guides)

Use the **Lactate** tab when blood lactate was taken during the test. Gas data are not needed for the thresholds themselves, but the tool still needs the COSMED file to load the test.

1. Open the **Lactate** tab. There is one table for an incremental test, or one per step test.
2. Type the resting lactate as the baseline, then the lactate at the end of each stage. Leave a stage empty if no sample was taken. Press **Enter** or the down arrow to move down a row, the up arrow to move up, and **Tab** to move across. Shorter stages at the end of a test (for example 1-min stages) get no row, because lactate is taken at the end of the longer stages; click **Add a row** (above the table) if you did take one. To paste from Excel, copy the lactate column (or lactate, heart rate and RPE together), click the first box to fill and paste. Speed or power, heart rate and RPE are filled in from the test, and you can change them. Use **Add a row** if a stage is missing.
3. Choose the curve fit (3rd degree polynomial by default, as in Exphyslab), whether the baseline is part of the fit, and how much of the data the Log-log method uses (0.75 by default).
4. The LT1 and LT2 lines start at Log-log and ModDmax. To change a threshold, drag its line, or open **Every method** and click **LT1** or **LT2** next to a method.
5. To compare with the gas data, the VT lines are drawn as dotted lines on the lactate chart. **Copy LT1 and LT2 to the gas charts** moves the VT lines to the lactate thresholds, and **Copy VT1 and VT2 here** does the opposite. Both use the VO₂–speed or VO₂–power regression.
6. With a resting sample, the chart's first point is labelled **Baseline** on the x-axis (it is drawn one step before the first stage, as in lactater). The chart sits under the table, with LT1 and LT2 beside it. Drag the bar under the chart up or down to make it taller or shorter.
7. The chart marks only the two methods the lines start at (Log-log for LT1 and ModDmax for LT2). Under **Methods marked on the chart**, tick any other method to mark its value too; **Reset to default** goes back to the two.
8. Heart rate for each stage is filled in as the mean of the stage's last 30 seconds. Type over it if needed. The stage tables on the other tabs also use the last 30 seconds for heart rate, whatever window is chosen for the other variables.

The methods are a JavaScript version of the open-source lactater R package by Felipe Mattioni Maturana, which Exphyslab also uses. On lactater’s example data, the tool gave the same values as Exphyslab for 12 of the 13 methods Exphyslab lists; Log-log was 0.1 W higher. Still check your own results against Exphyslab before relying on them.

## Reports

On the **Summary** tab, open **Reports**.

1. Check the report heading, tester, date of birth, height and the protocol text. The tester is remembered on your computer for next time.
2. Each report has its own box. In the **Client report** box, choose whether it uses the lactate thresholds or the gas thresholds.
   In each box, tick the figures that report should include: the breathing chart (VE/VO₂ and VE/VCO₂ against time, with VT1 and VT2), the lactate curve (with LT1 and LT2) and the end-tidal CO₂ chart (PETCO₂ against time; off unless you tick it). Unless you change them, the client report gets the figure that matches its thresholds and the research report gets both.
3. Click **Generate the client report (Word)** for the 1–2 page clinic report in everyday language, with training zones, or **Generate the research report (Word)** for peak values, thresholds, stage tables, figures and the methods paragraph.
4. Open the file in Word and check the wording before sending it.

The client report is only for incremental tests. If a threshold could not be found, the report says so and adjusts the zones.

## **Save and export your work**

Click **Save analysis** before you close the page, because the tool does not save your lines automatically. The buttons are at the top of every page.

Press **Ctrl+Z** (**⌘Z** on a Mac) to undo a change, such as a moved line or a new highlight, and **Ctrl+Shift+Z** or **Ctrl+Y** to redo it. If you try to close the page with unsaved changes, the browser asks you to confirm.

| Button | What you get | Use it for |
| --- | --- | --- |
| **Save analysis** | A file with your data, settings and threshold lines | Reopening later with **Open analysis** |
| **Export Excel** | Results, stage values, thresholds, data checks, settings, methods and credits | Your records and data analysis |
| **Export CSV** | All results in long format | R or JASP |

The **Summary** tab has a methods paragraph you can copy, and the citations to use. Click a section title, such as Methods paragraph, to open or close it. Check the paragraph matches what you did before using it in a paper.

Saved and exported files contain participant details, so store them as your ethics approval requires.

## **Common problems**

| Problem | What to do |
| --- | --- |
| A file is not recognised | Use the original COSMED or Lode .xlsx export, with its sheets unchanged |
| It picked the wrong test type | Change **Test type** under **Test details** |
| Stages are wrong on an incremental test | Use **Incremental test steps** under **Test details** |
| Step tests are wrong or missing | Under **Test details**, open **Any other protocol** and enter each block of stages |
| The COSMED speed is ignored | A speed that never changes is treated as a leftover setting. Enter the steps by hand |
| Body mass differs between files | Enter the correct value under **Test details** |
| Power looks out of step with ventilation | Check the start times, then enter a **Lode time offset** |
| Files won’t join | Check they are from the same person and day, and all breath-by-breath or all averaged |
| The charts look too noisy | Change the **Averaging** menu, or use **Data processing** |
| A threshold looks wrong | Drag it. Suggestions are only a starting point |

## Credits

The Lab CPET tool was created by SangHoon Yoon. Contact him with questions or problems.

The Oxynet suggestions use the open-source pyoxynet models by Andrea Zignoli and the Oxynet team. The tool is not made or endorsed by the Oxynet team. If you report Oxynet suggestions, please cite:

- Zignoli A, Fornasiero A, Rota P, et al. Oxynet: a collective intelligence that detects ventilatory thresholds in cardiopulmonary exercise tests. *European Journal of Sport Science*. 2022;22(3):425-435. [doi:10.1080/17461391.2020.1866081](https://doi.org/10.1080/17461391.2020.1866081)
- Keir DA, Zignoli A, Iannetta D, Mattioni Maturana F, Murias JM. AI-driven analysis of cardiopulmonary exercise tests to identify gas exchange and ventilatory thresholds. *Sports Medicine*. 2026;56(7):1833-1843. [doi:10.1007/s40279-026-02403-w](https://doi.org/10.1007/s40279-026-02403-w)
