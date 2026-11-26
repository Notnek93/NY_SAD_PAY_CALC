# JTF Sentinel SAD Duty, Leave, and Pay Planner

The Sentinel Planner is a browser-based planning aid for service members and staff supporting New York Joint Task Force Sentinel on State Active Duty (SAD). It brings a duty schedule, leave and REFRAD planning, and an estimated SAD pay calculation into one place.

The goal is straightforward: make it easier to see how a planned schedule fits together, catch dates and assumptions that need attention, and prepare information for the normal unit process. The planner does not approve leave, issue orders, determine eligibility, or replace official personnel, finance, or command records.

## Standard operating procedure

| SOP item | Detail |
| --- | --- |
| Title | Use of the JTF Sentinel SAD Duty, Leave, and Pay Planner |
| Proponent | Local planner maintainer |
| Effective date | Upon local adoption |
| Status | Unofficial user-level procedure; not an approved Army, New York National Guard, or JTF directive |

This procedure describes a consistent way to use the planner. A unit should review and approve any local procedure before treating it as command policy. Current orders, command guidance, and applicable policy always take precedence over the planner.

### 1. Purpose

Use the planner to prepare and review a personal or staff planning view of duty status, SAD leave, travel, voluntary REFRAD timing, and estimated pay. Use the normal chain of command and official systems for requests, approvals, pay actions, and records.

### 2. Applicability

This procedure applies to people using the planner for planning or administrative preparation. It does not create new approval authority or change existing requirements. A printed schedule or downloaded report is a planning document, not an official DA Form 6, pay statement, leave approval, or order.

### 3. Responsibilities

- **Service member or planner:** Enter accurate dates and profile information, review the resulting schedule and estimates, and raise questions through the established unit process.
- **Supervisor and unit personnel, finance, or command representatives:** Review submissions and make decisions through their normal channels. The planner does not perform those reviews or decisions.
- **Planner maintainer:** Keep the application and its reference data current, identify modeled assumptions, and publish updates through the appropriate project process.

### 4. Procedure

#### A. Open and set up the planner

1. Open the planner in a supported browser. Choose Desktop for the full schedule view or Phone for the touch-friendly calendar.
2. In **Profile & Settings**, enter the leave balance requested by the planner. The current build labels this balance as of **18 Nov 2026**; enter `0` if the balance is zero. Confirm the date and balance against your records before relying on a plan.
3. If you want a pay estimate, enter the applicable pay grade, years of service, ZIP code, dependency status, BAH/BAS eligibility, and assignment role. Use information you can verify. The ZIP code identifies a BAH rate area; it does not establish entitlement.
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

Pay estimates depend on the profile entered and the rate data included with the application. They are not a pay statement or promise of payment. ZIP-to-rate-area lookup, BAH/BAS assumptions, incentives, leave accrual, and displayed deadlines should all be checked against authoritative records and guidance.

### 6. Records and information handling

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

### Build

From the repository root, run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\build.ps1 -SrcDir .\source -DistDir .\distribution
```

The build refreshes the generated root `index.html`, `pay-data.js`, and `sw.js`, plus the matching files under `distribution\`. `build.bat` is a convenience wrapper that also cleans the distribution folder before rebuilding.

Run the automated regression tests with `node --test tests/*.test.js`.
