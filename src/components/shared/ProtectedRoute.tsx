import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { canAccess } from "@/lib/roles";
import type { ReactNode } from "react";

type ProtectedRouteProps = {
  roles?: string[];
  children?: ReactNode;
};

export function ProtectedRoute({ roles = [], children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading...</div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (roles.length > 0 && !canAccess(user.roles, roles)) {
    return <Navigate to="/" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}
