import type { VibeforgeApi } from "../electron/preload/preload";

declare global {
  interface Window {
    vibeforge: VibeforgeApi;
  }
}

export {};
