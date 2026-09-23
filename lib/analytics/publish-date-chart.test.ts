import assert from "node:assert/strict";
import test from "node:test";
import { layoutPublishDatePoints, localPublishDate, publishDateRange } from "./publish-date-chart.ts";

test("calendar spacing reflects missing days rather than equally spaced bars", () => {
  const { points } = layoutPublishDatePoints([
    { date: "2026-09-01", value: 0 }, { date: "2026-09-02", value: 10 }, { date: "2026-09-11", value: 5 },
  ]);
  assert.equal(points[0].x, 6);
  assert.equal(points[1].x, 14.8);
  assert.equal(points[2].x, 94);
  assert.equal(points[0].y, 82);
  assert.equal(points[1].y, 16);
});
test("unavailable is not zero; a single publish date is centered", () => {
  assert.deepEqual(layoutPublishDatePoints([{ date: "2026-09-01", value: null }]).points[0], {
    date: "2026-09-01", value: null, x: 50, y: null,
  });
  assert.equal(layoutPublishDatePoints([{ date: "2026-09-01", value: 0 }]).points[0].y, 82);
});
test("invalid dates are rejected and grouping uses the viewer's local date", () => {
  assert.equal(localPublishDate("invalid"), null);
  const local = new Date(2026, 8, 23, 0, 30);
  assert.equal(localPublishDate(local.toISOString()), "2026-09-23");
});

test("range includes today and keeps calendar spacing across the selected period", () => {
  const range = publishDateRange(30, new Date(2026, 8, 24, 12));
  assert.deepEqual(range, { start: "2026-08-26", end: "2026-09-24" });
  const { points } = layoutPublishDatePoints([{ date: "2026-09-24", value: 0 }], range);
  assert.equal(points[0].x, 94);
});
