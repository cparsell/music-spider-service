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
    <div className="h-full flex flex-col">
      {description && (
        <div className="shrink-0 mb-3 text-sm text-neutral-500">
          {description}
        </div>
      )}
      <div className="shrink-0 mb-3">{controls}</div>
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto p-2">
        {children}
      </div>
      <div className="shrink-0">{statusBar}</div>
    </div>
  );
}
