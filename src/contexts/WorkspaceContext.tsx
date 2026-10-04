import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useAccounts } from "@/hooks/useAccounts";
import { ROLES } from "@/lib/roles";
import type { Account } from "@/types/api";

/*
 * Global workspace (= account) selection for account-scoped pages.
 *
 *   const { accounts, account, accountId, setAccountId, isLoading } = useWorkspace();
 *
 * - `accounts` is exactly the list pages loaded themselves before the shell existed:
 *   useAccounts(isSuperAdmin ? null : user.organization_id) — same React Query key, shared cache.
 * - `accountId` is the remembered selection (per user, localStorage `aiva-workspace:<userId>`)
 *   when it is still in `accounts`, otherwise the first account (the old page default), or
 *   null while loading / when the user has no accounts.
 * - `setAccountId(id)` switches the workspace everywhere and remembers it; `null` forgets the
 *   choice (falls back to the first account).
 */

export type WorkspaceContextValue = {
  accounts: Account[];
  account: Account | null;
  accountId: number | null;
  setAccountId: (id: number | null) => void;
  /** First load of the account list. */
  isLoading: boolean;
  isError: boolean;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

const EMPTY: Account[] = [];

function storageKeyFor(userId: number | undefined): string | null {
  return userId == null ? null : `aiva-workspace:${userId}`;
}

function readStored(key: string | null): number | null {
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return null;
    const id = Number(raw);
    return Number.isFinite(id) ? id : null;
  } catch {
    return null;
  }
}

function writeStored(key: string | null, id: number | null) {
  if (!key) return;
  try {
    if (id == null) localStorage.removeItem(key);
    else localStorage.setItem(key, String(id));
  } catch {
    // persistence is best-effort
  }
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const isSuperAdmin = user?.roles.includes(ROLES.SUPER_ADMIN) ?? false;
  const { data, isLoading, isError } = useAccounts(isSuperAdmin ? null : user?.organization_id, !!user);
  const accounts = data ?? EMPTY;

  const storageKey = storageKeyFor(user?.id);
  const [selection, setSelection] = useState(() => ({ key: storageKey, id: readStored(storageKey) }));
  // A different user signed in: load that user's remembered workspace.
  if (selection.key !== storageKey) {
    setSelection({ key: storageKey, id: readStored(storageKey) });
  }

  const accountId = useMemo(() => {
    if (accounts.length === 0) return null;
    if (selection.id != null && accounts.some((a) => a.id === selection.id)) return selection.id;
    return accounts[0].id;
  }, [accounts, selection.id]);

  const account = useMemo(() => accounts.find((a) => a.id === accountId) ?? null, [accounts, accountId]);

  const setAccountId = useCallback(
    (id: number | null) => {
      setSelection({ key: storageKey, id });
      writeStored(storageKey, id);
    },
    [storageKey],
  );

  const value = useMemo<WorkspaceContextValue>(
    () => ({ accounts, account, accountId, setAccountId, isLoading, isError }),
    [accounts, account, accountId, setAccountId, isLoading, isError],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

/** The shell's workspace (account) context. Must be used inside the app shell (Layout). */
export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider (the app shell)");
  return ctx;
}

/** Like useWorkspace, but returns null outside the shell (e.g. components also used on auth screens). */
export function useOptionalWorkspace(): WorkspaceContextValue | null {
  return useContext(WorkspaceContext);
}
