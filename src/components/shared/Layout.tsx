import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { WorkspaceProvider } from "@/contexts/WorkspaceContext";
import { findNavItemForPath } from "@/lib/roles";
import { AppHeader } from "@/components/shell/app-header";
import { AppSidebar, MobileSidebar } from "@/components/shell/app-sidebar";
import { CommandMenu } from "@/components/shell/command-menu";
import { isCommandMenuChord, isEditableTarget } from "@/components/shell/keyboard";
import { ShortcutsDialog } from "@/components/shell/shortcuts-dialog";

const COLLAPSED_KEY = "aiva-sidebar-collapsed";
const DESKTOP_QUERY = "(min-width: 1024px)";

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia(DESKTOP_QUERY).matches);
  useEffect(() => {
    const mql = window.matchMedia(DESKTOP_QUERY);
    const onChange = () => setIsDesktop(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return isDesktop;
}

/**
 * Remembers what had focus when an overlay opened and puts focus back there when it closes
 * (Radix only restores focus to its own <Trigger>; these overlays are opened from several places).
 */
function useReturnFocus() {
  const ref = useRef<HTMLElement | null>(null);
  return useMemo(
    () => ({
      remember(from?: Element | null) {
        const target = from ?? document.activeElement;
        ref.current = target instanceof HTMLElement && target !== document.body ? target : null;
      },
      restore(event: Event) {
        const target = ref.current;
        ref.current = null;
        if (target?.isConnected) {
          event.preventDefault();
          target.focus();
        }
      },
    }),
    [],
  );
}

/** App shell: sidebar + topbar + scrolling workspace, with the workspace (account) context. */
export function Layout() {
  return (
    <WorkspaceProvider>
      <Shell />
    </WorkspaceProvider>
  );
}

function Shell() {
  const location = useLocation();
  const isDesktop = useIsDesktop();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const commandFocus = useReturnFocus();
  const shortcutsFocus = useReturnFocus();
  const drawerFocus = useReturnFocus();
  const commandOpenRef = useRef(commandOpen);
  useEffect(() => {
    commandOpenRef.current = commandOpen;
  }, [commandOpen]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((current) => {
      const next = !current;
      try {
        localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        // persistence is best-effort
      }
      return next;
    });
  }, []);

  // The drawer only exists below 1024px; close it on navigation and when the viewport widens.
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);
  useEffect(() => {
    if (isDesktop) setDrawerOpen(false);
  }, [isDesktop]);

  // Document title follows the page.
  useEffect(() => {
    const item = findNavItemForPath(location.pathname);
    document.title = item ? `${item.label} · AIVA` : "AIVA";
  }, [location.pathname]);

  // Global shortcuts: Ctrl/⌘+K anywhere; "?" outside text fields.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing) return;
      if (isCommandMenuChord(event)) {
        event.preventDefault();
        if (!commandOpenRef.current) commandFocus.remember();
        setCommandOpen((open) => !open);
        return;
      }
      if (
        event.key === "?" &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !isEditableTarget(event.target) &&
        !(event.target instanceof Element && event.target.closest("[role='dialog'],[role='menu'],[role='listbox']"))
      ) {
        event.preventDefault();
        shortcutsFocus.remember();
        setShortcutsOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [commandFocus, shortcutsFocus]);

  const sidebarToggle = isDesktop
    ? {
        label: collapsed ? "Expand sidebar" : "Collapse sidebar",
        icon: collapsed ? PanelLeftOpen : PanelLeftClose,
        onClick: toggleCollapsed,
        expanded: !collapsed,
      }
    : {
        label: "Open navigation",
        icon: Menu,
        onClick: (event: { currentTarget: HTMLElement }) => {
          drawerFocus.remember(event.currentTarget);
          setDrawerOpen(true);
        },
        expanded: drawerOpen,
      };

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-background">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:shadow-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
      >
        Skip to content
      </a>

      <AppSidebar collapsed={collapsed} />
      <MobileSidebar
        open={drawerOpen && !isDesktop}
        onOpenChange={setDrawerOpen}
        onCloseAutoFocus={drawerFocus.restore}
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <AppHeader
          sidebarToggle={sidebarToggle}
          onOpenCommandMenu={(from) => {
            commandFocus.remember(from);
            setCommandOpen(true);
          }}
          onOpenShortcuts={(from) => {
            shortcutsFocus.remember(from);
            setShortcutsOpen(true);
          }}
        />

        {/* `relative` is load-bearing: it makes <main> the containing block for absolutely
            positioned descendants (e.g. sr-only labels), which otherwise resolve against the
            viewport, escape this scroller's clip, and give the document a phantom scrollbar
            that drags the whole fixed-height shell out of view. <main> is also the page's
            scroll container (pages and popovers rely on that). */}
        <main
          id="main"
          tabIndex={-1}
          className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain focus:outline-none"
        >
          <div className="min-h-full w-full p-4 min-[1441px]:p-6">
            <Outlet />
          </div>
        </main>
      </div>

      <CommandMenu open={commandOpen} onOpenChange={setCommandOpen} onCloseAutoFocus={commandFocus.restore} />
      <ShortcutsDialog
        open={shortcutsOpen}
        onOpenChange={setShortcutsOpen}
        onCloseAutoFocus={shortcutsFocus.restore}
      />
    </div>
  );
}
