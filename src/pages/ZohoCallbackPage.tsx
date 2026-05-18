import { useEffect, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { setTokens } from "@/lib/api-client";

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
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, [refreshProfile, searchParams]);

  if (ready) return <Navigate to="/" replace />;

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-100 bg-white p-8 text-center shadow-lg">
        <h1 className="text-xl font-bold text-slate-800">Completing sign-in</h1>
        {error ? (
          <>
            <p className="mt-4 text-sm text-red-600">{error}</p>
            <a href="/login" className="mt-4 inline-block text-sm font-semibold text-[#004080] hover:underline">
              Back to login
            </a>
          </>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">Finishing Zoho authentication...</p>
        )}
      </div>
    </div>
  );
}
