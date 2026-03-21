import type { ReactNode } from 'react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

export const mountReactApp = (elementId: string, node: ReactNode): void => {
  const container = document.getElementById(elementId);

  if (!container) {
    throw new Error(`Missing root element: ${elementId}`);
  }

  createRoot(container).render(<StrictMode>{node}</StrictMode>);
};
