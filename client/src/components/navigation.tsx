import { Link, useLocation } from "wouter";

export default function Navigation() {
  const [location] = useLocation();

  const navItems = [
    { path: "/", label: "Overview" },
    { path: "/highlights", label: "Research Highlights" },
    { path: "/research", label: "Publications" },
    { path: "/updates", label: "Events" },
    { path: "/work-with-us", label: "Work With Us" },
  ];

  return (
    <header className="w-full bg-white border-b border-gray-200" data-testid="ml-header">
      <div className="mx-auto max-w-[980px] px-4 sm:px-6">
        {/* Header title - clickable to home */}
        <div className="flex h-14 items-center">
          <Link href="/">
            <a className="text-2xl font-semibold text-gray-900 tracking-tight leading-tight hover:opacity-70 transition-opacity cursor-pointer" data-testid="ml-title" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Helvetica, Arial, sans-serif', letterSpacing: '-0.02em' }}>
              CONNEQT Health Research
            </a>
          </Link>
        </div>
        {/* Apple's specific gold accent */}
        <div className="h-px" style={{ background: 'linear-gradient(90deg, #ff9500 0%, #ffad33 50%, #ff9500 100%)' }} data-testid="gold-accent" />
        
        {/* Horizontal navigation menu */}
        <nav className="flex h-12 items-center border-b border-gray-200" role="navigation" aria-label="Main navigation">
          <ul className="flex space-x-8 list-none m-0 p-0">
            {navItems.map((item) => {
              const isActive = location === item.path;
              return (
                <li key={item.path}>
                  <Link href={item.path}>
                    <a
                      className={`relative inline-block text-sm py-3 apple-transition apple-focus-ring ${
                        isActive ? "font-medium" : "hover:opacity-70"
                      }`}
                      style={{
                        color: isActive ? "#1D1D1F" : "#6E6E73",
                        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Helvetica, Arial, sans-serif'
                      }}
                      data-testid={`nav-${item.path.slice(1) || 'overview'}`}
                      aria-current={isActive ? "page" : undefined}
                    >
                      {item.label}
                      {isActive && (
                        <div 
                          className="absolute bottom-0 left-0 right-0 h-0.5" 
                          style={{ backgroundColor: "#FF9500" }}
                          aria-hidden="true"
                        />
                      )}
                    </a>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </header>
  );
}
