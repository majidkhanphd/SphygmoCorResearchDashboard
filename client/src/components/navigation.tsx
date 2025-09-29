import { Link } from "wouter";
import { useState } from "react";

export default function Navigation() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <>
      {/* Apple's complete global navigation */}
      <nav className="sticky top-0 z-50 w-full bg-black text-white" data-testid="apple-header">
        <div className="mx-auto flex h-11 max-w-[980px] items-center justify-between px-4">
          {/* Apple logo */}
          <div className="flex items-center">
            <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20" data-testid="apple-logo">
              <path d="M15.95 10.78c.03-2.21 1.8-3.28 1.88-3.34-1.02-1.49-2.62-1.7-3.18-1.72-1.35-.14-2.64.79-3.32.79-.69 0-1.74-.77-2.87-.75-1.47.03-2.83.86-3.58 2.17-1.53 2.65-.39 6.58.97 8.73.71 1.05 1.55 2.24 2.66 2.2 1.09-.05 1.5-.7 2.82-.7 1.32 0 1.69.7 2.84.68 1.18-.03 1.88-1.07 2.58-2.12.81-1.22 1.14-2.4 1.16-2.46-.03-.01-2.22-.85-2.25-3.37z"/>
              <path d="M13.41 4.24c.58-.69.97-1.65.86-2.6-.83.03-1.84.55-2.44 1.24-.54.62-.99 1.61-.87 2.56.92.07 1.86-.47 2.45-1.2z"/>
            </svg>
          </div>
          
          {/* Apple's complete navigation menu */}
          <div className="hidden lg:flex flex-1 items-center justify-center space-x-8">
            <a href="#" className="text-xs font-normal text-white hover:opacity-70 transition-opacity" data-testid="nav-store">Store</a>
            <a href="#" className="text-xs font-normal text-white hover:opacity-70 transition-opacity" data-testid="nav-mac">Mac</a>
            <a href="#" className="text-xs font-normal text-white hover:opacity-70 transition-opacity" data-testid="nav-ipad">iPad</a>
            <a href="#" className="text-xs font-normal text-white hover:opacity-70 transition-opacity" data-testid="nav-iphone">iPhone</a>
            <a href="#" className="text-xs font-normal text-white hover:opacity-70 transition-opacity" data-testid="nav-watch">Watch</a>
            <a href="#" className="text-xs font-normal text-white hover:opacity-70 transition-opacity" data-testid="nav-vision">Vision</a>
            <a href="#" className="text-xs font-normal text-white hover:opacity-70 transition-opacity" data-testid="nav-airpods">AirPods</a>
            <a href="#" className="text-xs font-normal text-white hover:opacity-70 transition-opacity" data-testid="nav-tv-home">TV & Home</a>
            <a href="#" className="text-xs font-normal text-white hover:opacity-70 transition-opacity" data-testid="nav-entertainment">Entertainment</a>
            <a href="#" className="text-xs font-normal text-white hover:opacity-70 transition-opacity" data-testid="nav-accessories">Accessories</a>
            <a href="#" className="text-xs font-normal text-white hover:opacity-70 transition-opacity" data-testid="nav-support">Support</a>
          </div>
          
          {/* Search and Bag icons - Apple style */}
          <div className="flex items-center space-x-4">
            {/* Search icon - Apple's exact style */}
            <button className="p-2 hover:opacity-70 transition-opacity" data-testid="search-button">
              <svg className="h-4 w-4 fill-none" viewBox="0 0 16 16">
                <path d="M15.25 14.19L11.81 10.75a6.5 6.5 0 1 0-1.06 1.06l3.44 3.44a.75.75 0 1 0 1.06-1.06zM1.5 6.5a5 5 0 1 1 10 0 5 5 0 0 1-10 0z" fill="currentColor"/>
              </svg>
            </button>
            
            {/* Bag icon - Apple's exact style */}
            <button className="p-2 hover:opacity-70 transition-opacity" data-testid="bag-button">
              <svg className="h-4 w-4 fill-none" viewBox="0 0 16 16">
                <path d="M14.5 4.5h-13a.5.5 0 0 0-.5.5v8.5a1.5 1.5 0 0 0 1.5 1.5h11a1.5 1.5 0 0 0 1.5-1.5V5a.5.5 0 0 0-.5-.5zM4 6.75v-1a2 2 0 0 1 4 0v1m4 0v-1a2 2 0 0 1 4 0v1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
            
            {/* Mobile hamburger menu */}
            <button 
              className="lg:hidden p-2 hover:opacity-70 transition-opacity" 
              data-testid="mobile-menu-button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              <svg className="h-4 w-4 fill-none" viewBox="0 0 16 16">
                <path d="M2 3.75h12M2 8h12M2 12.25h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>
        
        {/* Mobile slide-down navigation */}
        {isMobileMenuOpen && (
          <div className="lg:hidden bg-black border-t border-gray-800" data-testid="mobile-nav-menu">
            <div className="mx-auto max-w-[980px] px-4 py-2">
              <div className="flex flex-col space-y-1">
                <a href="#" className="text-xs font-normal text-white hover:opacity-70 transition-opacity py-2" data-testid="mobile-nav-store">Store</a>
                <a href="#" className="text-xs font-normal text-white hover:opacity-70 transition-opacity py-2" data-testid="mobile-nav-mac">Mac</a>
                <a href="#" className="text-xs font-normal text-white hover:opacity-70 transition-opacity py-2" data-testid="mobile-nav-ipad">iPad</a>
                <a href="#" className="text-xs font-normal text-white hover:opacity-70 transition-opacity py-2" data-testid="mobile-nav-iphone">iPhone</a>
                <a href="#" className="text-xs font-normal text-white hover:opacity-70 transition-opacity py-2" data-testid="mobile-nav-watch">Watch</a>
                <a href="#" className="text-xs font-normal text-white hover:opacity-70 transition-opacity py-2" data-testid="mobile-nav-vision">Vision</a>
                <a href="#" className="text-xs font-normal text-white hover:opacity-70 transition-opacity py-2" data-testid="mobile-nav-airpods">AirPods</a>
                <a href="#" className="text-xs font-normal text-white hover:opacity-70 transition-opacity py-2" data-testid="mobile-nav-tv-home">TV & Home</a>
                <a href="#" className="text-xs font-normal text-white hover:opacity-70 transition-opacity py-2" data-testid="mobile-nav-entertainment">Entertainment</a>
                <a href="#" className="text-xs font-normal text-white hover:opacity-70 transition-opacity py-2" data-testid="mobile-nav-accessories">Accessories</a>
                <a href="#" className="text-xs font-normal text-white hover:opacity-70 transition-opacity py-2" data-testid="mobile-nav-support">Support</a>
              </div>
            </div>
          </div>
        )}
      </nav>
      
      {/* Apple ML Research header */}
      <header className="w-full bg-white border-b border-gray-200" data-testid="ml-header">
        <div className="mx-auto max-w-[980px] px-4 sm:px-6">
          <div className="flex h-14 items-center">
            <h1 className="text-2xl font-semibold text-gray-900 tracking-tight leading-tight" data-testid="ml-title" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Helvetica, Arial, sans-serif', letterSpacing: '-0.02em' }}>
              Machine Learning Research
            </h1>
          </div>
          {/* Apple's specific gold accent */}
          <div className="h-px" style={{ background: 'linear-gradient(90deg, #ff9500 0%, #ffad33 50%, #ff9500 100%)' }} data-testid="gold-accent" />
        </div>
      </header>
    </>
  );
}
