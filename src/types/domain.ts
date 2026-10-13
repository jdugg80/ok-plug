export * from "../../electron/shared/types";
export { FORMAT_CATALOG } from "../../electron/shared/format-catalog";
export { buildAdDesignInput } from "../../electron/shared/build-ad-design-input";
export type { BuildAdDesignInputOptions } from "../../electron/shared/build-ad-design-input";
export {
  assembleContactParts,
  assembleFinePrint,
  chooseLogo,
  combineFinePrint,
  getSafeInsets,
  isCompactCanvas,
  resolveFontStack,
} from "../../electron/shared/brand-render";
export type { ContactPart, LogoChoice, RenderBrand, SafeInsets } from "../../electron/shared/brand-render";
export type { AdDesignResult, AdDesignInput } from "../../electron/main/services/ai-ad-design-service";
