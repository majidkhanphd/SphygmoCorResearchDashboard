export default function HeroBanner() {
  return (
    <section 
      className="w-full relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        minHeight: '400px'
      }}
      data-testid="hero-banner"
    >
      {/* Animated grid overlay - like a cardiac monitor */}
      <div 
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0, 255, 255, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 255, 255, 0.1) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
          animation: 'grid-scroll 20s linear infinite'
        }}
        aria-hidden="true"
      />

      {/* Multiple EKG Waveform Layers */}
      <div className="absolute inset-0" aria-hidden="true">
        {/* Primary EKG Wave - Bright Green/Cyan with Glow */}
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 2400 400"
          preserveAspectRatio="none"
          style={{
            filter: 'drop-shadow(0 0 8px rgba(0, 255, 200, 0.8))'
          }}
        >
          <path
            d="M0,200 L180,200 L200,120 L215,200 L230,80 L245,200 L260,220 L280,200 L460,200 L480,120 L495,200 L510,80 L525,200 L540,220 L560,200 L740,200 L760,120 L775,200 L790,80 L805,200 L820,220 L840,200 L1020,200 L1040,120 L1055,200 L1070,80 L1085,200 L1100,220 L1120,200 L1300,200 L1320,120 L1335,200 L1350,80 L1365,200 L1380,220 L1400,200 L1580,200 L1600,120 L1615,200 L1630,80 L1645,200 L1660,220 L1680,200 L1860,200 L1880,120 L1895,200 L1910,80 L1925,200 L1940,220 L1960,200 L2140,200 L2160,120 L2175,200 L2190,80 L2205,200 L2220,220 L2240,200 L2400,200"
            fill="none"
            stroke="#00ffc8"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              animation: 'ekg-flow 8s linear infinite'
            }}
          />
        </svg>

        {/* Secondary Wave - Blue with Glow */}
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 2400 400"
          preserveAspectRatio="none"
          style={{
            filter: 'drop-shadow(0 0 6px rgba(0, 122, 255, 0.6))',
            opacity: 0.7
          }}
        >
          <path
            d="M0,240 L180,240 L200,180 L215,240 L230,150 L245,240 L260,260 L280,240 L460,240 L480,180 L495,240 L510,150 L525,240 L540,260 L560,240 L740,240 L760,180 L775,240 L790,150 L805,240 L820,260 L840,240 L1020,240 L1040,180 L1055,240 L1070,150 L1085,240 L1100,260 L1120,240 L1300,240 L1320,180 L1335,240 L1350,150 L1365,240 L1380,260 L1400,240 L1580,240 L1600,180 L1615,240 L1630,150 L1645,240 L1660,260 L1680,240 L1860,240 L1880,180 L1895,240 L1910,150 L1925,240 L1940,260 L1960,240 L2140,240 L2160,180 L2175,240 L2190,150 L2205,240 L2220,260 L2240,240 L2400,240"
            fill="none"
            stroke="#007aff"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              animation: 'ekg-flow 10s linear infinite'
            }}
          />
        </svg>

        {/* Tertiary Wave - Purple with Glow */}
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 2400 400"
          preserveAspectRatio="none"
          style={{
            filter: 'drop-shadow(0 0 5px rgba(138, 43, 226, 0.5))',
            opacity: 0.5
          }}
        >
          <path
            d="M0,160 L180,160 L200,100 L215,160 L230,60 L245,160 L260,180 L280,160 L460,160 L480,100 L495,160 L510,60 L525,160 L540,180 L560,160 L740,160 L760,100 L775,160 L790,60 L805,160 L820,180 L840,160 L1020,160 L1040,100 L1055,160 L1070,60 L1085,160 L1100,180 L1120,160 L1300,160 L1320,100 L1335,160 L1350,60 L1365,160 L1380,180 L1400,160 L1580,160 L1600,100 L1615,160 L1630,60 L1645,160 L1660,180 L1680,160 L1860,160 L1880,100 L1895,160 L1910,60 L1925,160 L1940,180 L1960,160 L2140,160 L2160,100 L2175,160 L2190,60 L2205,160 L2220,180 L2240,160 L2400,160"
            fill="none"
            stroke="#8a2be2"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              animation: 'ekg-flow 12s linear infinite reverse'
            }}
          />
        </svg>

        {/* Animated Pulse Dots Following the Waves */}
        <div
          className="absolute rounded-full"
          style={{
            width: '12px',
            height: '12px',
            background: 'radial-gradient(circle, #00ffc8 0%, transparent 70%)',
            boxShadow: '0 0 20px #00ffc8',
            animation: 'pulse-dot 8s linear infinite',
            top: '50%',
            left: '0',
            transform: 'translate(-50%, -50%)'
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            width: '10px',
            height: '10px',
            background: 'radial-gradient(circle, #007aff 0%, transparent 70%)',
            boxShadow: '0 0 15px #007aff',
            animation: 'pulse-dot 10s linear infinite',
            top: '60%',
            left: '0',
            transform: 'translate(-50%, -50%)',
            opacity: 0.7
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            width: '8px',
            height: '8px',
            background: 'radial-gradient(circle, #8a2be2 0%, transparent 70%)',
            boxShadow: '0 0 12px #8a2be2',
            animation: 'pulse-dot 12s linear infinite',
            top: '40%',
            left: '0',
            transform: 'translate(-50%, -50%)',
            opacity: 0.5
          }}
        />
      </div>

      {/* Floating Gradient Orbs - Softer for background depth */}
      <div className="absolute inset-0 opacity-30" aria-hidden="true">
        <div 
          className="absolute rounded-full blur-3xl"
          style={{
            width: '500px',
            height: '500px',
            background: 'radial-gradient(circle, rgba(0, 255, 200, 0.15) 0%, transparent 70%)',
            top: '-20%',
            left: '-10%',
            animation: 'float-slow 20s ease-in-out infinite'
          }}
        />
        <div 
          className="absolute rounded-full blur-3xl"
          style={{
            width: '400px',
            height: '400px',
            background: 'radial-gradient(circle, rgba(0, 122, 255, 0.12) 0%, transparent 70%)',
            bottom: '-10%',
            right: '-5%',
            animation: 'float-medium 15s ease-in-out infinite',
            animationDelay: '3s'
          }}
        />
      </div>
      
      {/* Content container */}
      <div className="relative w-full px-4 sm:px-6 lg:px-8 py-20 sm:py-28 lg:py-32 z-10">
        <div className="text-center w-full">
          {/* Main heading */}
          <h1 
            className="font-light tracking-tight"
            style={{ 
              fontSize: 'clamp(36px, 5vw, 64px)', 
              letterSpacing: '-0.03em',
              lineHeight: '1.2',
              color: '#ffffff',
              textShadow: '0 2px 20px rgba(0, 0, 0, 0.5), 0 0 40px rgba(0, 255, 200, 0.3)'
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
        @keyframes ekg-flow {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-280px);
          }
        }

        @keyframes pulse-dot {
          0% {
            left: -5%;
            opacity: 0;
          }
          5% {
            opacity: 1;
          }
          95% {
            opacity: 1;
          }
          100% {
            left: 105%;
            opacity: 0;
          }
        }

        @keyframes grid-scroll {
          0% {
            transform: translateX(0) translateY(0);
          }
          100% {
            transform: translateX(40px) translateY(40px);
          }
        }

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
      `}</style>
    </section>
  );
}
