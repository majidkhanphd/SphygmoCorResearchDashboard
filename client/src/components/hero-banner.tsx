import { motion, useMotionValue, useTransform, useSpring } from 'framer-motion';

export default function HeroBanner() {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  
  // Create smooth spring values for mouse movement
  const smoothMouseX = useSpring(mouseX, { stiffness: 50, damping: 20 });
  const smoothMouseY = useSpring(mouseY, { stiffness: 50, damping: 20 });
  
  // Parallax transforms for different layers
  const layer1X = useTransform(smoothMouseX, [0, 1], [-20, 20]);
  const layer2X = useTransform(smoothMouseX, [0, 1], [-10, 10]);
  const layer3X = useTransform(smoothMouseX, [0, 1], [-5, 5]);
  
  // Subtle brightness adjustment based on mouse Y
  const glowOpacity1 = useTransform(smoothMouseY, [0, 1], [0.5, 0.7]);
  const glowOpacity2 = useTransform(smoothMouseY, [0, 1], [0.3, 0.5]);
  const glowOpacity3 = useTransform(smoothMouseY, [0, 1], [0.25, 0.4]);
  
  // Handle mouse movement
  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    mouseX.set(x);
    mouseY.set(y);
  };

  return (
    <motion.section 
      className="w-full relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #2c3e50 0%, #34495e 25%, #465769 50%, #556b7d 100%)',
        minHeight: '420px'
      }}
      data-testid="hero-banner"
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
            linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
          x: layer3X,
          opacity: 0.5
        }}
        animate={{
          backgroundPosition: ['0px 0px', '50px 50px']
        }}
        transition={{
          duration: 30,
          ease: "linear",
          repeat: Infinity
        }}
        aria-hidden="true"
      />

      {/* SVG Container for Waveforms */}
      <div className="absolute inset-0" aria-hidden="true">
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 2000 400"
          preserveAspectRatio="xMidYMid slice"
          style={{ filter: 'blur(0.5px)' }}
        >
          <defs>
            {/* Soft glow filter */}
            <filter id="softGlow">
              <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>

          {/* Layer 1: Normal Arterial Waveform with dicrotic notch */}
          <motion.g
            style={{ x: layer1X }}
            filter="url(#softGlow)"
          >
            {/* Repeating normal waveform pattern */}
            {[0, 280, 560, 840, 1120, 1400, 1680, 1960, 2240].map((offset, i) => (
              <motion.path
                key={`normal-${i}`}
                d={`M${offset},280 Q${offset+10},275 ${offset+20},240 Q${offset+30},180 ${offset+40},120 Q${offset+50},80 ${offset+60},70 Q${offset+70},68 ${offset+80},70 Q${offset+85},72 ${offset+90},78 L${offset+92},76 Q${offset+94},74 ${offset+96},77 Q${offset+100},82 ${offset+110},100 Q${offset+130},140 ${offset+160},200 Q${offset+200},250 ${offset+240},270 L${offset+280},280`}
                fill="none"
                stroke="#88c2c4"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ opacity: glowOpacity1 }}
                animate={{ x: [-280, 0] }}
                transition={{
                  duration: 20,
                  ease: "linear",
                  repeat: Infinity
                }}
              />
            ))}
          </motion.g>

          {/* Layer 2: Pulsus Alternans - alternating strong/weak beats */}
          <motion.g
            style={{ x: layer2X }}
            filter="url(#softGlow)"
          >
            {[0, 560, 1120, 1680, 2240].map((offset, i) => (
              <motion.g key={`alternans-${i}`}>
                {/* Strong beat */}
                <motion.path
                  d={`M${offset},260 Q${offset+10},255 ${offset+20},220 Q${offset+30},160 ${offset+40},100 Q${offset+50},60 ${offset+60},50 Q${offset+70},48 ${offset+80},50 Q${offset+85},52 ${offset+90},58 L${offset+92},56 Q${offset+94},54 ${offset+96},57 Q${offset+100},62 ${offset+110},80 Q${offset+130},120 ${offset+160},180 Q${offset+200},230 ${offset+240},250 L${offset+280},260`}
                  fill="none"
                  stroke="#4f6b93"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ opacity: glowOpacity2 }}
                  animate={{ x: [-560, 0] }}
                  transition={{
                    duration: 25,
                    ease: "linear",
                    repeat: Infinity
                  }}
                />
                {/* Weak beat */}
                <motion.path
                  d={`M${offset+280},260 Q${offset+290},258 ${offset+300},240 Q${offset+310},200 ${offset+320},160 Q${offset+330},130 ${offset+340},120 Q${offset+350},118 ${offset+360},120 Q${offset+365},122 ${offset+370},126 L${offset+372},125 Q${offset+374},124 ${offset+376},126 Q${offset+380},130 ${offset+390},145 Q${offset+410},180 ${offset+440},220 Q${offset+480},250 ${offset+520},258 L${offset+560},260`}
                  fill="none"
                  stroke="#4f6b93"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ opacity: glowOpacity2 }}
                  animate={{ x: [-560, 0] }}
                  transition={{
                    duration: 25,
                    ease: "linear",
                    repeat: Infinity
                  }}
                />
              </motion.g>
            ))}
          </motion.g>

          {/* Layer 3: Pulsus Bisferiens - double systolic peaks */}
          <motion.g
            style={{ x: layer3X }}
            filter="url(#softGlow)"
          >
            {[0, 280, 560, 840, 1120, 1400, 1680, 1960, 2240].map((offset, i) => (
              <motion.path
                key={`bisferiens-${i}`}
                d={`M${offset},300 Q${offset+10},295 ${offset+20},260 Q${offset+30},200 ${offset+40},140 Q${offset+50},100 ${offset+55},90 Q${offset+60},88 ${offset+65},92 Q${offset+70},96 ${offset+75},90 Q${offset+80},88 ${offset+85},92 Q${offset+90},96 ${offset+100},110 Q${offset+120},150 ${offset+150},210 Q${offset+190},270 ${offset+230},290 L${offset+280},300`}
                fill="none"
                stroke="#bccde5"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ opacity: glowOpacity3 }}
                animate={{ x: [-280, 0] }}
                transition={{
                  duration: 30,
                  ease: "linear",
                  repeat: Infinity
                }}
              />
            ))}
          </motion.g>

          {/* Animated pulse dots that follow the waveforms */}
          <motion.circle
            cx={0}
            cy={280}
            r="4"
            fill="#88c2c4"
            filter="url(#softGlow)"
            animate={{
              opacity: [0, 1, 1, 0],
              cx: [0, 2000],
              cy: [280, 240, 120, 70, 78, 100, 200, 270, 280]
            }}
            transition={{
              duration: 20,
              ease: "linear",
              repeat: Infinity,
              opacity: {
                times: [0, 0.05, 0.95, 1]
              },
              cy: {
                times: [0, 0.1, 0.2, 0.25, 0.3, 0.4, 0.6, 0.8, 1]
              }
            }}
          />
          
          <motion.circle
            cx={0}
            cy={260}
            r="3.5"
            fill="#4f6b93"
            filter="url(#softGlow)"
            animate={{
              opacity: [0, 0.8, 0.8, 0],
              cx: [0, 2000],
              cy: [260, 220, 100, 50, 58, 80, 180, 250, 260]
            }}
            transition={{
              duration: 25,
              ease: "linear",
              repeat: Infinity,
              opacity: {
                times: [0, 0.05, 0.95, 1]
              },
              cy: {
                times: [0, 0.1, 0.2, 0.25, 0.3, 0.4, 0.6, 0.8, 1]
              },
              delay: 2
            }}
          />
          
          <motion.circle
            cx={0}
            cy={300}
            r="3"
            fill="#bccde5"
            filter="url(#softGlow)"
            animate={{
              opacity: [0, 0.6, 0.6, 0],
              cx: [0, 2000],
              cy: [300, 260, 140, 90, 92, 110, 210, 290, 300]
            }}
            transition={{
              duration: 30,
              ease: "linear",
              repeat: Infinity,
              opacity: {
                times: [0, 0.05, 0.95, 1]
              },
              cy: {
                times: [0, 0.1, 0.2, 0.25, 0.3, 0.4, 0.6, 0.8, 1]
              },
              delay: 4
            }}
          />
        </svg>
      </div>

      {/* Soft gradient orbs for depth */}
      <motion.div 
        className="absolute inset-0 opacity-20" 
        aria-hidden="true"
        style={{ x: layer1X }}
      >
        <motion.div 
          className="absolute rounded-full blur-3xl"
          style={{
            width: '400px',
            height: '400px',
            background: 'radial-gradient(circle, rgba(136, 194, 196, 0.2) 0%, transparent 70%)',
            top: '-10%',
            left: '10%'
          }}
          animate={{
            scale: [1, 1.1, 1],
            opacity: [0.2, 0.3, 0.2]
          }}
          transition={{
            duration: 8,
            ease: "easeInOut",
            repeat: Infinity
          }}
        />
        <motion.div 
          className="absolute rounded-full blur-3xl"
          style={{
            width: '350px',
            height: '350px',
            background: 'radial-gradient(circle, rgba(79, 107, 147, 0.15) 0%, transparent 70%)',
            bottom: '0%',
            right: '15%'
          }}
          animate={{
            scale: [1, 1.15, 1],
            opacity: [0.15, 0.25, 0.15]
          }}
          transition={{
            duration: 10,
            ease: "easeInOut",
            repeat: Infinity,
            delay: 2
          }}
        />
      </motion.div>
      
      {/* Content container with frosted glass effect */}
      <div className="relative w-full px-4 sm:px-6 lg:px-8 py-20 sm:py-28 lg:py-32 z-10">
        <motion.div 
          className="text-center w-full"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          {/* Semi-transparent backdrop for text readability */}
          <div 
            className="inline-block rounded-2xl px-8 py-6"
            style={{
              background: 'rgba(30, 41, 59, 0.4)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)'
            }}
          >
            {/* Main heading */}
            <h1 
              className="font-light tracking-tight"
              style={{ 
                fontSize: 'clamp(36px, 5vw, 64px)', 
                letterSpacing: '-0.03em',
                lineHeight: '1.2',
                color: '#f5f7fb',
                textShadow: '0 2px 10px rgba(0, 0, 0, 0.3)'
              }}
              data-testid="hero-title"
            >
              Research
              <br />
              Fueled by SphygmoCor<span style={{ fontSize: '0.5em', verticalAlign: 'super' }}>©</span>
              <br />
            </h1>
          </div>
        </motion.div>
      </div>
    </motion.section>
  );
}