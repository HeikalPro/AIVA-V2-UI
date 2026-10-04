import { type FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { AuthShell, authLinkClass } from "@/components/auth/AuthShell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
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
        <div className="space-y-4">
          <Alert
            tone="info"
            description="If an account exists for this email, you will receive password reset instructions."
          />
          <Button asChild size="lg" className="w-full">
            <Link to="/reset-password">Enter reset code</Link>
          </Button>
          <p className="pt-1 text-center text-sm">
            <Link to="/login" className={authLinkClass}>
              Back to sign in
            </Link>
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Email">
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </Field>
          {error && <Alert tone="danger" description={error} />}
          <Button type="submit" size="lg" className="w-full" loading={loading}>
            {loading ? "Sending..." : "Send reset instructions"}
          </Button>
          <p className="pt-1 text-center text-sm">
            <Link to="/login" className={authLinkClass}>
              Back to sign in
            </Link>
          </p>
        </form>
      )}
    </AuthShell>
  );
}
