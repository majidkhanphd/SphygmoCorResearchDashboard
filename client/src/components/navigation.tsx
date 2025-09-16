import { useState } from "react";
import { Link } from "wouter";
import { Search, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface NavigationProps {
  onSearch: (query: string) => void;
}

export default function Navigation({ onSearch }: NavigationProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(searchQuery);
  };

  return (
    <nav className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-4">
            <div className="flex-shrink-0">
              <Link href="/">
                <span className="text-xl font-bold text-primary cursor-pointer" data-testid="logo">
                  CardiEx Research
                </span>
              </Link>
            </div>
            <div className="hidden md:block">
              <div className="ml-10 flex items-baseline space-x-4">
                <Link href="/" className="text-foreground hover:text-primary px-3 py-2 text-sm font-medium" data-testid="nav-publications">
                  Publications
                </Link>
                <Link href="/categories" className="text-muted-foreground hover:text-primary px-3 py-2 text-sm font-medium" data-testid="nav-categories">
                  Categories
                </Link>
                <Link href="/featured" className="text-muted-foreground hover:text-primary px-3 py-2 text-sm font-medium" data-testid="nav-featured">
                  Featured
                </Link>
                <Link href="/about" className="text-muted-foreground hover:text-primary px-3 py-2 text-sm font-medium" data-testid="nav-about">
                  About
                </Link>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <form onSubmit={handleSearch} className="relative hidden md:block">
              <Input
                type="text"
                placeholder="Search publications..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64 pr-10"
                data-testid="search-input"
              />
              <Button
                type="submit"
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
                data-testid="search-button"
              >
                <Search className="h-4 w-4" />
              </Button>
            </form>
            
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              data-testid="mobile-menu-button"
            >
              {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>
        
        {/* Mobile menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
              <Link href="/" className="text-foreground hover:text-primary block px-3 py-2 text-base font-medium" data-testid="mobile-nav-publications">
                Publications
              </Link>
              <Link href="/categories" className="text-muted-foreground hover:text-primary block px-3 py-2 text-base font-medium" data-testid="mobile-nav-categories">
                Categories
              </Link>
              <Link href="/featured" className="text-muted-foreground hover:text-primary block px-3 py-2 text-base font-medium" data-testid="mobile-nav-featured">
                Featured
              </Link>
              <Link href="/about" className="text-muted-foreground hover:text-primary block px-3 py-2 text-base font-medium" data-testid="mobile-nav-about">
                About
              </Link>
              
              <form onSubmit={handleSearch} className="px-3 pt-2">
                <div className="relative">
                  <Input
                    type="text"
                    placeholder="Search publications..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pr-10"
                    data-testid="mobile-search-input"
                  />
                  <Button
                    type="submit"
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
                    data-testid="mobile-search-button"
                  >
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
