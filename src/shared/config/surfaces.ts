export type ExtensionSurface = 'popup' | 'options' | 'dashboard';

export interface SurfaceConfig {
  title: string;
  description: string;
  bullets: string[];
}

const surfaceConfigs: Record<ExtensionSurface, SurfaceConfig> = {
  popup: {
    title: 'Marginalia',
    description: 'The extension scaffold is wired for React, TypeScript, Vite, MV3 packaging, and runtime messaging.',
    bullets: [
      'Toolbar and keyboard toggles now route through the shared runtime layer.',
      'Background and content entries keep badge state and overlay wiring in sync.',
      'Shared modules can be reused across popup, options, and dashboard surfaces.',
    ],
  },
  options: {
    title: 'Settings scaffold',
    description: 'Keyboard shortcuts, storage preferences, and sync controls build on the shared runtime settings layer.',
    bullets: [
      'Default shortcut bindings are persisted to extension sync storage.',
      'The surface shares TypeScript models and styling with the rest of the workspace.',
      'Follow-up todos can add settings forms without changing the build pipeline.',
    ],
  },
  dashboard: {
    title: 'Annotation library scaffold',
    description: 'Browse, search, and manage annotations from this extension page in a later phase.',
    bullets: [
      'Dashboard ships as its own HTML entry ready for richer workflows.',
      'Shared UI primitives and config keep extension surfaces aligned.',
      'Vitest and ESLint are configured so future features can land safely.',
    ],
  },
};

export const getSurfaceConfig = (surface: ExtensionSurface): SurfaceConfig => surfaceConfigs[surface];
