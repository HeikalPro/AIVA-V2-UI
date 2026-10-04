import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

/** Pretty-print when the value is valid JSON; fall back to the raw string when it isn't. */
function formatJson(raw: string): { text: string; count: number | null } {
  try {
    const parsed = JSON.parse(raw);
    return { text: JSON.stringify(parsed, null, 2), count: Array.isArray(parsed) ? parsed.length : null };
  } catch {
    return { text: raw, count: null };
  }
}

function CollapsibleJsonValue({ value }: { value: string }) {
  const [open, setOpen] = useState(false);
  const { text, count } = useMemo(() => formatJson(value), [value]);
  const label = count != null ? `${count} ${count === 1 ? "chunk" : "chunks"}` : `${text.length} characters`;

  return (
    <div>
      <Button variant="link" size="sm" className="h-6 px-0" aria-expanded={open} onClick={() => setOpen((prev) => !prev)}>
        {open ? <ChevronDown aria-hidden="true" className="h-3.5 w-3.5" /> : <ChevronRight aria-hidden="true" className="h-3.5 w-3.5" />}
        {open ? "Hide" : "Show"}
        <span className="font-normal text-muted-foreground">({label})</span>
      </Button>
      {open && (
        <pre
          dir="auto"
          className="mt-1.5 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-md border border-border bg-surface-muted p-2.5 font-mono text-xs leading-relaxed text-foreground"
        >
          {text}
        </pre>
      )}
    </div>
  );
}

/** Field names rendered in monospace (identifiers, addresses, technical values). */
const MONO_KEY = /(^id$|_id$|^request_id$|ip_address|client_ip|^path$|route_template|handler_name|query_string|model_name|corpus_id|sha256|verticals)/;
const TIME_KEY = /(_at$|^when$)/;
const LONG_TEXT_KEY = /(summary|message|old_value|new_value|query_text|user_agent|metadata|stack_trace|exception)/;

const ACRONYMS: Record<string, string> = { id: "ID", ip: "IP", url: "URL", http: "HTTP", ai: "AI", llm: "LLM", json: "JSON", ms: "(ms)", otp: "OTP", sha256: "SHA-256" };

function humanizeKey(key: string): string {
  const words = key.split("_").filter(Boolean).map((w) => ACRONYMS[w.toLowerCase()] ?? w.toLowerCase());
  const text = words.join(" ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

type Props = {
  /** The raw log row (any log type). Null closes the sheet. */
  row: object | null;
  onClose: () => void;
  title?: string;
};

/** Generic "Log details": every non-empty field of the selected row as a key/value list. */
export function LogDetailsSheet({ row, onClose, title = "Log details" }: Props) {
  const entries = row
    ? Object.entries(row as Record<string, unknown>).filter(([, value]) => value != null && value !== "")
    : [];

  return (
    <Sheet open={row !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent size="lg">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>Every recorded field of the selected entry.</SheetDescription>
        </SheetHeader>
        <SheetBody>
          <dl className="divide-y divide-border">
            {entries.map(([key, value]) => {
              const text = String(value);
              const mono = MONO_KEY.test(key);
              return (
                <div key={key} className="grid gap-x-4 gap-y-1 py-2 first:pt-0 sm:grid-cols-[10rem_minmax(0,1fr)]">
                  <dt className="text-xs font-medium leading-5 text-muted-foreground">{humanizeKey(key)}</dt>
                  <dd className="min-w-0 text-ui text-foreground">
                    {key === "chunks_json" ? (
                      <CollapsibleJsonValue value={text} />
                    ) : TIME_KEY.test(key) && typeof value === "string" ? (
                      <span className="tabular-nums">
                        {formatDateTime(value, { dateStyle: "medium", timeStyle: "medium" })}
                        <span className="ml-2 font-mono text-xs text-muted-foreground">{value}</span>
                      </span>
                    ) : (
                      <span
                        dir={LONG_TEXT_KEY.test(key) ? "auto" : undefined}
                        className={cn("whitespace-pre-wrap [overflow-wrap:anywhere]", mono && "font-mono text-xs")}
                      >
                        {text}
                      </span>
                    )}
                  </dd>
                </div>
              );
            })}
          </dl>
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
