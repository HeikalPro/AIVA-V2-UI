import { LogOut, Monitor } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme, type Theme } from "@/contexts/ThemeContext";
import { displayRole } from "@/lib/roles";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip } from "@/components/ui/tooltip";

export function userDisplayName(user: { first_name: string | null; last_name: string | null; email: string }): string {
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ").trim();
  return name || user.email;
}

/** Avatar menu: who is signed in, theme choice, sign out. */
export function UserMenu() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  if (!user) return null;
  const name = userDisplayName(user);
  const role = displayRole(user.roles);

  return (
    <DropdownMenu>
      <Tooltip content="Account">
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`Account menu for ${name}`} className="rounded-full">
            <Avatar name={name} size="sm" title={false} />
          </Button>
        </DropdownMenuTrigger>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex items-center gap-3 px-2 py-2 font-normal">
          <Avatar name={name} size="md" title={false} />
          <span className="min-w-0 flex-1">
            <span dir="auto" className="block truncate text-sm font-medium text-foreground">
              {name}
            </span>
            <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
            <Badge variant="neutral" className="mt-1.5">
              {role}
            </Badge>
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="flex items-center gap-2">
          <Monitor aria-hidden="true" className="h-3.5 w-3.5" />
          Theme
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme} onValueChange={(value) => setTheme(value as Theme)}>
          <DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">Dark</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem icon={LogOut} onSelect={() => void logout()}>
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
