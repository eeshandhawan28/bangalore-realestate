"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  Calculator,
  TrendingUp,
  Store,
  Shield,
} from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/portfolio", label: "Portfolio", icon: Building2 },
  { href: "/valuate", label: "Valuate", icon: Calculator },
  { href: "/market", label: "Market", icon: TrendingUp },
  { href: "/marketplace", label: "Marketplace", icon: Store },
  { href: "/rera", label: "RERA Check", icon: Shield },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex flex-col w-[240px] min-h-screen bg-surface border-r border-border fixed left-0 top-0 z-40">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-border">
        <Link href="/valuate" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Building2 className="w-4 h-4 text-white" />
          </div>
          <span className="font-display font-semibold text-lg text-foreground">
            PropIQ
          </span>
        </Link>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary-highlight text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-border flex items-center justify-between">
        <span className="text-xs text-muted-foreground px-3">Theme</span>
        <ThemeToggle />
      </div>
    </aside>
  );
}
