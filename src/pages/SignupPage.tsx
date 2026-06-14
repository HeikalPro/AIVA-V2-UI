import { type FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginEmailField } from "@/components/auth/LoginEmailField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signup, setVerifyEmail } from "@/lib/auth-api";
import { formatUserError } from "@/lib/errors";
import { buildLoginEmail } from "@/lib/login-email";
import { PASSWORD_MIN_LENGTH, passwordHint } from "@/lib/password-hint";

export function SignupPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [emailLocal, setEmailLocal] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
      const email = buildLoginEmail(emailLocal).toLowerCase();
      await signup({
        name: name.trim(),
        email,
        password,
        confirmPassword,
      });
      setVerifyEmail(email);
      navigate("/verify-email");
    } catch (err) {
      setError(formatUserError(err, "api"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Create your account" subtitle="Sign up to use AIVA">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="name">Full name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={2}
            autoFocus
            className="h-11 rounded-xl border-slate-200 bg-slate-50 focus:bg-white"
          />
        </div>
        <LoginEmailField localPart={emailLocal} onLocalPartChange={setEmailLocal} />
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={PASSWORD_MIN_LENGTH}
            className="h-11 rounded-xl border-slate-200 bg-slate-50 focus:bg-white"
          />
          <p className="text-xs text-slate-400">{passwordHint()}</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={PASSWORD_MIN_LENGTH}
            className="h-11 rounded-xl border-slate-200 bg-slate-50 focus:bg-white"
          />
        </div>
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700" role="alert">
            {error}
          </div>
        )}
        <Button type="submit" className="h-11 w-full rounded-xl text-sm font-semibold" disabled={loading}>
          {loading ? "Creating account..." : "Sign up"}
        </Button>
        <p className="text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-slate-800 hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
