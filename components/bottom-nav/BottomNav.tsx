import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, BarChart, User, LucideIcon } from "lucide-react";

interface TabItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

const TABS: TabItem[] = [
  { label: "Home", href: "/home", icon: Home },
  { label: "Configuration", href: "/profile/monitoring", icon: BarChart },
  { label: "Profile", href: "/profile", icon: User },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center justify-around border-t border-neutral-200 bg-white py-2.5">
      {TABS.map(({ label, href, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={`flex flex-col items-center gap-1 px-3 py-1 text-[11px] ${
              active ? "text-black-500" : "text-neutral-400"
            }`}
          >
            <Icon className="h-5 w-5" strokeWidth={active ? 2.25 : 2} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
