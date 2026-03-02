import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

// This file is web-only and used to configure the root HTML for every web page during static rendering.
// The contents of this function only run in Node.js environments and do not have access to the DOM or browser APIs.
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="pt-BR">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <meta name="theme-color" content="#0F1923" />
        <meta name="description" content="BarberPro — Agendamento de Barbearia" />

        {/*
          Prevent flash of wrong theme: apply dark mode before React hydrates.
          This script runs synchronously before any content is painted.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function() {
  try {
    var stored = localStorage.getItem('theme');
    var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    var scheme = stored === 'light' ? 'light' : (stored === 'dark' || prefersDark || !stored) ? 'dark' : 'dark';
    var root = document.documentElement;
    root.dataset.theme = scheme;
    root.classList.add(scheme);
    // Apply dark palette CSS variables immediately
    if (scheme === 'dark') {
      root.style.setProperty('--color-primary', '#2A7AB8');
      root.style.setProperty('--color-background', '#0F1923');
      root.style.setProperty('--color-surface', '#1A2535');
      root.style.setProperty('--color-foreground', '#F0F4F8');
      root.style.setProperty('--color-muted', '#8A9BB0');
      root.style.setProperty('--color-border', '#2A3A4A');
      root.style.setProperty('--color-success', '#4ADE80');
      root.style.setProperty('--color-warning', '#FBBF24');
      root.style.setProperty('--color-error', '#F87171');
      root.style.backgroundColor = '#0F1923';
    } else {
      root.style.setProperty('--color-primary', '#1B4D6E');
      root.style.setProperty('--color-background', '#F8F9FA');
      root.style.setProperty('--color-surface', '#FFFFFF');
      root.style.setProperty('--color-foreground', '#1A1A1A');
      root.style.setProperty('--color-muted', '#6B7280');
      root.style.setProperty('--color-border', '#E2E5E9');
      root.style.setProperty('--color-success', '#16A34A');
      root.style.setProperty('--color-warning', '#D97706');
      root.style.setProperty('--color-error', '#DC2626');
      root.style.backgroundColor = '#F8F9FA';
    }
  } catch(e) {
    // Fallback: apply dark theme
    document.documentElement.dataset.theme = 'dark';
    document.documentElement.style.backgroundColor = '#0F1923';
  }
})();
            `,
          }}
        />

        {/* Disable body/html margins and set background to prevent white flash */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
html, body {
  margin: 0;
  padding: 0;
  background-color: #0F1923;
  height: 100%;
}
html[data-theme="light"], html[data-theme="light"] body {
  background-color: #F8F9FA;
}
* { box-sizing: border-box; }
            `,
          }}
        />

        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
