import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthShell, authLinkClass } from "@/components/auth/AuthShell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { clearVerifyEmail, getVerifyEmail, resetPassword } from "@/lib/auth-api";
import { formatUserError } from "@/lib/errors";
import { PASSWORD_MIN_LENGTH } from "@/lib/password-hint";

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState(getVerifyEmail());
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await resetPassword({
        email: email.trim().toLowerCase(),
        otp: otp.trim(),
        password,
        confirmPassword,
      });
      clearVerifyEmail();
      navigate("/login", { state: { reset: true } });
    } catch (err) {
      setError(formatUserError(err, "api"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Reset password" subtitle="Enter the code from your email and choose a new password.">
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
        <Field label="Reset code" hint="6 digits">
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
        <Field label="New password">
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
        <Field label="Confirm new password">
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
          {loading ? "Updating..." : "Update password"}
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
