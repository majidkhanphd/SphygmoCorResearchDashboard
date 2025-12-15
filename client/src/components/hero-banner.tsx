import { motion, useMotionValue, useTransform, useSpring } from 'framer-motion';

export default function HeroBanner() {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  
  // Create smooth spring values for mouse movement
  const smoothMouseX = useSpring(mouseX, { stiffness: 50, damping: 20 });
  const smoothMouseY = useSpring(mouseY, { stiffness: 50, damping: 20 });
  
  // Parallax transforms for different layers
  const layer1X = useTransform(smoothMouseX, [0, 1], [-15, 15]);
  const layer2X = useTransform(smoothMouseX, [0, 1], [-10, 10]);
  const layer3X = useTransform(smoothMouseX, [0, 1], [-5, 5]);
  const layer4X = useTransform(smoothMouseX, [0, 1], [-8, 8]);
  const layer5X = useTransform(smoothMouseX, [0, 1], [-12, 12]);
  
  // Subtle brightness adjustment based on mouse Y
  const glowOpacity1 = useTransform(smoothMouseY, [0, 1], [0.4, 0.6]);
  const glowOpacity2 = useTransform(smoothMouseY, [0, 1], [0.35, 0.55]);
  const glowOpacity3 = useTransform(smoothMouseY, [0, 1], [0.3, 0.5]);
  const glowOpacity4 = useTransform(smoothMouseY, [0, 1], [0.3, 0.45]);
  const glowOpacity5 = useTransform(smoothMouseY, [0, 1], [0.25, 0.4]);
  
  // Handle mouse movement
  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    mouseX.set(x);
    mouseY.set(y);
  };

  // Medically accurate arterial waveform paths based on clinical references
  
  // 1. Normal arterial waveform - smooth with subtle dicrotic notch
  const normalWaveform = "M 0,65 C 8,64 16,55 24,35 C 28,28 32,25 36,26 C 40,27 44,32 48,38 C 50,40 52,39 54,41 C 60,47 68,55 80,62 L 100,65";
  
  // 2. Pulsus alternans - alternating strong and weak beats
  const alternansStrong = "M 0,65 C 8,64 16,50 24,30 C 28,23 32,20 36,21 C 40,22 44,27 48,33 C 50,35 52,34 54,36 C 60,42 68,52 80,61 L 100,65";
  const alternansWeak = "M 0,65 C 8,64.5 16,58 24,45 C 28,40 32,38 36,39 C 40,40 44,43 48,47 C 50,48 52,47.5 54,49 C 60,53 68,58 80,63 L 100,65";
  
  // 3. Pulsus bisferiens - double systolic peak (aortic regurgitation pattern)
  const bisferiens = "M 0,65 C 8,64 14,50 18,35 C 20,32 22,31 24,32 C 26,33 28,35 30,33 C 32,31 34,30 36,31 C 38,32 42,36 48,42 C 54,48 68,57 80,62.5 L 100,65";
  
  // 4. Pulsus parvus et tardus - low amplitude, slow rising (aortic stenosis)
  const parvusTardus = "M 0,65 C 15,64.5 30,62 45,55 C 55,51 60,50 65,51 C 70,52 75,54 80,57 C 85,60 92,63 100,65";
  
  // 5. Pulsus paradoxus - respiratory variation in amplitude
  const paradoxusHigh = "M 0,65 C 8,64 16,50 24,30 C 28,23 32,20 36,21 C 40,22 44,27 48,33 C 54,39 68,52 80,61 L 100,65";
  const paradoxusMed = "M 0,65 C 8,64.2 16,55 24,40 C 28,35 32,33 36,34 C 40,35 44,38 48,42 C 54,46 68,56 80,62 L 100,65";
  const paradoxusLow = "M 0,65 C 8,64.5 16,60 24,50 C 28,46 32,45 36,46 C 40,47 44,49 48,51 C 54,53 68,59 80,63 L 100,65";
  
  // 6. Pulse wave velocity - smooth sinusoidal pattern
  const pulseWave = "M 0,50 Q 25,30 50,50 Q 75,70 100,50";
  

  return (
    <motion.section 
      className="w-full relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #2a2438 0%, #342f48 25%, #3d3552 50%, #453d5d 100%)',
        minHeight: 'clamp(200px, 40vh, 295px)'
      }}
      data-testid="hero-banner"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => {
        mouseX.set(0.5);
        mouseY.set(0.5);
      }}
    >
      {/* Subtle animated grid overlay */}
      <motion.div 
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
          x: layer3X,
          opacity: 0.4
        }}
        animate={{
          backgroundPosition: ['0px 0px', '60px 60px']
        }}
        transition={{
          duration: 40,
          ease: "linear",
          repeat: Infinity
        }}
        aria-hidden="true"
      />

      {/* SVG Container for all 6 distinct waveforms */}
      <div className="absolute inset-0" aria-hidden="true">
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 3200 400"
          preserveAspectRatio="xMidYMid slice"
        >
          <defs>
            {/* Very subtle glow filter */}
            <filter id="subtleGlow">
              <feGaussianBlur stdDeviation="1" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>

          {/* Layer 1: Normal Arterial Waveform */}
          <motion.g
            style={{ x: layer1X }}
            filter="url(#subtleGlow)"
          >
            {/* Create multiple instances for continuous flow */}
            {[0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900, 2000, 2100, 2200, 2300, 2400, 2500, 2600, 2700, 2800, 2900, 3000, 3100].map((offset) => (
              <motion.g 
                key={`normal-${offset}`}
                animate={{ x: [-100, 0] }}
                transition={{
                  duration: 18,
                  ease: "linear",
                  repeat: Infinity
                }}
              >
                <path
                  d={normalWaveform}
                  transform={`translate(${offset}, 100)`}
                  fill="none"
                  stroke="#9A6FFF"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ opacity: glowOpacity1.get() }}
                />
              </motion.g>
            ))}
          </motion.g>

          {/* Layer 2: Pulsus Alternans */}
          <motion.g
            style={{ x: layer2X }}
            filter="url(#subtleGlow)"
          >
            {[0, 200, 400, 600, 800, 1000, 1200, 1400, 1600, 1800, 2000, 2200, 2400, 2600, 2800, 3000].map((offset, i) => (
              <motion.g 
                key={`alternans-${offset}`}
                animate={{ x: [-200, 0] }}
                transition={{
                  duration: 22,
                  ease: "linear",
                  repeat: Infinity
                }}
              >
                {/* Strong beat */}
                <path
                  d={alternansStrong}
                  transform={`translate(${offset}, 130)`}
                  fill="none"
                  stroke="#AF87FF"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ opacity: glowOpacity2.get() }}
                />
                {/* Weak beat */}
                <path
                  d={alternansWeak}
                  transform={`translate(${offset + 100}, 130)`}
                  fill="none"
                  stroke="#AF87FF"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ opacity: glowOpacity2.get() }}
                />
              </motion.g>
            ))}
          </motion.g>

          {/* Layer 3: Pulsus Bisferiens */}
          <motion.g
            style={{ x: layer3X }}
            filter="url(#subtleGlow)"
          >
            {[0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900, 2000, 2100, 2200, 2300, 2400, 2500, 2600, 2700, 2800, 2900, 3000, 3100].map((offset) => (
              <motion.g 
                key={`bisferiens-${offset}`}
                animate={{ x: [-100, 0] }}
                transition={{
                  duration: 26,
                  ease: "linear",
                  repeat: Infinity
                }}
              >
                <path
                  d={bisferiens}
                  transform={`translate(${offset}, 160)`}
                  fill="none"
                  stroke="#C4B0FF"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ opacity: glowOpacity3.get() }}
                />
              </motion.g>
            ))}
          </motion.g>

          {/* Layer 4: Pulsus Parvus et Tardus */}
          <motion.g
            style={{ x: layer4X }}
            filter="url(#subtleGlow)"
          >
            {[0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900, 2000, 2100, 2200, 2300, 2400, 2500, 2600, 2700, 2800, 2900, 3000, 3100].map((offset) => (
              <motion.g 
                key={`parvus-${offset}`}
                animate={{ x: [-100, 0] }}
                transition={{
                  duration: 30,
                  ease: "linear",
                  repeat: Infinity
                }}
              >
                <path
                  d={parvusTardus}
                  transform={`translate(${offset}, 190)`}
                  fill="none"
                  stroke="#D4C4FF"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ opacity: glowOpacity4.get() }}
                />
              </motion.g>
            ))}
          </motion.g>

          {/* Layer 5: Pulsus Paradoxus */}
          <motion.g
            style={{ x: layer5X }}
            filter="url(#subtleGlow)"
          >
            {[0, 400, 800, 1200, 1600, 2000, 2400, 2800].map((offset, i) => (
              <motion.g 
                key={`paradoxus-${offset}`}
                animate={{ x: [-400, 0] }}
                transition={{
                  duration: 24,
                  ease: "linear",
                  repeat: Infinity
                }}
              >
                <path
                  d={paradoxusHigh}
                  transform={`translate(${offset}, 220)`}
                  fill="none"
                  stroke="#C4B0FF"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ opacity: glowOpacity5.get() }}
                />
                <path
                  d={paradoxusMed}
                  transform={`translate(${offset + 100}, 220)`}
                  fill="none"
                  stroke="#C4B0FF"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ opacity: glowOpacity5.get() }}
                />
                <path
                  d={paradoxusLow}
                  transform={`translate(${offset + 200}, 220)`}
                  fill="none"
                  stroke="#C4B0FF"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ opacity: glowOpacity5.get() }}
                />
                <path
                  d={paradoxusMed}
                  transform={`translate(${offset + 300}, 220)`}
                  fill="none"
                  stroke="#C4B0FF"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ opacity: glowOpacity5.get() }}
                />
              </motion.g>
            ))}
          </motion.g>
        </svg>
      </div>

      {/* Very subtle gradient orbs for depth */}
      <motion.div 
        className="absolute inset-0 opacity-15" 
        aria-hidden="true"
        style={{ x: layer1X }}
      >
        <motion.div 
          className="absolute rounded-full blur-3xl"
          style={{
            width: '500px',
            height: '500px',
            background: 'radial-gradient(circle, rgba(175, 135, 255, 0.1) 0%, transparent 70%)',
            top: '-15%',
            left: '5%'
          }}
          animate={{
            scale: [1, 1.05, 1],
            opacity: [0.1, 0.15, 0.1]
          }}
          transition={{
            duration: 10,
            ease: "easeInOut",
            repeat: Infinity
          }}
        />
        <motion.div 
          className="absolute rounded-full blur-3xl"
          style={{
            width: '400px',
            height: '400px',
            background: 'radial-gradient(circle, rgba(175, 135, 255, 0.08) 0%, transparent 70%)',
            bottom: '-5%',
            right: '10%'
          }}
          animate={{
            scale: [1, 1.08, 1],
            opacity: [0.08, 0.12, 0.08]
          }}
          transition={{
            duration: 12,
            ease: "easeInOut",
            repeat: Infinity,
            delay: 3
          }}
        />
      </motion.div>
      
      {/* Content container with improved readability */}
      <div className="relative w-full px-4 sm:px-6 lg:px-8 py-14 sm:py-20 lg:py-22 z-10">
        <motion.div 
          className="text-center w-full"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          {/* Semi-transparent backdrop for text readability */}
          <div 
            className="inline-block rounded-[5px] px-4 sm:px-8 py-3 sm:py-6"
            style={{
              background: 'rgba(25, 35, 48, 0.5)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)'
            }}
          >
            {/* Main heading */}
            <h1 
              className="font-light tracking-tight"
              style={{ 
                fontSize: 'clamp(36px, 5vw, 64px)', 
                letterSpacing: '-0.03em',
                lineHeight: '1.2',
                color: '#ffffff',
                textShadow: '0 2px 12px rgba(0, 0, 0, 0.4)',
                fontFamily: 'Montserrat, -apple-system, BlinkMacSystemFont, sans-serif'
              }}
              data-testid="hero-title"
            >
              <span style={{ color: '#AF87FF' }}>Research</span>
              <br />
              Fueled by <span style={{ color: '#AF87FF' }}>SphygmoCor</span><span style={{ fontSize: '0.5em', verticalAlign: 'super', color: '#AF87FF' }}>©</span>
              <br />
            </h1>
          </div>
        </motion.div>
      </div>
    </motion.section>
  );
}