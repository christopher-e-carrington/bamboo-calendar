# Calendar month layout improvements

## What will change
- Keep every date badge anchored at the same top-left position within its day.
- Render events spanning multiple days as continuous bars across adjacent date cells, including clean continuation across week rows.
- Remove the fixed visible-event limit so each week expands vertically when it contains more events.
- Preserve the current phone calendar row height as the minimum, so sparse months keep the familiar appearance.
- Keep day selection and the event list below the calendar working as they do now.

## Technical details
- Rework each month week into a layered seven-column grid with fixed date headers and calculated event lanes.
- Assign overlapping events to separate lanes and span multi-day events across their covered columns.
- Use responsive minimum row heights and content-driven rows instead of clipping overflow.
- Verify the month view on the current phone-sized viewport and check the app build diagnostics.
