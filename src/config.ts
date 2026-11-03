import campus from "../config/campus.json";
import palette from "../config/palette.json";
import styleRules from "../config/style-rules.json";
import { Color } from "three/webgpu";

export { campus, palette, styleRules };

export type PaletteGroup = keyof typeof palette;

/** A palette swatch as a three.js Color (converted to the linear working space). */
export function swatch(name: string, group: "world" | "goose" | "light" | "debug" | "people" | "items" | "signs" = "world"): Color {
  const hex = (palette[group] as Record<string, string>)[name];
  if (!hex) throw new Error(`palette has no ${group}.${name}`);
  return new Color(hex);
}

export function swatchHex(name: string, group: "world" | "goose" | "light" | "debug" | "ui" | "signs" = "world"): string {
  const hex = (palette[group] as Record<string, string>)[name];
  if (!hex) throw new Error(`palette has no ${group}.${name}`);
  return hex;
}
