import { Navigate, Outlet, useLocation } from "react-router-dom";
import { ShieldOff } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { canAccess, canAccessPermission, getHomePath, type NavPermissionKey } from "@/lib/roles";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/data/empty-state";
import { FullScreenLoader } from "@/components/shell/full-screen-loader";

type ProtectedRouteProps = {
  roles?: string[];
  permission?: NavPermissionKey;
  children?: ReactNode;
};

export function ProtectedRoute({ roles = [], permission, children }: ProtectedRouteProps) {
  const { user, loading, logout } = useAuth();
  const location = useLocation();

  if (loading) return <FullScreenLoader />;

  if (!user) return <Navigate to="/login" replace />;

  const denied = permission
    ? !canAccessPermission(user, permission)
    : roles.length > 0 && !canAccess(user.roles, roles);

  if (denied) {
    // Send the user to the first page they can open. If that is this very page (they can open
    // nothing), show a notice instead of redirecting to ourselves forever.
    const home = getHomePath(user);
    if (home !== location.pathname) return <Navigate to={home} replace />;
    return (
      <EmptyState
        icon={ShieldOff}
        title="No pages available"
        description="Your account doesn't have access to any page yet. Ask an administrator to grant page access."
        action={
          <Button variant="outline" onClick={() => void logout()}>
            Sign out
          </Button>
        }
        className="min-h-[60vh]"
      />
    );
  }

  return children ? <>{children}</> : <Outlet />;
}
