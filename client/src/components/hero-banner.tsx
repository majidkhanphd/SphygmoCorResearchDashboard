export default function HeroBanner() {
  return (
    <section 
      className="w-full relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)'
      }}
      data-testid="hero-banner"
    >
      {/* Animated gradient orbs */}
      <div className="absolute inset-0" aria-hidden="true">
        {/* Orb 1 - Blue */}
        <div 
          className="absolute rounded-full blur-3xl animate-float-slow"
          style={{
            width: '600px',
            height: '600px',
            background: 'radial-gradient(circle, rgba(0, 122, 255, 0.15) 0%, transparent 70%)',
            top: '-20%',
            left: '-10%',
            animation: 'float-slow 20s ease-in-out infinite',
            willChange: 'transform'
          }}
        />
        
        {/* Orb 2 - Purple */}
        <div 
          className="absolute rounded-full blur-3xl"
          style={{
            width: '500px',
            height: '500px',
            background: 'radial-gradient(circle, rgba(138, 43, 226, 0.12) 0%, transparent 70%)',
            top: '20%',
            right: '-5%',
            animation: 'float-medium 15s ease-in-out infinite',
            animationDelay: '2s',
            willChange: 'transform'
          }}
        />
        
        {/* Orb 3 - Light Blue */}
        <div 
          className="absolute rounded-full blur-3xl"
          style={{
            width: '450px',
            height: '450px',
            background: 'radial-gradient(circle, rgba(59, 130, 246, 0.1) 0%, transparent 70%)',
            bottom: '-10%',
            left: '30%',
            animation: 'float-fast 12s ease-in-out infinite',
            animationDelay: '4s',
            willChange: 'transform'
          }}
        />
        
        {/* Orb 4 - Soft Red */}
        <div 
          className="absolute rounded-full blur-3xl"
          style={{
            width: '400px',
            height: '400px',
            background: 'radial-gradient(circle, rgba(239, 68, 68, 0.08) 0%, transparent 70%)',
            top: '50%',
            right: '20%',
            animation: 'float-medium 18s ease-in-out infinite',
            animationDelay: '6s',
            willChange: 'transform'
          }}
        />
      </div>

      {/* SVG Pulse Wave Animation */}
      <div className="absolute inset-0 opacity-20" aria-hidden="true">
        <svg
          className="w-full h-full"
          viewBox="0 0 1200 400"
          preserveAspectRatio="none"
          style={{
            animation: 'pulse-wave 8s ease-in-out infinite',
            willChange: 'transform'
          }}
        >
          {/* Arterial waveform pattern */}
          <path
            d="M0,200 L100,200 L120,150 L140,180 L160,120 L180,200 L300,200 L320,150 L340,180 L360,120 L380,200 L500,200 L520,150 L540,180 L560,120 L580,200 L700,200 L720,150 L740,180 L760,120 L780,200 L900,200 L920,150 L940,180 L960,120 L980,200 L1200,200"
            fill="none"
            stroke="rgba(0, 122, 255, 0.3)"
            strokeWidth="2"
            style={{
              animation: 'wave-flow 15s linear infinite',
              willChange: 'transform'
            }}
          />
          
          {/* Secondary wave for depth */}
          <path
            d="M0,220 L100,220 L120,170 L140,200 L160,140 L180,220 L300,220 L320,170 L340,200 L360,140 L380,220 L500,220 L520,170 L540,200 L560,140 L580,220 L700,220 L720,170 L740,200 L760,140 L780,220 L900,220 L920,170 L940,200 L960,140 L980,220 L1200,220"
            fill="none"
            stroke="rgba(138, 43, 226, 0.2)"
            strokeWidth="1.5"
            style={{
              animation: 'wave-flow 20s linear infinite reverse',
              willChange: 'transform'
            }}
          />
        </svg>
      </div>
      
      {/* Content container */}
      <div className="relative w-full px-4 sm:px-6 lg:px-8 py-20 sm:py-28 lg:py-32">
        <div className="text-center w-full">
          {/* Main heading - using clamp for responsive sizing */}
          <h1 
            className="text-foreground font-light tracking-tight"
            style={{ 
              fontSize: 'clamp(36px, 5vw, 64px)', 
              letterSpacing: '-0.03em',
              lineHeight: '1.2',
              textShadow: '0 2px 10px rgba(255, 255, 255, 0.8)'
            }}
            data-testid="hero-title"
          >
            Research
            <br />
            Fueled by SphygmoCor<span style={{ fontSize: '0.5em', verticalAlign: 'super' }}>©</span>
            <br />
          </h1>
        </div>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes float-slow {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          33% {
            transform: translate(30px, -30px) scale(1.05);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.95);
          }
        }

        @keyframes float-medium {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          50% {
            transform: translate(-40px, 40px) scale(1.08);
          }
        }

        @keyframes float-fast {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          25% {
            transform: translate(25px, 25px) scale(1.03);
          }
          50% {
            transform: translate(-30px, -20px) scale(0.97);
          }
          75% {
            transform: translate(20px, -30px) scale(1.02);
          }
        }

        @keyframes pulse-wave {
          0%, 100% {
            opacity: 0.15;
          }
          50% {
            opacity: 0.25;
          }
        }

        @keyframes wave-flow {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-100px);
          }
        }
      `}</style>
    </section>
  );
}
