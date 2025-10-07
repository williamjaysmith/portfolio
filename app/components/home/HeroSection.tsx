"use client";

import { motion, useAnimation } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import React from "react";
import dynamic from "next/dynamic";

// Lazy load SkillsMarquee with all its icons
const SkillsMarquee = dynamic(() => import("./SkillsMarquee"), {
  ssr: true,
});

// Helper function to generate starting position based on index
const getStartPosition = (index: number) => {
  const directions = [
    { x: -800, y: -600 }, // top-left
    { x: -400, y: -700 }, // top-left-center
    { x: 0, y: -800 },    // top
    { x: 400, y: -700 },  // top-right-center
    { x: 800, y: -600 },  // top-right
  ];
  return directions[index % directions.length];
};

// Helper function to generate delay based on index
const getDelay = (index: number) => {
  // Predefined shuffled sequence for 12 letters
  const delaySequence = [0.6, 0.15, 1.2, 0.45, 0.9, 1.5, 0.3, 1.05, 0, 0.75, 1.35, 0.6];
  return delaySequence[index % delaySequence.length];
};

const ROLES_RAW = ["DEVELOPER", "DESIGNER"];

// Pad all roles to be the same length, right-aligned
const maxLength = Math.max(...ROLES_RAW.map(r => r.length));
const ROLES = ROLES_RAW.map(role => {
  const padding = maxLength - role.length;
  return " ".repeat(padding) + role;
});

// Generate random delays for each letter position
const generateRandomDelays = (length: number) => {
  return Array.from({ length }, () => Math.random() * 0.6);
};

function SlotMachineText() {
  const [currentRoleIndex, setCurrentRoleIndex] = useState(0);
  const [delays, setDelays] = useState<number[]>([]);

  useEffect(() => {
    // Initialize delays on mount
    setDelays(generateRandomDelays(maxLength));
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentRoleIndex((prev) => (prev + 1) % ROLES.length);
      // Generate new random delays for each transition
      setDelays(generateRandomDelays(maxLength));
    }, 2000); // Change on both inhale and exhale (2s intervals)

    return () => clearInterval(interval);
  }, []);

  const currentRole = ROLES[currentRoleIndex];
  const nextRole = ROLES[(currentRoleIndex + 1) % ROLES.length];

  return (
    <div className="flex justify-start w-full">
      <div
        className="flex slot-machine-container"
        style={{
          fontFamily: 'PortfolioFont1, sans-serif',
        }}
      >
        {Array.from({ length: maxLength }).map((_, index) => {
          const currentChar = currentRole[index];
          const nextChar = nextRole[index];

          return (
            <div
              key={index}
              className="inline-block relative slot-machine-char"
              style={{
                height: "1.2em",
                overflow: "hidden",
                textAlign: "center",
              }}
            >
              <motion.div
                key={currentRoleIndex}
                className="flex flex-col"
                initial={{ y: "0%" }}
                animate={{ y: "-50%" }}
                transition={{
                  duration: 0.3,
                  delay: delays[index] || 0, // Start at 0s (WILLIAM breathing in phase)
                  ease: "easeInOut",
                }}
              >
                <span style={{ height: "1.2em", lineHeight: "1.2em", display: "block" }}>{currentChar}</span>
                <span style={{ height: "1.2em", lineHeight: "1.2em", display: "block" }}>{nextChar}</span>
              </motion.div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function HeroSection() {
  const controls = useAnimation();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadFonts = async () => {
      try {
        // Load critical fonts in parallel with a 2 second timeout safety net
        await Promise.race([
          Promise.all([
            document.fonts.load('normal 1em PortfolioNameFont'),
            document.fonts.load('normal 1em PortfolioFont1'),
          ]),
          new Promise(resolve => setTimeout(resolve, 2000))
        ]);

        // Only update state if component is still mounted
        if (isMounted) {
          setMounted(true);
        }
      } catch (error) {
        // Fallback: if fonts fail to load, proceed anyway
        console.warn('Font loading failed:', error);
        if (isMounted) {
          setMounted(true);
        }
      }
    };

    loadFonts();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const wiggle = async () => {
      await controls.start({
        rotate: [0, -5, 5, -5, 5, 0],
        transition: { duration: 0.5 },
      });
    };

    const interval = setInterval(() => {
      wiggle();
    }, 3000);

    return () => clearInterval(interval);
  }, [controls]);

  // Show loading state while fonts load
  if (!mounted) {
    return (
      <div
        id="home"
        className="min-h-screen pt-20 overflow-hidden flex items-center justify-center"
        style={{
          scrollMarginTop: "45px",
        }}
      >
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#2c2c2c] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[#2c2c2c] text-lg font-semibold">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      id="home"
      className="min-h-screen pt-20 overflow-hidden"
      style={{
        scrollMarginTop: "45px",
      }}
    >
      <div className="flex items-center px-5 xs:px-8">
        <div className="max-w-7xl mx-auto w-full">
        <div className="mb-8 name-container relative z-20 pr-4" style={{ transform: 'rotate(-3deg)' }}>
          {/* WILLIAM */}
          <div className="flex mb-4 name-william">
            {["W", "i", "l", "L", "i", "a", "M"].map((letter, i) => {
              const startPosition = getStartPosition(i);
              const delay = getDelay(i);
              const rotateValues = [120, -45, 85, -160, 30, 95, -110];
              const initialRotate = rotateValues[i];

              return (
                <motion.span
                  key={`william-${letter}-${i}`}
                  initial={{
                    x: startPosition.x,
                    y: startPosition.y,
                    opacity: 0,
                    rotate: initialRotate
                  }}
                  animate={{
                    x: 0,
                    y: 0,
                    opacity: 1,
                    rotate: 0
                  }}
                  transition={{
                    delay: delay,
                    type: "spring",
                    stiffness: 200,
                    damping: 12,
                    mass: 0.8,
                    velocity: 1
                  }}
                  className="text-[#2c2c2c] inline-block"
                  style={{
                    fontSize: 'var(--font-size)',
                    fontFeatureSettings: (i === 0 || i === 6) ? "'salt' 1" : "normal",
                    // Safari fix - prevent glyph clipping
                    padding: '0.3em 0.15em',
                    margin: '-0.3em -0.15em',
                    overflow: 'visible',
                    // Safari fix: Prevent composite layer demotion (stops flickering)
                    willChange: 'transform',
                    transform: 'translateZ(0)',
                    // Extra padding on last letter for breathe animation
                    ...(i === 6 && {
                      paddingRight: '0.5em',
                      marginRight: '-0.5em'
                    })
                  }}
                >
                  {letter}
                </motion.span>
              );
            })}
          </div>
          {/* SMITH */}
          <div className="flex name-smith">
            {["S", "m", "i", "t", "h"].map((letter, i) => {
              const startPosition = getStartPosition(i + 7);
              const delay = getDelay(i + 7);
              const rotateValues = [75, -135, 50, -90, 145];
              const initialRotate = rotateValues[i];

              return (
                <motion.span
                  key={`smith-${letter}-${i}`}
                  initial={{
                    x: startPosition.x,
                    y: startPosition.y,
                    opacity: 0,
                    rotate: initialRotate
                  }}
                  animate={{
                    x: 0,
                    y: 0,
                    opacity: 1,
                    rotate: 0
                  }}
                  transition={{
                    delay: delay,
                    type: "spring",
                    stiffness: 200,
                    damping: 12,
                    mass: 0.8,
                    velocity: 1
                  }}
                  className="text-[#2c2c2c] inline-block"
                  style={{
                    fontSize: 'var(--font-size)',
                    fontFeatureSettings: (i === 4) ? "'salt' 1" : "normal",
                    // Safari fix - prevent glyph clipping
                    padding: '0.3em 0.15em',
                    margin: '-0.3em -0.15em',
                    overflow: 'visible',
                    // Safari fix: Prevent composite layer demotion (stops flickering)
                    willChange: 'transform',
                    transform: 'translateZ(0)'
                  }}
                >
                  {letter}
                </motion.span>
              );
            })}
          </div>

          {/* Staggered Role Text - Below SMITH */}
          <motion.div
            initial={{ opacity: 0, y: 30, rotate: 0 }}
            animate={{ opacity: 1, y: 0, rotate: 1.5 }}
            transition={{
              delay: 0.4,
              duration: 0.4,
              type: "spring",
              stiffness: 300,
              damping: 10,
            }}
            className="relative"
            style={{ left: 'var(--staggered-text-left)', top: 'var(--staggered-text-top)' }}
          >
            <div className="text-4xl xs:text-[2.5rem] sm:text-5xl md:text-6xl lg:text-6xl xl:text-7xl font-bold text-[#2c2c2c]">
              <SlotMachineText />
            </div>
          </motion.div>
        </div>

        {/* Hire Me Button */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            delay: 0.5,
            duration: 0.4,
            type: "spring",
            stiffness: 300,
            damping: 10,
          }}
          className="mb-[42px] flex justify-end"
        >
          <motion.a
            href="#contact"
            onClick={(e) => {
              e.preventDefault();
              document
                .getElementById("contact")
                ?.scrollIntoView({ behavior: "smooth" });
              setTimeout(() => {
                const el = document.getElementById("contact");
                el?.classList.add("jiggle");
                setTimeout(() => el?.classList.remove("jiggle"), 400);
              }, 600);
            }}
            initial={{ boxShadow: "0px 0px 0px #2c2c2c" }}
            animate={controls}
            whileHover={{
              y: -6,
              rotate: -2,
              boxShadow: "6px 6px 0px #2c2c2c",
              transition: { duration: 0.2 },
            }}
            whileTap={{
              x: 3,
              y: -3,
              rotate: -2,
              boxShadow: "3px 3px 0px #2c2c2c",
              transition: { duration: 0.1 },
            }}
            className="inline-flex items-center gap-2 border-3 border-[#2c2c2c] bg-[#2c2c2c] text-white px-8 py-3 md:px-[2.125rem] md:py-[0.8125rem] lg:px-9 lg:py-3.5 xl:px-[2.375rem] xl:py-[0.9375rem] 2xl:px-10 2xl:py-4 text-lg md:text-[1.1875rem] lg:text-xl xl:text-[1.375rem] 2xl:text-2xl font-black hover:bg-white hover:text-[#2c2c2c] transition-colors rounded-2xl whitespace-nowrap"
          >
            HIRE ME <ChevronRight className="w-5 h-5" strokeWidth={3} />
          </motion.a>
        </motion.div>

        {/* Angled intro boxes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <motion.div
            initial={{ opacity: 0, rotate: -5, y: 50 }}
            animate={{
              opacity: 1,
              rotate: [-3, 3, -3],
              y: 0,
              boxShadow: [
                "8px 8px 0px #2c2c2c",
                "-8px 8px 0px #2c2c2c",
                "8px 8px 0px #2c2c2c",
              ],
            }}
            transition={{
              delay: 0.1,
              duration: 0.5,
              type: "spring",
              stiffness: 200,
              damping: 15,
              rotate: {
                delay: 0.6,
                duration: 8,
                repeat: Infinity,
                ease: "easeInOut",
                repeatType: "reverse",
              },
              boxShadow: {
                delay: 0.6,
                duration: 8,
                repeat: Infinity,
                ease: "easeInOut",
                repeatType: "reverse",
              },
            }}
            whileHover={{
              rotate: 0,
              scale: 1.02,
              boxShadow: "0px 8px 0px #2c2c2c",
              transition: { duration: 0.2 },
            }}
            className="border-3 border-[#2c2c2c] p-8 bg-white transform origin-center rounded-2xl flex flex-col mb-[25px]"
            style={{
              borderRadius: "1rem",
            }}
          >
            <h2 className="text-4xl md:text-[2.5rem] lg:text-5xl xl:text-[3.5rem] 2xl:text-6xl section-header mb-8 text-[#2c2c2c]">CODE</h2>
            <p className="text-lg mb-6 text-[#2c2c2c]">
              Full-stack developer crafting beautiful, performant web experiences with modern technologies.
            </p>
            <div className="mt-auto flex justify-end">
              <motion.a
                href="#projects"
                onClick={(e) => {
                  e.preventDefault();
                  document
                    .getElementById("projects")
                    ?.scrollIntoView({ behavior: "smooth" });
                  setTimeout(() => {
                    const el = document.getElementById("projects");
                    el?.classList.add("jiggle");
                    setTimeout(() => el?.classList.remove("jiggle"), 400);
                  }, 600);
                }}
                initial={{ boxShadow: "0px 0px 0px #2c2c2c" }}
                whileHover={{
                  y: -6,
                  boxShadow: "6px 6px 0px #2c2c2c",
                  transition: { duration: 0.2 },
                }}
                whileTap={{
                  x: 3,
                  y: -3,
                  boxShadow: "3px 3px 0px #2c2c2c",
                  transition: { duration: 0.1 },
                }}
                className="border-3 border-[#2c2c2c] bg-[#2c2c2c] text-white px-6 py-2 md:px-[1.625rem] md:py-[0.5625rem] lg:px-7 lg:py-2.5 xl:px-[1.875rem] xl:py-[0.6875rem] 2xl:px-8 2xl:py-3 text-base md:text-[1.0625rem] lg:text-lg xl:text-[1.1875rem] 2xl:text-xl font-black hover:bg-white hover:text-[#2c2c2c] transition-colors rounded-xl inline-flex items-center gap-2 whitespace-nowrap"
              >
                VIEW <ChevronRight className="w-5 h-5" strokeWidth={3} />
              </motion.a>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, rotate: 5, y: 50 }}
            animate={{
              opacity: 1,
              rotate: [3, -3, 3],
              y: 0,
              boxShadow: [
                "-8px 8px 0px #2c2c2c",
                "8px 8px 0px #2c2c2c",
                "-8px 8px 0px #2c2c2c",
              ],
            }}
            transition={{
              delay: 0.2,
              duration: 0.5,
              type: "spring",
              stiffness: 200,
              damping: 15,
              rotate: {
                delay: 0.7,
                duration: 8,
                repeat: Infinity,
                ease: "easeInOut",
                repeatType: "reverse",
              },
              boxShadow: {
                delay: 0.7,
                duration: 8,
                repeat: Infinity,
                ease: "easeInOut",
                repeatType: "reverse",
              },
            }}
            whileHover={{
              rotate: 0,
              scale: 1.02,
              boxShadow: "0px 8px 0px #2c2c2c",
              transition: { duration: 0.2 },
            }}
            className="border-3 border-[#2c2c2c] p-8 bg-white transform origin-center rounded-2xl flex flex-col mb-[25px]"
            style={{
              borderRadius: "1rem",
            }}
          >
            <h2 className="text-4xl md:text-[2.5rem] lg:text-5xl xl:text-[3.5rem] 2xl:text-6xl section-header mb-8 text-[#2c2c2c]">DESIGN</h2>
            <p className="text-lg mb-6 text-[#2c2c2c]">
              Crafting beautiful, intuitive interfaces with attention to every
              detail. User experience is at the heart of everything I create.
            </p>
            <div className="mt-auto flex justify-end">
              <motion.a
                href="#design-work"
                onClick={(e) => {
                  e.preventDefault();
                  document
                    .getElementById("design-work")
                    ?.scrollIntoView({ behavior: "smooth" });
                  setTimeout(() => {
                    const el = document.getElementById("design-work");
                    el?.classList.add("jiggle");
                    setTimeout(() => el?.classList.remove("jiggle"), 400);
                  }, 600);
                }}
                initial={{ boxShadow: "0px 0px 0px #2c2c2c" }}
                whileHover={{
                  y: -6,
                  boxShadow: "6px 6px 0px #2c2c2c",
                  transition: { duration: 0.2 },
                }}
                whileTap={{
                  x: 3,
                  y: -3,
                  boxShadow: "3px 3px 0px #2c2c2c",
                  transition: { duration: 0.1 },
                }}
                className="border-3 border-[#2c2c2c] bg-[#2c2c2c] text-white px-6 py-2 md:px-[1.625rem] md:py-[0.5625rem] lg:px-7 lg:py-2.5 xl:px-[1.875rem] xl:py-[0.6875rem] 2xl:px-8 2xl:py-3 text-base md:text-[1.0625rem] lg:text-lg xl:text-[1.1875rem] 2xl:text-xl font-black hover:bg-white hover:text-[#2c2c2c] transition-colors rounded-xl inline-flex items-center gap-2 whitespace-nowrap"
              >
                VIEW <ChevronRight className="w-5 h-5" strokeWidth={3} />
              </motion.a>
            </div>
          </motion.div>
        </div>
        </div>
      </div>

      {/* Skills Marquee - Full Width, Edge to Edge */}
      <SkillsMarquee />
    </div>
  );
}
