import type { Page } from "@playwright/test";

/**
 * 007 — the development server's own overlay, out of the way.
 *
 * `next dev` mounts a floating dev-tools button in the corner, inside a
 * `<nextjs-portal>`. It is not part of the application and it sits on top of
 * the shell's navigation, swallowing clicks meant for the last tab. Hiding it
 * is done here, in the suite, rather than by turning off an indicator in the
 * application's configuration: the app must not be shaped by its tests.
 */

const HIDE = "nextjs-portal { display: none !important; }";

export async function hideDevOverlay(page: Page): Promise<void> {
  await page.addInitScript((css: string) => {
    const install = () => {
      const style = document.createElement("style");
      style.textContent = css;
      document.documentElement.appendChild(style);
    };
    if (document.documentElement) install();
    else document.addEventListener("DOMContentLoaded", install, { once: true });
  }, HIDE);
}
