import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
          <Label htmlFor="otp">Reset code</Label>
          <Input
            id="otp"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
            required
            className="h-11 rounded-xl border-slate-200 bg-slate-50 text-center text-lg tracking-widest focus:bg-white"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">New password</Label>
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
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm new password</Label>
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
          {loading ? "Updating..." : "Update password"}
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
