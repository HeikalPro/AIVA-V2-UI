import {
  Activity,
  Bell,
  Briefcase,
  Building2,
  Cpu,
  FileText,
  FileUp,
  FolderSync,
  LayoutDashboard,
  MessageSquare,
  ScrollText,
  Shield,
  SlidersHorizontal,
  ThumbsUp,
  Ticket,
  Upload,
  UserCheck,
  Users,
  type LucideIcon,
} from "lucide-react";

/** lucide icons referenced by name from NAV_ITEMS (`icon` field). */
const NAV_ICONS: Record<string, LucideIcon> = {
  Activity,
  Bell,
  Briefcase,
  Building2,
  Cpu,
  FileText,
  FileUp,
  FolderSync,
  LayoutDashboard,
  MessageSquare,
  ScrollText,
  Shield,
  SlidersHorizontal,
  ThumbsUp,
  Ticket,
  Upload,
  UserCheck,
  Users,
};

export function navIcon(name: string): LucideIcon {
  return NAV_ICONS[name] ?? LayoutDashboard;
}
