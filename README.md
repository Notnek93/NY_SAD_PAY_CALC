# NY SAD Duty, Leave & Pay Planner

Created by Kenton Lee.

Questions, bugs, or a number that looks wrong? Email kenton.lee4.mil@army.mil.

The NY SAD Planner is a browser-based planning aid for the New York State Active Duty mission. It brings a duty schedule, leave and REFRAD planning, and an estimated SAD pay calculation into one place.

The goal is straightforward: make it easier to see how a planned schedule fits together, catch dates and assumptions that need attention, and prepare information for the normal unit process. The planner does not approve leave, issue orders, determine eligibility, or replace official personnel, finance, or command records.

## What it does

- Duty schedule with Desktop and Phone views, covering shift, RDO, leave, TDY, In-Transit, Special Pass, and transfer days
- Leave planning with balance tracking, deadlines, and policy warnings
- Voluntary REFRAD planning, including terminal leave and off-mission dates
- Estimated SAD pay from base pay, BAH (by ZIP or MHA), BAS, and role incentives
- Printable DA Form 6 schedule, a downloadable duty plan report, and the SAD leave request form
- Works offline, and everything is saved on the device
- In-app feedback link, so suggestions come straight to my inbox

## Tech notes

It's plain HTML, CSS, and JavaScript. There's no framework, no package manager, no runtime dependencies, and no backend. `build.ps1` stitches the files in `source\` into one self-contained `index.html`, generates the pay data from the CSVs, and stamps the service worker cache so installed copies pick up updates. Data is saved in the browser's `localStorage`, and the service worker handles offline use and installing it as an app. Tests are plain `node:test` with no extra packages.

## Browser support

I've tested it in Safari, which is what I use for the web app, and in a current Chromium-based browser (Chrome and Edge). It uses only standard web features. Installing it as an app and offline mode need the page served over HTTPS or from `localhost`; opening the file directly still works for everyday use.

## Developer quick start

The planner is a static, offline-capable PWA with no server and no runtime dependencies. `source\` holds the editable files; the build concatenates them into a single `index.html` and generates `pay-data.js` and `sw.js`.

1. Edit files under `source\` (see [Maintaining the application](#maintaining-the-application) for which file owns what).
2. Rebuild with `build.ps1` (Windows PowerShell; `build.bat` also cleans `distribution\` first).
3. Run the tests: `node --test tests/*.test.js`.
4. Open the root `index.html` in a browser to check the result. Serve it over `http://localhost` if you want to test the service worker or install prompt.
5. Commit the regenerated root files and `distribution\` together with your source changes.

Pay data comes from `data\BasePay.csv` and the BAH/ZIP-to-MHA files in `data\raw\`; update those instead of `source\07-pay-data.js`.

## How to use it

This is an unofficial, user-level guide. It is not an Army, New York National Guard, or JTF directive, and nobody signed it in triplicate. If your unit wants to adopt it as a local procedure, they should review it first. Current orders, command guidance, and policy always win over anything this planner tells you.

### 1. Purpose

Use the planner to prepare and review a personal or staff planning view of duty status, SAD leave, travel, voluntary REFRAD timing, and estimated pay. Use the normal chain of command and official systems for requests, approvals, pay actions, and records.

### 2. Applicability

This procedure applies to people using the planner for planning or administrative preparation. It does not create new approval authority or change existing requirements. A printed schedule or downloaded report is a planning document, not an official DA Form 6, pay statement, leave approval, or order. Printing it doesn't make it official, no matter how good the font looks.

### 3. Who does what

- **Service member or planner:** Enter accurate dates and profile information, review the resulting schedule and estimates, and raise questions through the established unit process.
- **Supervisor and unit personnel, finance, or command representatives:** Review submissions and make decisions through their normal channels. The planner does not perform those reviews or decisions.
- **Planner maintainer:** Keep the application and its reference data current, identify modeled assumptions, and publish updates through the appropriate project process.

### 4. Procedure

#### A. Open and set up the planner

1. Open the planner in a supported browser. Choose Desktop for the full schedule view or Phone for the touch-friendly calendar.
2. In **Profile & Settings**, enter the leave balance requested by the planner. The current build labels this balance as of **18 Nov 2026**; enter `0` if the balance is zero. Confirm the date and balance against your records before relying on a plan.
3. If you want a pay estimate, enter the applicable pay grade, years of service, and either a ZIP code or a selected Military Housing Area (MHA), plus dependency status, BAH/BAS eligibility, and assignment role. The app searches the bundled MHA list by city, state, or MHA code. Use information you can verify; a location does not establish entitlement.
4. Confirm the selected pay period and shift pattern. Review the schedule before changing dates.

Saved information stays in the browser storage on that device. It does not automatically sync to another phone or computer. Avoid using a shared device for personal information, and do not assume that browser data is backed up.

#### B. Maintain duty statuses

Select a date and choose the status that best reflects the plan. Common labels are:

| Label | Meaning in the planner |
| --- | --- |
| SHFT | Present / On Shift |
| RDO | Regular Day Off |
| LV | SAD Leave |
| TDY | Drill / TDY |
| TRV | In-Transit travel |
| SP | Special Pass |
| INCP | INCAP Pay |
| XFER | Transfer Day; counts as paid On Shift time and accrues leave |
| RFRD | REFRAD Report Date |
| TERM | Terminal Leave |
| OFF | Post-REFRAD / Off Mission |

Use **Undo last date change** when available to reverse an unintended single-date change. REFRAD statuses are managed by **Plan REFRAD**; use that planner to change or clear them.

#### C. Plan leave

1. For a single date, select the date and choose **SAD Leave**. For a range, open **Tools** → **Plan a date range**, then choose **SAD Leave**.
2. Enter the first and last dates. Both dates are included. Review the affected pay periods and the leave deadlines shown by the planner.
3. Download the SAD Leave Request Form if needed, complete it, and submit it through the unit's established approval process. A date shown as leave in the planner is not evidence that leave was requested or approved.

Deadlines and leave calculations are planning estimates. Confirm current submission timelines, available balance, and approval requirements with the responsible unit office.

#### D. Plan TDY and travel

1. Open **Tools** and choose **Plan a date range**, then select **AT / Drill / TDY**. Enter the full date range and review the preview before applying it.
2. The planner asks whether the assigned facility is **more than 120 miles** from the home station. For a distance greater than 120 miles, the range must be at least three days: the first and last dates become TRV, with AT / Drill / TDY between them. Each In-Transit day must connect On Shift with AT / Drill / TDY. At 120 miles or less, all dates in the range become AT / Drill / TDY.
3. If selecting TRV for an individual date, answer the in-app confirmation prompt. Choose **No** to leave that date unchanged.

The prompt records the user's answer; it does not verify distance, orders, travel authorization, or eligibility. Use current orders and unit guidance for those determinations.

#### E. Plan a transfer

1. Open **Tools** and choose **Plan Transfer**. Select the transfer date and destination assignment role: **C2**, **External Support**, **Facility Leadership**, or **General Purpose**. These options remain separate.
2. Apply the transfer. The date is marked XFER and counts as paid On Shift time for SAD pay and leave accrual; it is not leave.
3. Incentive Pay is estimated at the highest assignment-role rate held during each pay period, provided the period includes an On Shift or Transfer Day. A pay period that includes Facility Leadership or General Purpose retains the $2,000 rate; later periods use the role after the transfer. Transfers between facilities with no role-category change do not change the estimate.

Use official records and unit guidance to verify assignment and incentive eligibility. The planner records user-entered assumptions; it does not verify a transfer or determine entitlement.

#### F. Plan voluntary REFRAD

1. Open **Plan REFRAD** and select the method that matches the plan: **REFRAD Report Date** or **Mission End Date**.
2. Review the date and the displayed treatment of Terminal Leave and Off Mission dates before applying the plan.
3. After applying it, review the entire schedule. A REFRAD plan can replace future statuses and shorten the displayed schedule after its cutoff.
4. To change the plan, apply a new one. To remove it, choose **Clear REFRAD plan**; the planner restores the schedule snapshot saved before the plan was applied.

This workflow covers voluntary planning only. It does not determine eligibility, create an involuntary REFRAD process, or approve a separation date. Follow command instructions for any other situation.

#### G. Review and export

Before sharing or submitting anything:

1. Check dates, statuses, leave balance, profile assumptions, and any warnings.
2. Resolve questions with the appropriate unit representative; do not treat a warning-free screen as approval.
3. Use **Print DA Form 6** for a printable schedule, **Download Duty Plan Report** for an HTML report, or **Download SAD Leave Request Form (PDF)** for the leave form.
4. Protect downloaded or printed files under applicable unit privacy and records-handling rules. Reports may contain personal or pay-related information.

Use **Manage saved data** only when you intend to clear information stored on the current device. Clearing browser data may also remove the planner's saved plan.

### 5. Planning assumptions and limitations

Pay, leave, holiday, travel, and policy logic are modeled for planning and may be incomplete, outdated, or different from an individual determination. The current build identifies planning references that include the **01 Apr 2026 Policy Change 2**, the **CY27 Holiday Memo dated 02 Oct 2026**, and a **49-day limit effective 03 Dec 2026**. Verify that the applicable policy and dates remain current before acting on a result.

The pay math is only as good as what you type in. Pay estimates depend on the profile entered and the rate data included with the application. They are not a pay statement or promise of payment. ZIP-to-rate-area lookup, BAH/BAS assumptions, incentives, leave accrual, and displayed deadlines should all be checked against authoritative records and guidance.

### 6. Where the rules come from

The planner's warnings cite the leave and pass policy paragraphs they're modeled on (for example, Para 9.b on In-Transit days next to RDO, leave, or Special Pass, and Para 4.e on the 120-mile travel authorization). The policy documents themselves aren't bundled with the app, so get them from your unit and read the source before acting on a warning. The On Shift/TDY status bridge and pay-period boundary checks are my own modeled checks, not verbatim policy. Confirm travel coding and orders with your unit.

### 7. Records and information handling

The planner saves its working data in browser storage on the current device; it is not an official system of record and does not provide automatic cross-device synchronization. Keep official records and submit requests through approved channels. Handle exports and screen captures as you would other documents containing personal or pay-related information.

## Maintaining the application

Edit the files under `source\`, not the generated `index.html` files or `distribution\`. Source files include maintainer notes, and many editable sections are marked with `[EDIT-*]` labels.

| File | Edit this for |
| --- | --- |
| `source\01-theme-and-layout.css` | Colors, visual styles, and responsive layout |
| `source\02-planner-ui.html` | Page wording, form markup, and visible controls |
| `source\03-calendar-holidays-storage.js` | Calendar anchors, status definitions, holidays, storage keys, and policy switches |
| `source\04-schedule-wizard-grid.js` | Wizard and settings behavior, RDO presets, planner interactions, and REFRAD controls |
| `source\05-policy-leave-engine.js` | Leave limits, deadlines, and policy calculations |
| `source\06-sad-pay-calculator.js` | Pay defaults, BAS rates, role incentives, and pay calculations |
| `source\07-coc-report-export.js` | Printable report layout and print behavior |
| `source\08-app-startup.js` | First-run setup and application startup |
| `source\sw.js` | Offline cache assets; the build assigns the cache version |
| `source\manifest.json` | Installable app name, description, and display settings |

`source\07-pay-data.js` is generated by the build. Update `data\BasePay.csv` or the latest `data\raw\bah-rates-YYYY.csv` and `data\raw\zip-to-mha-YYYY.csv` inputs instead. The downloadable leave form is `source\assets\DOCCS_SAD_Leave_Request_Form.pdf`.

### Yearly data refresh

1. Drop the new base pay table into `data\BasePay.csv`.
2. Add the new `bah-rates-YYYY.csv` and `zip-to-mha-YYYY.csv` to `data\raw\`.
3. Update the dates and policy references in `source\03-calendar-holidays-storage.js` (holidays, anchors, leave balance date) and the policy limits in `source\05-policy-leave-engine.js`.
4. Update BAS and special pay rates in `source\06-sad-pay-calculator.js`.
5. Update the policy paragraph citations in `source\05-policy-leave-engine.js` if the policy was renumbered.
6. Rebuild, run the tests, and spot-check a few ZIP codes against the official pay tables.

### Build

From the repository root, run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\build.ps1 -SrcDir .\source -DistDir .\distribution
```

The build refreshes the generated root `index.html`, `pay-data.js`, and `sw.js`, plus the matching files under `distribution\`. `build.bat` is a convenience wrapper that also cleans the distribution folder before rebuilding.

Run the automated regression tests with `node --test tests/*.test.js`.

## Where to find the rules

The planner doesn't bundle policy documents, so here's where the information it models comes from. These are the places to start looking, not links to specific documents. Policy changes, so always use the current version.

- **Your orders and unit guidance:** the final word on your duty status, pay, and leave. Your S1 or HR office can get you the current memos.
- **Active duty pay tables:** DFAS publishes the military pay charts that base pay is built from.
- **Housing allowance (BAH):** the DoD Defense Travel Management Office publishes the BAH rates and the calculator by ZIP code, and its Military Housing Area (MHA) tables.
- **DoD pay rules:** the DoD Financial Management Regulation, Volume 7A, covers military pay policy and entitlements.
- **New York State rules:** New York Military Law and the Division of Military and Naval Affairs cover State Active Duty.
- **Finance and personnel offices:** for individual pay questions, ask them before acting on any estimate, including mine.

For Empire Shield and deployments, the same rule applies: start with the mission's orders and your unit's S1 or HR office, then confirm everything with finance.

## Known limitations

- Pay data covers CY 2026 only and has to be refreshed every year (see the yearly data refresh checklist).
- Policy rules are modeled from the documents I could find, and some checks are my own interpretation. They're planning aids, not determinations.
- The leave balance date, 49-day leave limit, and holiday memo dates are tied to the current policy and need updating when policy changes.
- Data lives in one browser on one device. There's no sync, and clearing browser data clears the plan.
- The build script is PowerShell, so a non-Windows machine needs PowerShell 7 to run it.
- It's built around the NY SAD Sentinel mission. Other missions have different rules.

## Roadmap

- **Empire Shield:** pay and policy support for that mission, once I can track down the rules.
- **Deployment:** pay and policy support for deployments.

## Changelog

### v1.0.0 (first release)

- Duty, leave, TDY, transfer, and REFRAD planning
- SAD pay estimator with ZIP and MHA lookup
- DA Form 6 print, duty plan report, and leave request form download
- Offline support and installable app, with all data stored on the device

## Developer's note

I'm Kenton, a former combat medic who now works in IT. Call me a computer medic: I used to stop the bleeding, now I mostly stop the spreadsheets from bleeding. Different tools, same energy, slightly better coffee.

I built this because I was always confused about what I should be paid and how to get on mission. Nobody hands you the policies. You dig for them, usually after you needed them, usually from someone who found out the same way. When I was in the field I didn't know half of this, and I didn't learn it until I got into an office. I'm not interested in assigning blame for that. I just want everyone to know what they're entitled to, as easily as possible. There's a lot going on, a lot to read, and a lot to understand, and hardworking soldiers shouldn't need a law degree to get it right.

I also watched people get dates and entitlements mixed up, and a confused request that works its way up the chain can end in a denied leave and a hit to morale. That's a lousy way to find out you counted wrong, and I'd like to prevent some of it.

**What I'm proudest of:** it works offline, and there's no website behind it. Nothing is hosted, and nothing gets uploaded. Aside from the app files themselves, everything lives on the phone of the person using it, so your personal information stays with you. No server, no account, no "we value your privacy" popup. It's the lowest-maintenance privacy policy in the Army.

**Biggest headache:** finding the policies. Building the math was the easy part. Tracking down the rules behind it was the real mission, and a scavenger hunt with PDFs for prizes. Which brings me to what's next: I'd like to bring this to Empire Shield, but if I can't easily find the policies for my own mission, finding them for someone else's takes a few more cups of coffee. If you know where the Empire Shield scheduling rules live, I'm all ears.

I'm still learning, so feedback is welcome. If you found a bug, a wrong number, or a better way to do something, email me (address at the top). I'd rather hear it from you than from a very confused spreadsheet.

**Fun fact:** I'm a cappuccino-with-half-and-half guy, and I've had to give it up because I'm on a strict calorie count. Black coffee is now the only deal my macros will sign off on. Outside of that, it's video games and the gym, or the gym and video games, depending on the day.

This app is free. If you really want to say thanks, send a bug report, or buy yourself a coffee and think of me. Black, no sugar, no paperwork.

**Thanks:** to everyone who helped me test this, and to the leadership who gave me the room to try it. Your feedback made it better, and your patience with early versions made me a better developer. Thanks also to the New York National Guard for the opportunity to serve on this joint task force. Working alongside the Air Force, Navy, Marines, Coast Guard, and fellow soldiers has been an awesome experience, and I learned a lot from all of them.

Honestly, I'd be surprised if anyone reads this far. If you did, thank you, and you're more thorough than most of the paperwork I've seen.

## License

Copyright (c) 2026 Kenton Lee. All rights reserved. You're welcome to read the code, but you may not copy, modify, or redistribute it without written permission.
