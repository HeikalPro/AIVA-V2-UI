import { type FormEvent, useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { Eye, EyeOff, Lock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { LoginEmailField } from "@/components/auth/LoginEmailField";
import { formatUserError } from "@/lib/errors";
import { isZohoLoginEnabled } from "@/lib/zoho-login";
import { buildLoginEmail } from "@/lib/login-email";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginPage() {
  const { login, loginWithZoho, user, loading: authLoading } = useAuth();
  const location = useLocation();
  const flash = location.state as { verified?: boolean; reset?: boolean } | null;
  const info = flash?.verified
    ? "Email verified. You can sign in now."
    : flash?.reset
      ? "Password updated. Please sign in."
      : null;
  const [emailLocal, setEmailLocal] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const zohoLoginEnabled = isZohoLoginEnabled();

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(buildLoginEmail(emailLocal), password);
    } catch (err) {
      setError(formatUserError(err, "login"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4">
      <div className="w-full max-w-[420px]">
        <div className="rounded-3xl border border-slate-100 bg-white px-10 py-12 shadow-xl shadow-slate-200/60">
          <div className="mb-10 flex flex-col items-center">
            <img src="/GoChat247_blue_transparent.png" alt="GoChat247" className="mb-4 h-20 w-20 object-contain" />
            <h1 className="text-2xl font-bold tracking-tight text-slate-800">Welcome to AIVA</h1>
            <p className="mt-2 text-sm text-slate-400">AI Virtual Assistant for Call Centers</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <LoginEmailField
              localPart={emailLocal}
              onLocalPartChange={setEmailLocal}
              autoFocus
            />

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link to="/forgot-password" className="text-xs font-medium text-slate-600 hover:underline">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-11 rounded-xl border-slate-200 bg-slate-50 pl-10 pr-10 focus:bg-white"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                </button>
              </div>
            </div>

            {info && (
              <div className="rounded-xl border border-green-200 bg-green-50 px-3.5 py-3 text-sm text-green-800" role="status">
                {info}
              </div>
            )}
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700" role="alert">
                {error}
                {error.toLowerCase().includes("verify your email") ? (
                  <p className="mt-2">
                    <Link to="/verify-email" className="font-medium underline">
                      Go to email verification
                    </Link>
                  </p>
                ) : null}
              </div>
            )}

            <Button type="submit" className="h-11 w-full rounded-xl text-sm font-semibold" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </Button>

            {zohoLoginEnabled ? (
              <>
                <div className="relative flex items-center gap-3 py-1">
                  <div className="h-px flex-1 bg-slate-200" />
                  <span className="text-xs text-slate-400">or</span>
                  <div className="h-px flex-1 bg-slate-200" />
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full rounded-xl text-sm font-semibold"
                  disabled={loading}
                  onClick={() => {
                    setLoading(true);
                    loginWithZoho();
                  }}
                >
                  Sign in with Zoho
                </Button>
              </>
            ) : null}

            <p className="text-center text-sm text-slate-500">
              No account?{" "}
              <Link to="/signup" className="font-medium text-slate-800 hover:underline">
                Sign up
              </Link>
            </p>
          </form>
        </div>
        <p className="mt-6 text-center text-xs text-slate-400">GoChat247 · AIVA</p>
      </div>
    </div>
  );
}
