import { MAX_DEMO_FRAMING_POINTS, parseDemoFraming, simplifyDemoFramingPoints, type DemoFraming, type DemoFramingPoint } from "@/worker/src/lib/explore-finishing-contract";

/** In-memory only. Never changes the attached file or dispatches a render. */
export class DemoFramingRecording {
  private points: DemoFramingPoint[];
  private observed: DemoFramingPoint;
  private nextFrame = 1;
  constructor(private frame: DemoFraming) {
    this.observed = [0, frame.points[0][1], frame.points[0][2]];
    this.points = [[...this.observed]];
  }
  sample(timeMs: number, x: number, y: number) {
    const time = Math.round(timeMs), prior = this.observed;
    if (!Number.isFinite(time) || time < prior[0] || time > 120_000) throw new Error("Playback moved outside the recording. Record the movement again from the start.");
    if (![x, y].every(Number.isFinite)) throw new Error("The selected frame could not be recorded.");
    const point: DemoFramingPoint = [time, Number(Math.max(0, Math.min(1 - this.frame.width, x)).toFixed(6)), Number(Math.max(0, Math.min(1 - this.frame.height, y)).toFixed(6))];
    // Match the export's 30 fps, interpolating at frame boundaries rather than
    // storing every pointer event. A two-minute smooth drag stays bounded even
    // with a high-polling-rate mouse; its actual playback timing is preserved.
    if (time === 0) this.points[0] = [...point];
    while (Math.round(this.nextFrame * 1000 / 30) <= time) {
      const at = Math.round(this.nextFrame++ * 1000 / 30);
      const fraction = (at - prior[0]) / (time - prior[0]);
      this.points.push([at, prior[1] + (point[1] - prior[1]) * fraction, prior[2] + (point[2] - prior[2]) * fraction]);
    }
    this.observed = point;
    if (this.points.length > 4096) throw new Error("This movement is too complex. Record it again with fewer changes.");
  }
  finish(durationMs: number): DemoFraming {
    const last = this.observed;
    this.sample(durationMs, last[1], last[2]);
    if (this.points[this.points.length - 1][0] < durationMs) this.points.push([durationMs, last[1], last[2]]);
    const points = simplifyDemoFramingPoints(this.points);
    if (points.length > MAX_DEMO_FRAMING_POINTS) throw new Error("This movement has too many direction changes. Record it again with fewer changes.");
    return parseDemoFraming({ ...this.frame, points });
  }
}
