/**
 * Keeps React working after the browser translates the page (Chrome/Edge "Translate this page", Google Translate).
 *
 * The site is Russian-only and readers are expected to use browser translation. Those translators replace text
 * nodes with `<font>` wrappers, so the DOM no longer matches React's tree. When React later removes or moves one of
 * the original text nodes (a button label changes, a status message appears, …) it calls `removeChild` /
 * `insertBefore` on a parent that no longer owns the node, and the browser throws "Failed to execute 'removeChild'
 * on 'Node'" — which unmounts the whole page (facebook/react#11538).
 *
 * This inline script runs before React hydrates and patches both methods: when the child (or the reference node)
 * is no longer a child of `this`, the call becomes a no-op instead of throwing (with a console warning in
 * development). The translated text may then be briefly stale, but the page keeps working. Interactive components
 * additionally wrap dynamic text in its own element (`<span>{text}</span>`), so React swaps whole elements rather
 * than individual text nodes and the guard is rarely needed at all.
 */
function script(dev: boolean): string {
  const warn = (method: string) =>
    dev
      ? `console.warn("[translate-guard] ${method}: the node is not a child of this parent (page translated by the browser?)",arguments[0],this);`
      : "";
  return `(function(){if(typeof Node!=="function"||!Node.prototype||window.__translateGuard)return;window.__translateGuard=true;var p=Node.prototype,rc=p.removeChild,ib=p.insertBefore;p.removeChild=function(c){if(c&&c.parentNode!==this){${warn("removeChild")}return c;}return rc.apply(this,arguments);};p.insertBefore=function(n,r){if(r&&r.parentNode!==this){${warn("insertBefore")}return n;}return ib.apply(this,arguments);};})();`;
}

export function TranslateGuard() {
  return <script dangerouslySetInnerHTML={{ __html: script(process.env.NODE_ENV !== "production") }} />;
}
