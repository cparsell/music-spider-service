// Shared shell for the list-style tabs: keeps `controls` (term/action
// buttons + status bar) pinned in place while `children` (the table/list)
// scrolls independently underneath.
export default function TabLayout({ controls, children }) {
  return (
    <div className="h-full flex flex-col">
      <div className="shrink-0">{controls}</div>
      <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>
    </div>
  );
}
