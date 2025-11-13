import { Link } from "wouter";
import logoPath from "@assets/conneqt_health_wide@4x_1763072530232.png";

export default function Navigation() {
  return (
    <header className="w-full bg-white border-b border-gray-200" data-testid="ml-header">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* Header with logo and space for future navigation */}
        <div className="flex h-14 items-center justify-between">
          {/* Logo - left aligned */}
          <Link 
            href="/"
            className="flex items-center hover:opacity-70 transition-opacity cursor-pointer" 
            data-testid="ml-logo-link"
          >
            <img 
              src={logoPath} 
              alt="CONNEQT Health logo" 
              className="h-8"
              data-testid="company-logo"
            />
          </Link>
          
          {/* Reserved space for future navigation items - right aligned */}
          <div className="flex items-center gap-6" data-testid="nav-future-items">
            {/* Future navigation items will go here */}
          </div>
        </div>
        {/* Simple black accent line */}
        <div className="h-px bg-black" data-testid="accent-line" />
      </div>
    </header>
  );
}
