import { useEffect, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { AuthShell, authLinkClass } from "@/components/auth/AuthShell";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { setTokens } from "@/lib/api-client";
import { formatUserError } from "@/lib/errors";

export function ZohoCallbackPage() {
  const { refreshProfile } = useAuth();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const callbackError = searchParams.get("error");
    if (callbackError) {
      setError(callbackError);
      return;
    }

    const accessToken = searchParams.get("access_token");
    const refreshToken = searchParams.get("refresh_token");
    const tokenType = searchParams.get("token_type") ?? "bearer";

    if (!accessToken || !refreshToken) {
      setError("Missing login tokens from Zoho callback");
      return;
    }

    setTokens({
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: tokenType,
    });

    refreshProfile()
      .then(() => setReady(true))
      .catch((err) => setError(formatUserError(err, "login")));
  }, [refreshProfile, searchParams]);

  if (ready) return <Navigate to="/" replace />;

  return (
    <AuthShell title="Completing sign-in">
      {error ? (
        <div className="space-y-4">
          <Alert tone="danger" description={error} />
          <p className="text-center text-sm">
            <a href="/login" className={authLinkClass}>
              Back to login
            </a>
          </p>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-surface-muted px-3 py-3">
          <Spinner label="Finishing Zoho authentication…" showLabel />
        </div>
      )}
    </AuthShell>
  );
}
