import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LOGIN_EMAIL_DOMAIN, parseLoginLocalPart } from "@/lib/login-email";

type Props = {
  localPart: string;
  onLocalPartChange: (value: string) => void;
  autoFocus?: boolean;
};

const SUFFIX = `@${LOGIN_EMAIL_DOMAIN}`;

/** Username input with the fixed company-domain suffix (only the local part is typed). */
export function LoginEmailField({ localPart, onLocalPartChange, autoFocus }: Props) {
  function handleChange(value: string) {
    onLocalPartChange(parseLoginLocalPart(value));
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="email-local">Email</Label>
      <div className="relative">
        <Input
          id="email-local"
          type="text"
          autoComplete="username"
          placeholder="username"
          value={localPart}
          onChange={(e) => handleChange(e.target.value)}
          required
          autoFocus={autoFocus}
          aria-describedby="email-local-domain"
          // Room for the fixed suffix on the right.
          style={{ paddingRight: `calc(${SUFFIX.length}ch + 1rem)` }}
        />
        <span
          id="email-local-domain"
          className="pointer-events-none absolute inset-y-0 right-3 flex select-none items-center text-sm text-muted-foreground"
        >
          {SUFFIX}
        </span>
      </div>
    </div>
  );
}
