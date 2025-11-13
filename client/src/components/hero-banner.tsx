export default function HeroBanner() {
  return (
    <section 
      className="w-full relative overflow-hidden bg-gradient-to-br from-gray-50 via-white to-gray-100"
      data-testid="hero-banner"
    >
      {/* Placeholder animation area - radial gradient with pulse */}
      <div 
        className="absolute inset-0 hero-pulse-animation"
        style={{
          background: 'radial-gradient(ellipse at 50% 50%, rgba(0, 122, 255, 0.1) 0%, transparent 70%)'
        }}
        aria-hidden="true"
      />
      
      {/* Content container */}
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 lg:py-32">
        <div className="text-center">
          {/* Main heading - using clamp for responsive sizing */}
          <h1 
            className="text-foreground mb-6 font-light tracking-tight"
            style={{ 
              fontSize: 'clamp(36px, 5vw, 64px)', 
              letterSpacing: '-0.03em',
              lineHeight: '1.05' 
            }}
            data-testid="hero-title"
          >
            Cardiovascular Research & Publications
          </h1>
          
          {/* Subheading */}
          <p
            className="text-muted-foreground mx-auto max-w-4xl"
            style={{ 
              fontSize: 'clamp(16px, 2.5vw, 21px)',
              lineHeight: '1.5'
            }}
            data-testid="hero-subtitle"
          >
            Advancing non-invasive cardiovascular assessment through innovative SphygmoCor technology. 
            Explore our comprehensive collection of peer-reviewed research spanning arterial stiffness, 
            central blood pressure, and hemodynamic parameters.
          </p>
        </div>
      </div>
    </section>
  );
}
