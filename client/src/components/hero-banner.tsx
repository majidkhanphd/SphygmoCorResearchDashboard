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

      {/* Arterial Pressure Waveform Layers */}
      <div className="absolute inset-0" aria-hidden="true">
        {/* Primary Arterial Waveform - Normal Pattern with Dicrotic Notch */}
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 3200 400"
          preserveAspectRatio="none"
          style={{
            filter: 'drop-shadow(0 0 10px rgba(0, 255, 200, 0.9))'
          }}
        >
          {/* Repeating arterial pulse pattern with dicrotic notch */}
          <path
            d="M0,280 L80,280 L90,250 L100,180 L110,120 L120,100 L130,95 L140,100 L145,110 L150,125 L155,130 L160,128 L165,120 L175,140 L200,200 L240,260 L280,280 
               L360,280 L370,250 L380,180 L390,120 L400,100 L410,95 L420,100 L425,110 L430,125 L435,130 L440,128 L445,120 L455,140 L480,200 L520,260 L560,280
               L640,280 L650,250 L660,180 L670,120 L680,100 L690,95 L700,100 L705,110 L710,125 L715,130 L720,128 L725,120 L735,140 L760,200 L800,260 L840,280
               L920,280 L930,250 L940,180 L950,120 L960,100 L970,95 L980,100 L985,110 L990,125 L995,130 L1000,128 L1005,120 L1015,140 L1040,200 L1080,260 L1120,280
               L1200,280 L1210,250 L1220,180 L1230,120 L1240,100 L1250,95 L1260,100 L1265,110 L1270,125 L1275,130 L1280,128 L1285,120 L1295,140 L1320,200 L1360,260 L1400,280
               L1480,280 L1490,250 L1500,180 L1510,120 L1520,100 L1530,95 L1540,100 L1545,110 L1550,125 L1555,130 L1560,128 L1565,120 L1575,140 L1600,200 L1640,260 L1680,280
               L1760,280 L1770,250 L1780,180 L1790,120 L1800,100 L1810,95 L1820,100 L1825,110 L1830,125 L1835,130 L1840,128 L1845,120 L1855,140 L1880,200 L1920,260 L1960,280
               L2040,280 L2050,250 L2060,180 L2070,120 L2080,100 L2090,95 L2100,100 L2105,110 L2110,125 L2115,130 L2120,128 L2125,120 L2135,140 L2160,200 L2200,260 L2240,280
               L2320,280 L2330,250 L2340,180 L2350,120 L2360,100 L2370,95 L2380,100 L2385,110 L2390,125 L2395,130 L2400,128 L2405,120 L2415,140 L2440,200 L2480,260 L2520,280
               L2600,280 L2610,250 L2620,180 L2630,120 L2640,100 L2650,95 L2660,100 L2665,110 L2670,125 L2675,130 L2680,128 L2685,120 L2695,140 L2720,200 L2760,260 L2800,280
               L2880,280 L2890,250 L2900,180 L2910,120 L2920,100 L2930,95 L2940,100 L2945,110 L2950,125 L2955,130 L2960,128 L2965,120 L2975,140 L3000,200 L3040,260 L3080,280 L3200,280"
            fill="none"
            stroke="#00ffc8"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              animation: 'arterial-flow 12s linear infinite'
            }}
          />
        </svg>

        {/* Secondary Arterial Waveform - Higher Amplitude Variant */}
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 3200 400"
          preserveAspectRatio="none"
          style={{
            filter: 'drop-shadow(0 0 8px rgba(0, 122, 255, 0.7))',
            opacity: 0.75
          }}
        >
          <path
            d="M0,250 L80,250 L90,220 L100,150 L110,90 L120,70 L130,65 L140,70 L145,80 L150,95 L155,100 L160,98 L165,90 L175,110 L200,170 L240,230 L280,250
               L360,250 L370,220 L380,150 L390,90 L400,70 L410,65 L420,70 L425,80 L430,95 L435,100 L440,98 L445,90 L455,110 L480,170 L520,230 L560,250
               L640,250 L650,220 L660,150 L670,90 L680,70 L690,65 L700,70 L705,80 L710,95 L715,100 L720,98 L725,90 L735,110 L760,170 L800,230 L840,250
               L920,250 L930,220 L940,150 L950,90 L960,70 L970,65 L980,70 L985,80 L990,95 L995,100 L1000,98 L1005,90 L1015,110 L1040,170 L1080,230 L1120,250
               L1200,250 L1210,220 L1220,150 L1230,90 L1240,70 L1250,65 L1260,70 L1265,80 L1270,95 L1275,100 L1280,98 L1285,90 L1295,110 L1320,170 L1360,230 L1400,250
               L1480,250 L1490,220 L1500,150 L1510,90 L1520,70 L1530,65 L1540,70 L1545,80 L1550,95 L1555,100 L1560,98 L1565,90 L1575,110 L1600,170 L1640,230 L1680,250
               L1760,250 L1770,220 L1780,150 L1790,90 L1800,70 L1810,65 L1820,70 L1825,80 L1830,95 L1835,100 L1840,98 L1845,90 L1855,110 L1880,170 L1920,230 L1960,250
               L2040,250 L2050,220 L2060,150 L2070,90 L2080,70 L2090,65 L2100,70 L2105,80 L2110,95 L2115,100 L2120,98 L2125,90 L2135,110 L2160,170 L2200,230 L2240,250
               L2320,250 L2330,220 L2340,150 L2350,90 L2360,70 L2370,65 L2380,70 L2385,80 L2390,95 L2395,100 L2400,98 L2405,90 L2415,110 L2440,170 L2480,230 L2520,250
               L2600,250 L2610,220 L2620,150 L2630,90 L2640,70 L2650,65 L2660,70 L2665,80 L2670,95 L2675,100 L2680,98 L2685,90 L2695,110 L2720,170 L2760,230 L2800,250
               L2880,250 L2890,220 L2900,150 L2910,90 L2920,70 L2930,65 L2940,70 L2945,80 L2950,95 L2955,100 L2960,98 L2965,90 L2975,110 L3000,170 L3040,230 L3080,250 L3200,250"
            fill="none"
            stroke="#007aff"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              animation: 'arterial-flow 15s linear infinite'
            }}
          />
        </svg>

        {/* Tertiary Arterial Waveform - Subtle Background Layer */}
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 3200 400"
          preserveAspectRatio="none"
          style={{
            filter: 'drop-shadow(0 0 6px rgba(138, 43, 226, 0.6))',
            opacity: 0.5
          }}
        >
          <path
            d="M0,220 L80,220 L90,195 L100,140 L110,90 L120,75 L130,72 L140,75 L145,82 L150,92 L155,96 L160,94 L165,88 L175,102 L200,150 L240,200 L280,220
               L360,220 L370,195 L380,140 L390,90 L400,75 L410,72 L420,75 L425,82 L430,92 L435,96 L440,94 L445,88 L455,102 L480,150 L520,200 L560,220
               L640,220 L650,195 L660,140 L670,90 L680,75 L690,72 L700,75 L705,82 L710,92 L715,96 L720,94 L725,88 L735,102 L760,150 L800,200 L840,220
               L920,220 L930,195 L940,140 L950,90 L960,75 L970,72 L980,75 L985,82 L990,92 L995,96 L1000,94 L1005,88 L1015,102 L1040,150 L1080,200 L1120,220
               L1200,220 L1210,195 L1220,140 L1230,90 L1240,75 L1250,72 L1260,75 L1265,82 L1270,92 L1275,96 L1280,94 L1285,88 L1295,102 L1320,150 L1360,200 L1400,220
               L1480,220 L1490,195 L1500,140 L1510,90 L1520,75 L1530,72 L1540,75 L1545,82 L1550,92 L1555,96 L1560,94 L1565,88 L1575,102 L1600,150 L1640,200 L1680,220
               L1760,220 L1770,195 L1780,140 L1790,90 L1800,75 L1810,72 L1820,75 L1825,82 L1830,92 L1835,96 L1840,94 L1845,88 L1855,102 L1880,150 L1920,200 L1960,220
               L2040,220 L2050,195 L2060,140 L2070,90 L2080,75 L2090,72 L2100,75 L2105,82 L2110,92 L2115,96 L2120,94 L2125,88 L2135,102 L2160,150 L2200,200 L2240,220
               L2320,220 L2330,195 L2340,140 L2350,90 L2360,75 L2370,72 L2380,75 L2385,82 L2390,92 L2395,96 L2400,94 L2405,88 L2415,102 L2440,150 L2480,200 L2520,220
               L2600,220 L2610,195 L2620,140 L2630,90 L2640,75 L2650,72 L2660,75 L2665,82 L2670,92 L2675,96 L2680,94 L2685,88 L2695,102 L2720,150 L2760,200 L2800,220
               L2880,220 L2890,195 L2900,140 L2910,90 L2920,75 L2930,72 L2940,75 L2945,82 L2950,92 L2955,96 L2960,94 L2965,88 L2975,102 L3000,150 L3040,200 L3080,220 L3200,220"
            fill="none"
            stroke="#8a2be2"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              animation: 'arterial-flow 18s linear infinite reverse'
            }}
          />
        </svg>

        {/* Animated Pulse Dots Following the Waveforms */}
        <div
          className="absolute rounded-full"
          style={{
            width: '14px',
            height: '14px',
            background: 'radial-gradient(circle, #00ffc8 0%, transparent 70%)',
            boxShadow: '0 0 25px #00ffc8',
            animation: 'pulse-dot 12s linear infinite',
            top: '50%',
            left: '0',
            transform: 'translate(-50%, -50%)'
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            width: '12px',
            height: '12px',
            background: 'radial-gradient(circle, #007aff 0%, transparent 70%)',
            boxShadow: '0 0 20px #007aff',
            animation: 'pulse-dot 15s linear infinite',
            top: '52.5%',
            left: '0',
            transform: 'translate(-50%, -50%)',
            opacity: 0.75
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            width: '10px',
            height: '10px',
            background: 'radial-gradient(circle, #8a2be2 0%, transparent 70%)',
            boxShadow: '0 0 15px #8a2be2',
            animation: 'pulse-dot 18s linear infinite',
            top: '45%',
            left: '0',
            transform: 'translate(-50%, -50%)',
            opacity: 0.5
          }}
        />
      </div>

      {/* Floating Gradient Orbs - Softer for background depth */}
      <div className="absolute inset-0 opacity-25" aria-hidden="true">
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
        @keyframes arterial-flow {
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
