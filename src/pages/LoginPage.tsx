import { type FormEvent, useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { AuthShell, authLinkClass } from "@/components/auth/AuthShell";
import { LoginEmailField } from "@/components/auth/LoginEmailField";
import { FullScreenLoader } from "@/components/shell/full-screen-loader";
import { formatUserError } from "@/lib/errors";
import { isZohoLoginEnabled } from "@/lib/zoho-login";
import { buildLoginEmail } from "@/lib/login-email";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
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

  if (authLoading) return <FullScreenLoader />;

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
    <AuthShell title="Sign in" subtitle="Use your GoChat247 username and password.">
      <form onSubmit={handleSubmit} className="space-y-4">
        <LoginEmailField localPart={emailLocal} onLocalPartChange={setEmailLocal} autoFocus />

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="password">Password</Label>
            <Link to="/forgot-password" className={`text-xs ${authLinkClass}`}>
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="pr-10"
            />
            <IconButton
              label={showPassword ? "Hide password" : "Show password"}
              icon={showPassword ? EyeOff : Eye}
              size="sm"
              tooltip={false}
              aria-pressed={showPassword}
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-0.5 top-1/2 h-8 w-8 -translate-y-1/2"
            />
          </div>
        </div>

        {info && <Alert tone="success" description={info} />}
        {error && (
          <Alert
            tone="danger"
            description={
              <>
                {error}
                {error.toLowerCase().includes("verify your email") ? (
                  <span className="mt-1 block">
                    <Link to="/verify-email" className={authLinkClass}>
                      Go to email verification
                    </Link>
                  </span>
                ) : null}
              </>
            }
          />
        )}

        <Button type="submit" size="lg" className="w-full" loading={loading}>
          {loading ? "Signing in..." : "Sign in"}
        </Button>

        {zohoLoginEnabled ? (
          <>
            <div className="flex items-center gap-3" aria-hidden="true">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">or</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <Button
              type="button"
              variant="outline"
              size="lg"
              className="w-full"
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

        <p className="pt-1 text-center text-sm text-muted-foreground">
          No account?{" "}
          <Link to="/signup" className={authLinkClass}>
            Sign up
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
