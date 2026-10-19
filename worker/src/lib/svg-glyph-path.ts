import type { Path, PathCommand } from "opentype.js";

/** OpenType 2's decimal-string rounding can produce NaN for near-integer
 * floating coordinates (e.g. 83.00000000000001). Serialize the already scaled
 * commands directly; retain contour closure and reject invalid geometry. */
export function serializeGlyphPath(path: Pick<Path, "commands">): string {
  const number = (value: number) => {
    if (!Number.isFinite(value)) throw new Error("The text glyph contains invalid coordinates.");
    return String(Number(value.toFixed(3)));
  };
  return path.commands.map((command: PathCommand) => {
    switch (command.type) {
      case "M": case "L": return `${command.type}${number(command.x)} ${number(command.y)}`;
      case "Q": return `Q${number(command.x1)} ${number(command.y1)} ${number(command.x)} ${number(command.y)}`;
      case "C": return `C${number(command.x1)} ${number(command.y1)} ${number(command.x2)} ${number(command.y2)} ${number(command.x)} ${number(command.y)}`;
      case "Z": return "Z";
      default: throw new Error("The text glyph contains an unsupported path command.");
    }
  }).join("");
}
