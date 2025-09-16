import { useLocation } from "wouter";
import { Link } from "wouter";

interface NavigationProps {
  onSearch?: (query: string) => void;
}

export default function Navigation({ onSearch }: NavigationProps) {
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "Research", testId: "nav-research" },
    { href: "/highlights", label: "Highlights", testId: "nav-highlights" },
    { href: "/updates", label: "Updates", testId: "nav-updates" },
    { href: "/about", label: "About", testId: "nav-about" },
  ];

  const isActive = (href: string) => {
    if (href === "/") {
      return location === "/";
    }
    return location.startsWith(href);
  };

  return (
    <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm border-b border-border/20">
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex items-center justify-between h-11">
          {/* Logo */}
          <div className="flex-shrink-0">
            <Link href="/">
              <span className="text-lg font-medium text-foreground cursor-pointer tracking-tight" data-testid="logo">
                CardiEx Research
              </span>
            </Link>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center">
            <div className="hidden sm:flex items-center space-x-0">
              {navItems.map((item) => (
                <Link 
                  key={item.href} 
                  href={item.href}
                  className={`
                    relative px-4 py-2 text-sm font-normal transition-colors duration-200 ease-out cursor-pointer
                    ${
                      isActive(item.href)
                        ? "text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }
                  `}
                  data-testid={item.testId}
                >
                  {item.label}
                  {isActive(item.href) && (
                    <div className="absolute bottom-0 left-0 right-0 h-px bg-foreground" />
                  )}
                </Link>
              ))}
            </div>
            
            {/* Mobile navigation */}
            <div className="flex sm:hidden items-center space-x-1">
              {navItems.map((item) => (
                <Link 
                  key={item.href} 
                  href={item.href}
                  className={`
                    relative px-3 py-2 text-xs font-normal transition-colors duration-200 ease-out cursor-pointer
                    ${
                      isActive(item.href)
                        ? "text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }
                  `}
                  data-testid={`mobile-${item.testId}`}
                >
                  {item.label}
                  {isActive(item.href) && (
                    <div className="absolute bottom-0 left-0 right-0 h-px bg-foreground" />
                  )}
                </Link>
              ))}
            </div>
          </div>

          {/* Right spacer for balance */}
          <div className="w-20" />
        </div>
      </div>
    </nav>
  );
}
