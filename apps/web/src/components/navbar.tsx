import { Link } from "@tanstack/react-router"
import { cn } from "@/lib/utils"

const navLinks = [
  { to: "/battle-maps", label: "Battle Maps" },
  { to: "/parties", label: "Parties" },
  { to: "/worlds", label: "Worlds" },
] as const

export function Navbar() {
  return (
    <nav className="sticky top-0 z-50 border-b bg-background">
      <div className="flex h-14 items-center gap-6 px-6">
        <Link
          to="/"
          className="font-semibold text-foreground no-underline hover:text-foreground/90"
        >
          Vizier's Vault
        </Link>
        <div className="flex gap-4">
          {navLinks.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              activeProps={{
                className: "font-medium text-foreground",
              }}
              className={cn(
                "text-sm text-muted-foreground no-underline transition-colors hover:text-foreground"
              )}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  )
}
