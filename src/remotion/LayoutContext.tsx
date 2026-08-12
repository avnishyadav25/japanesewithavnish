/**
 * Layout + theme context shared by every scene.
 *
 * One composition serves all four output formats. The storyboard carries no geometry at all —
 * scenes read the layout from here and pick a variant, so a vocabulary card stacks at 9:16 and
 * goes two-column at 16:9 without the storyboard knowing which is being rendered.
 */
import React, { createContext, useContext } from "react";
import type { VideoThemeTokens } from "@/lib/video/types";
import { DEFAULT_THEME, LAYOUT_SCALES, type LayoutScale, type SceneLayout } from "./theme";

interface LayoutContextValue {
  layout: SceneLayout;
  scale: LayoutScale;
  theme: VideoThemeTokens;
}

const LayoutContext = createContext<LayoutContextValue>({
  layout: "vertical",
  scale: LAYOUT_SCALES.vertical,
  theme: DEFAULT_THEME,
});

export const LayoutProvider: React.FC<{
  layout: SceneLayout;
  theme: VideoThemeTokens;
  children: React.ReactNode;
}> = ({ layout, theme, children }) => (
  <LayoutContext.Provider value={{ layout, scale: LAYOUT_SCALES[layout], theme }}>
    {children}
  </LayoutContext.Provider>
);

export function useLayout(): LayoutContextValue {
  return useContext(LayoutContext);
}
