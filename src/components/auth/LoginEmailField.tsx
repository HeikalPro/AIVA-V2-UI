import { User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DEFAULT_LOGIN_EMAIL_DOMAIN,
  LOGIN_EMAIL_DOMAIN_OPTIONS,
  OTHER_EMAIL_DOMAIN,
  parsePastedEmail,
  usesEmailDomainPicker,
} from "@/lib/login-email";

type Props = {
  localPart: string;
  domain: string;
  customDomain: string;
  onLocalPartChange: (value: string) => void;
  onDomainChange: (value: string) => void;
  onCustomDomainChange: (value: string) => void;
  autoFocus?: boolean;
};

export function LoginEmailField({
  localPart,
  domain,
  customDomain,
  onLocalPartChange,
  onDomainChange,
  onCustomDomainChange,
  autoFocus,
}: Props) {
  if (!usesEmailDomainPicker()) {
    return (
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
          <Input
            id="email"
            type="email"
            autoComplete="username"
            placeholder="Enter your email"
            value={localPart}
            onChange={(e) => onLocalPartChange(e.target.value)}
            required
            autoFocus={autoFocus}
            className="h-11 rounded-xl border-slate-200 bg-slate-50 pl-10 focus:bg-white"
          />
        </div>
      </div>
    );
  }

  function handleLocalChange(value: string) {
    if (value.includes("@")) {
      const parsed = parsePastedEmail(value);
      onLocalPartChange(parsed.local);
      onDomainChange(parsed.domain);
      onCustomDomainChange(parsed.customDomain);
      return;
    }
    onLocalPartChange(value);
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="email-local">Email</Label>
      <div className="flex h-11 items-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 focus-within:border-slate-300 focus-within:bg-white focus-within:ring-1 focus-within:ring-slate-200">
        <User className="ml-3 h-[18px] w-[18px] shrink-0 text-slate-400" />
        <input
          id="email-local"
          type="text"
          autoComplete="username"
          placeholder="username"
          value={localPart}
          onChange={(e) => handleLocalChange(e.target.value)}
          required
          autoFocus={autoFocus}
          className="min-w-0 flex-1 border-0 bg-transparent py-2 pl-2 pr-1 text-sm text-slate-900 outline-none placeholder:text-slate-400"
        />
        <span className="shrink-0 select-none text-sm text-slate-400">@</span>
        <select
          id="email-domain"
          value={domain}
          onChange={(e) => onDomainChange(e.target.value)}
          className="h-full max-w-[9.5rem] shrink-0 cursor-pointer border-0 bg-transparent py-2 pr-3 pl-1 text-sm font-medium text-slate-700 outline-none"
          aria-label="Email provider"
        >
          {LOGIN_EMAIL_DOMAIN_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      {domain === OTHER_EMAIL_DOMAIN ? (
        <Input
          type="text"
          placeholder="yourdomain.com"
          value={customDomain}
          onChange={(e) => onCustomDomainChange(e.target.value)}
          required
          className="h-10 rounded-xl border-slate-200 bg-slate-50 text-sm focus:bg-white"
          aria-label="Custom email domain"
        />
      ) : null}
    </div>
  );
}

export { DEFAULT_LOGIN_EMAIL_DOMAIN };
