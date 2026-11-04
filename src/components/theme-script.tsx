/**
 * Inline, render-blocking script that sets <html data-theme> before first paint (no flash).
 * Preference stored in localStorage "theme": "dark" | "light" | "system". Default: "dark" (the blog is designed dark-first); "system" follows the OS.
 */
const script = `(function(){try{var p=localStorage.getItem('theme')||'dark';var t=p==='system'?(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'):p;document.documentElement.dataset.theme=t;}catch(e){document.documentElement.dataset.theme='dark';}requestAnimationFrame(function(){requestAnimationFrame(function(){document.documentElement.classList.add('theme-ready')})});})();`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
