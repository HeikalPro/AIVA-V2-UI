import { type FormEvent, useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
    <AuthShell
      title="Verify your email"
      subtitle="Enter the verification code sent to your email."
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="h-11 rounded-xl border-slate-200 bg-slate-50 focus:bg-white"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="otp">Verification code</Label>
          <Input
            id="otp"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
            required
            className="h-11 rounded-xl border-slate-200 bg-slate-50 text-center text-lg tracking-widest focus:bg-white"
          />
        </div>
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700" role="alert">
            {error}
          </div>
        )}
        {info && (
          <div className="rounded-xl border border-green-200 bg-green-50 px-3.5 py-3 text-sm text-green-800" role="status">
            {info}
          </div>
        )}
        <Button type="submit" className="h-11 w-full rounded-xl text-sm font-semibold" disabled={loading}>
          {loading ? "Verifying..." : "Verify email"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11 w-full rounded-xl text-sm"
          disabled={cooldown > 0 || !email.trim()}
          onClick={handleResend}
        >
          {cooldown > 0 ? `Resend code (${cooldown}s)` : "Resend code"}
        </Button>
        <p className="text-center text-sm text-slate-500">
          <Link to="/login" className="font-medium text-slate-800 hover:underline">
            Back to sign in
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
