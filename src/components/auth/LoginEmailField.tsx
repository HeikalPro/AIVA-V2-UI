import { User } from "lucide-react";
import { Label } from "@/components/ui/label";
import { LOGIN_EMAIL_DOMAIN, parseLoginLocalPart } from "@/lib/login-email";

type Props = {
  localPart: string;
  onLocalPartChange: (value: string) => void;
  autoFocus?: boolean;
};

export function LoginEmailField({ localPart, onLocalPartChange, autoFocus }: Props) {
  function handleChange(value: string) {
    onLocalPartChange(parseLoginLocalPart(value));
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
          onChange={(e) => handleChange(e.target.value)}
          required
          autoFocus={autoFocus}
          className="min-w-0 flex-1 border-0 bg-transparent py-2 pl-2 pr-1 text-sm text-slate-900 outline-none placeholder:text-slate-400"
        />
        <span className="shrink-0 select-none pr-3 text-sm font-medium text-slate-600">
          @{LOGIN_EMAIL_DOMAIN}
        </span>
      </div>
    </div>
  );
}
