import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CircleHelp, X } from "lucide-react";

const COLLAPSED_COUNT = 3;
const PANEL_WIDTH = 340;

/** Backend joins reasons with " | " (LISTAGG), most frequent first. */
function parseReasons(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);
}

type Position = { top: number; left: number };

export function FailureReasonsPopover({ reasons }: { reasons: string | null | undefined }) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [pos, setPos] = useState<Position>({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const items = parseReasons(reasons);
  const visible = expanded ? items : items.slice(0, COLLAPSED_COUNT);
  const hidden = items.length - visible.length;

  useLayoutEffect(() => {
    if (!open || !buttonRef.current || !panelRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const panelHeight = panelRef.current.offsetHeight;
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - PANEL_WIDTH - 8);
    // The panel is position:fixed, so anything past the viewport edge is
    // unreachable -- scrolling can't bring it back. Flip above when it
    // won't fit below.
    const below = rect.bottom + 6;
    const fitsBelow = below + panelHeight <= window.innerHeight - 8;
    const top = fitsBelow ? below : Math.max(8, rect.top - panelHeight - 6);
    setPos({ top, left });
  }, [open, expanded]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      setOpen(false);
    }
    function close() {
      setOpen(false);
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("resize", close);
    // Capture phase so scrolling any ancestor container closes the anchored panel.
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label="Show failure reasons"
        aria-expanded={open}
        className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:text-red-600"
        onClick={(event) => {
          event.stopPropagation();
          setExpanded(false);
          setOpen((prev) => !prev);
        }}
      >
        <CircleHelp className="h-4 w-4" />
      </button>

      {open &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label="Failure reasons"
            className="fixed z-50 rounded-lg border border-slate-200 bg-white shadow-lg"
            style={{ top: pos.top, left: pos.left, width: PANEL_WIDTH }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Failure reasons</span>
              <button
                type="button"
                aria-label="Close"
                className="text-slate-400 transition-colors hover:text-slate-600"
                onClick={() => setOpen(false)}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="max-h-64 overflow-y-auto px-3 py-2">
              {items.length === 0 ? (
                <p className="py-1 text-sm text-slate-500">Reasons unavailable</p>
              ) : (
                <ul className="space-y-1.5">
                  {visible.map((reason, idx) => (
                    <li
                      key={`${idx}-${reason}`}
                      className="flex gap-2 text-sm leading-snug text-slate-900"
                    >
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                      <span className="break-words">{reason}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {hidden > 0 && (
              <button
                type="button"
                className="w-full border-t border-slate-100 px-3 py-2 text-xs font-semibold text-primary transition-colors hover:bg-slate-50"
                onClick={() => setExpanded(true)}
              >
                Show more ({hidden})
              </button>
            )}
            {expanded && items.length > COLLAPSED_COUNT && (
              <button
                type="button"
                className="w-full border-t border-slate-100 px-3 py-2 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-50"
                onClick={() => setExpanded(false)}
              >
                Show less
              </button>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
