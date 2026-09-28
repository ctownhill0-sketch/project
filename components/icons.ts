import { createElement, type ComponentProps } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Columns3,
  Rows3,
  Rows4,
  X,
  Bell,
  ChevronRight,
  Command as CommandIcon,
  ExternalLink,
  Info,
  Keyboard,
  Radar,
  Search,
  TrendingDown,
  TrendingUp,
  Ban,
  BarChart3,
  Calculator,
  CheckCircle2,
  CircleDot,
  FileText,
  Kanban,
  LayoutDashboard,
  Menu,
  Moon,
  Palette,
  Phone,
  RotateCw,
  Settings,
  Sun,
  Timer,
  Users,
  XCircle,
  type LucideIcon,
} from "lucide-react";

type IconProps = Omit<ComponentProps<LucideIcon>, "ref"> & { "data-icon"?: string };

/** Every icon: 2px stroke, hidden from screen readers, marked with data-icon (brief 8.10). */
function wrap(Icon: LucideIcon, name: string) {
  function WrappedIcon(props: IconProps) {
    const defaults = { strokeWidth: 2, "aria-hidden": true, "data-icon": name } as IconProps;
    return createElement(Icon, { ...defaults, ...props });
  }
  WrappedIcon.displayName = `Icon(${name})`;
  return WrappedIcon;
}

export const Icons = {
  dashboard: wrap(LayoutDashboard, "dashboard"),
  leads: wrap(Users, "leads"),
  shops: wrap(Timer, "shops"),
  calls: wrap(Phone, "calls"),
  pipeline: wrap(Kanban, "pipeline"),
  roi: wrap(Calculator, "roi"),
  audits: wrap(FileText, "audits"),
  pilots: wrap(BarChart3, "pilots"),
  settings: wrap(Settings, "settings"),
  design: wrap(Palette, "design"),
  menu: wrap(Menu, "menu"),
  sun: wrap(Sun, "sun"),
  moon: wrap(Moon, "moon"),
  retry: wrap(RotateCw, "retry"),
  success: wrap(CheckCircle2, "success"),
  warning: wrap(AlertTriangle, "warning"),
  error: wrap(XCircle, "error"),
  neutral: wrap(CircleDot, "neutral"),
  excluded: wrap(Ban, "excluded"),
  finder: wrap(Radar, "finder"),
  bell: wrap(Bell, "bell"),
  search: wrap(Search, "search"),
  keyboard: wrap(Keyboard, "keyboard"),
  command: wrap(CommandIcon, "command"),
  info: wrap(Info, "info"),
  external: wrap(ExternalLink, "external"),
  chevron: wrap(ChevronRight, "chevron"),
  up: wrap(TrendingUp, "up"),
  down: wrap(TrendingDown, "down"),
  sortAsc: wrap(ArrowUp, "sort-asc"),
  sortDesc: wrap(ArrowDown, "sort-desc"),
  sortNone: wrap(ArrowUpDown, "sort-none"),
  columns: wrap(Columns3, "columns"),
  comfortable: wrap(Rows3, "comfortable"),
  compact: wrap(Rows4, "compact"),
  close: wrap(X, "close"),
};

export type IconName = keyof typeof Icons;
