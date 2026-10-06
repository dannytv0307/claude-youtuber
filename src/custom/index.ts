/**
 * Custom scenes Claude writes in code (SVG illustrations, animated diagrams…).
 * Use in spec.json: "visual": { "type": "custom", "component": "<key>", "props": {…} }
 * Put components in src/custom/<projectId>/<Name>.tsx and register them below
 * with the key "<projectId>/<Name>" (one entry per line, key in quotes:
 * scripts/lib/render-data.ts reads this file as text to validate keys).
 */
import type React from "react";
import { Sunrise } from "./example/Sunrise";
import type { CustomSceneProps } from "./types";

export const customScenes: Record<string, React.FC<CustomSceneProps>> = {
  "example/Sunrise": Sunrise,
};
