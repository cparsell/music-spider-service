"use client";
import { useEffect, useRef } from "react";

// Shared shell for the list-style tabs: keeps `controls` (term/action
// buttons) pinned at the top and `statusBar` pinned at the bottom, while
// `children` (the table/list) scrolls independently between them and spans
// the full available width, so its scrollbar hugs the browser's edge.
export default function TabLayout({
  controls,
  statusBar,
  children,
  description,
}) {
  const scrollRef = useRef(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    // By default the scroll wheel only affects whatever's under the cursor.
    // Redirect wheel events to this container whenever the mouse is
    // somewhere else on the page (e.g. over the controls/header), so
    // scrolling works regardless of cursor position as long as the window
    // has focus. If the cursor is already inside the container, let the
    // browser handle it natively.
    const onWheel = (e) => {
      if (el.contains(e.target)) return;
      el.scrollBy({ top: e.deltaY, left: e.deltaX });
    };

    window.addEventListener("wheel", onWheel, { passive: true });
    return () => window.removeEventListener("wheel", onWheel);
  }, []);

  return (
    <div className="h-full flex flex-col ">
      {description && (
        <div className="shrink-0 pt-5 pb-3 -mx-6 px-6 py-2 text-sm text-neutral-300 bg-neutral-900 ">
          {description}
        </div>
      )}
      {controls && (
        // Bleeds past this tab's horizontal inset (set by the parent in
        // HomeClient.js) so the background reaches the browser edge and the
        // sidebar border, then re-adds that same amount as padding so the
        // controls themselves still line up with the content below.
        <div className="shrink-0  -mx-3 px-3 py-2 bg-neutral-900 lg:-mx-6 lg:px-6 border-b border-neutral-700 lg:pt-3">
          {controls}
        </div>
      )}
      <div
        ref={scrollRef}
        // No top padding - a sticky (top-0) header inside would otherwise
        // sit a few pixels below the scrollport's real top edge, leaving a
        // gap scrolled rows could peek through above it. Bleeds past this
        // tab's horizontal inset (like `controls` above) so this container's
        // right edge - and thus its scrollbar - reaches the browser edge
        // instead of sitting inset from it, then re-adds the same amount as
        // padding so the content itself still lines up with controls/description.
        className="flex-1 min-h-0 overflow-y-auto -mx-3 px-3 pb-2 lg:-mx-6 lg:px-6"
      >
        {children}
      </div>
      <div className="shrink-0">{statusBar}</div>
    </div>
  );
}
