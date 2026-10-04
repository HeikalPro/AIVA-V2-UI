import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";

type DeepLinkOptions = {
  /** Opens the page's create dialog/sheet (`?action=create`). */
  onCreate?: () => void;
  /** Whether the current user may create; when false the param is dropped without opening anything. */
  canCreate?: boolean;
  /** Initialises the search box (`?q=<text>`). */
  onSearch?: (query: string) => void;
  /** `?action=create` waits until the data the create form defaults depend on has loaded (default true). */
  ready?: boolean;
};

/**
 * Command-palette deep links for table pages:
 *   `?action=create` → open the create dialog (if allowed), `?q=<text>` → initial search text.
 * The params are consumed (removed with `replace`) so a later palette jump works again, including
 * when the palette navigates to the page that is already open.
 */
export function useDeepLinks({ onCreate, canCreate = true, onSearch, ready = true }: DeepLinkOptions) {
  const [searchParams, setSearchParams] = useSearchParams();
  const action = searchParams.get("action");
  const query = searchParams.get("q");

  const onCreateRef = useRef(onCreate);
  const onSearchRef = useRef(onSearch);
  useEffect(() => {
    onCreateRef.current = onCreate;
    onSearchRef.current = onSearch;
  });

  useEffect(() => {
    const handleAction = action != null && ready;
    if (query == null && !handleAction) return;
    if (query != null) onSearchRef.current?.(query);
    if (handleAction && action === "create" && canCreate) onCreateRef.current?.();
    // One update for both params (two functional updates in one tick would not compose).
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("q");
        if (handleAction) next.delete("action");
        return next;
      },
      { replace: true },
    );
  }, [action, query, ready, canCreate, setSearchParams]);
}
