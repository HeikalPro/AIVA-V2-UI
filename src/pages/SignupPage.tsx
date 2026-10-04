import { type FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { AuthShell, authLinkClass } from "@/components/auth/AuthShell";
import { LoginEmailField } from "@/components/auth/LoginEmailField";
import { FullScreenLoader } from "@/components/shell/full-screen-loader";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
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

  if (authLoading) return <FullScreenLoader />;
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
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Full name">
          <Input
            id="name"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={2}
            autoFocus
          />
        </Field>
        <LoginEmailField localPart={emailLocal} onLocalPartChange={setEmailLocal} />
        <Field label="Password" hint={passwordHint()}>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={PASSWORD_MIN_LENGTH}
          />
        </Field>
        <Field label="Confirm password">
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={PASSWORD_MIN_LENGTH}
          />
        </Field>
        {error && <Alert tone="danger" description={error} />}
        <Button type="submit" size="lg" className="w-full" loading={loading}>
          {loading ? "Creating account..." : "Sign up"}
        </Button>
        <p className="pt-1 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/login" className={authLinkClass}>
            Sign in
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
