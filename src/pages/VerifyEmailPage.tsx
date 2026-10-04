import { type FormEvent, useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { AuthShell, authLinkClass } from "@/components/auth/AuthShell";
import { FullScreenLoader } from "@/components/shell/full-screen-loader";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  clearVerifyEmail,
  getVerifyEmail,
  resendEmailOtp,
  setVerifyEmail,
  verifyEmailOtp,
} from "@/lib/auth-api";
import { formatUserError } from "@/lib/errors";

const RESEND_COOLDOWN_SEC = 60;

export function VerifyEmailPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState(getVerifyEmail());
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (!email) return;
    setVerifyEmail(email);
  }, [email]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [cooldown]);

  if (authLoading) return <FullScreenLoader />;
  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      await verifyEmailOtp(email.trim().toLowerCase(), otp.trim());
      clearVerifyEmail();
      navigate("/login", { state: { verified: true } });
    } catch (err) {
      setError(formatUserError(err, "api"));
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (cooldown > 0) return;
    setError(null);
    setInfo(null);
    try {
      await resendEmailOtp(email.trim().toLowerCase());
      setInfo("If your request is valid, a new code has been sent.");
      setCooldown(RESEND_COOLDOWN_SEC);
    } catch (err) {
      setError(formatUserError(err, "api"));
    }
  }

  return (
    <AuthShell title="Verify your email" subtitle="Enter the verification code sent to your email.">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Email">
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </Field>
        <Field label="Verification code" hint="6 digits">
          <Input
            id="otp"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
            required
            className="h-11 text-center font-mono text-lg tracking-[0.4em]"
          />
        </Field>
        {error && <Alert tone="danger" description={error} />}
        {info && <Alert tone="success" description={info} />}
        <Button type="submit" size="lg" className="w-full" loading={loading}>
          {loading ? "Verifying..." : "Verify email"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="w-full tabular-nums"
          disabled={cooldown > 0 || !email.trim()}
          onClick={handleResend}
        >
          {cooldown > 0 ? `Resend code (${cooldown}s)` : "Resend code"}
        </Button>
        <p className="pt-1 text-center text-sm">
          <Link to="/login" className={authLinkClass}>
            Back to sign in
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
