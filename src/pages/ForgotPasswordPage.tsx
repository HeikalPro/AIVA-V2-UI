import { type FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { forgotPassword, setVerifyEmail } from "@/lib/auth-api";
import { formatUserError } from "@/lib/errors";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await forgotPassword(email.trim().toLowerCase());
      setVerifyEmail(email.trim().toLowerCase());
      setSubmitted(true);
    } catch (err) {
      setError(formatUserError(err, "api"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Forgot password" subtitle="We'll email you a reset code if an account exists.">
      {submitted ? (
        <div className="space-y-5">
          <p className="text-center text-sm text-slate-600">
            If an account exists for this email, you will receive password reset instructions.
          </p>
          <Link
            to="/reset-password"
            className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-[#004080] text-sm font-semibold text-white hover:bg-[#003060]"
          >
            Enter reset code
          </Link>
          <p className="text-center text-sm text-slate-500">
            <Link to="/login" className="font-medium text-slate-800 hover:underline">
              Back to sign in
            </Link>
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              className="h-11 rounded-xl border-slate-200 bg-slate-50 focus:bg-white"
            />
          </div>
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700" role="alert">
              {error}
            </div>
          )}
          <Button type="submit" className="h-11 w-full rounded-xl text-sm font-semibold" disabled={loading}>
            {loading ? "Sending..." : "Send reset instructions"}
          </Button>
          <p className="text-center text-sm text-slate-500">
            <Link to="/login" className="font-medium text-slate-800 hover:underline">
              Back to sign in
            </Link>
          </p>
        </form>
      )}
    </AuthShell>
  );
}
