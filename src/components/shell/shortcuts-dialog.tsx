import { Fragment } from "react";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { modKeyLabel } from "./keyboard";

type Shortcut = { keys: string[][]; label: string };

function shortcutGroups(): { title: string; items: Shortcut[] }[] {
  const mod = modKeyLabel();
  return [
    {
      title: "General",
      items: [
        { keys: [[mod, "K"]], label: "Open the command menu" },
        { keys: [["?"]], label: "Show keyboard shortcuts" },
        { keys: [["Esc"]], label: "Close a dialog, menu or the navigation drawer" },
      ],
    },
    {
      title: "Command menu and lists",
      items: [
        { keys: [["↑"], ["↓"]], label: "Move between results" },
        { keys: [["Enter"]], label: "Open the selected result" },
      ],
    },
    {
      title: "Navigation",
      items: [
        { keys: [["Tab"]], label: "Move focus (the first stop is “Skip to content”)" },
        { keys: [["Shift", "Tab"]], label: "Move focus backwards" },
      ],
    },
  ];
}

/** Keyboard shortcuts reference (Help menu, or “?” outside text fields). */
export function ShortcutsDialog({
  open,
  onOpenChange,
  onCloseAutoFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus?: (event: Event) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} size="md">
      <DialogContent onCloseAutoFocus={onCloseAutoFocus}>
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>Work through the console without the mouse.</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-5">
          {shortcutGroups().map((group) => (
            <section key={group.title} className="space-y-1.5">
              <h3 className="text-xs font-medium text-muted-foreground">{group.title}</h3>
              <dl className="divide-y divide-border rounded-lg border border-border">
                {group.items.map((item) => (
                  <div key={item.label} className="flex items-center justify-between gap-4 px-3 py-2">
                    <dt className="text-sm text-foreground">{item.label}</dt>
                    <dd className="flex shrink-0 items-center gap-1.5">
                      {item.keys.map((combo, comboIndex) => (
                        <Fragment key={combo.join("+")}>
                          {comboIndex > 0 && <span className="text-xs text-muted-foreground">/</span>}
                          <span className="flex items-center gap-1">
                            {combo.map((key) => (
                              <Kbd key={key}>{key}</Kbd>
                            ))}
                          </span>
                        </Fragment>
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
