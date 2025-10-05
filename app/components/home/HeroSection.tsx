"use client";

import { motion, useAnimation } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import React from "react";
import {
  SiJavascript,
  SiTypescript,
  SiReact,
  SiNextdotjs,
  SiExpress,
  SiNodedotjs,
  SiTailwindcss,
  SiMongodb,
  SiHtml5,
  SiCss3,
  SiRedux,
  SiFramer,
  SiFigma,
  SiAdobephotoshop,
} from "react-icons/si";
import { TbApi } from "react-icons/tb";

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

const skills = [
  { name: "JavaScript", icon: SiJavascript },
  { name: "TypeScript", icon: SiTypescript },
  { name: "React", icon: SiReact },
  { name: "Next.js", icon: SiNextdotjs },
  { name: "Express", icon: SiExpress },
  { name: "Node.js", icon: SiNodedotjs },
  { name: "Tailwind", icon: SiTailwindcss },
  { name: "MongoDB", icon: SiMongodb },
  { name: "HTML5", icon: SiHtml5 },
  { name: "CSS3", icon: SiCss3 },
  { name: "Redux", icon: SiRedux },
  { name: "Framer", icon: SiFramer },
  { name: "Figma", icon: SiFigma },
  { name: "Photoshop", icon: SiAdobephotoshop },
  { name: "REST API", icon: TbApi },
];

export default function HeroSection() {
  const controls = useAnimation();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
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

  return (
    <div
      id="home"
      className="min-h-screen pt-20 overflow-hidden"
      style={{
        scrollMarginTop: "45px",
      }}
    >
      <div className="flex items-center px-8">
        <div className="max-w-7xl mx-auto">
        <div className="mb-8 name-container relative z-20" style={{ transform: 'rotate(-3deg)' }}>
          {/* WILLIAM */}
          <div className="flex mb-4 name-william">
            {["W", "i", "l", "L", "i", "a", "M"].map((letter, i) => {
              const startPosition = getStartPosition(i);
              const delay = getDelay(i);
              const rotateValues = [120, -45, 85, -160, 30, 95, -110];
              const initialRotate = mounted ? rotateValues[i] : 0;

              return (
                <motion.span
                  key={i}
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
                    fontFeatureSettings: (i === 0 || i === 6) ? "'salt' 1" : "normal"
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
              const initialRotate = mounted ? rotateValues[i] : 0;

              return (
                <motion.span
                  key={i}
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
                    fontFeatureSettings: (i === 1 || i === 4) ? "'salt' 1" : "normal"
                  }}
                >
                  {letter}
                </motion.span>
              );
            })}
          </div>
        </div>

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
          className="max-w-3xl mb-8 relative blur-text-bg"
        >
          <p className="text-2xl md:text-3xl font-bold text-[#2c2c2c] text-center relative z-10 py-6">
            Full-stack developer crafting beautiful, performant web experiences with modern technologies.
          </p>
        </motion.div>

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
              rotate: -3,
              y: 0,
              boxShadow: "8px 8px 0px #2c2c2c",
            }}
            transition={{
              delay: 0.1,
              duration: 0.5,
              type: "spring",
              stiffness: 200,
              damping: 15,
            }}
            whileHover={{
              rotate: 0,
              scale: 1.02,
              boxShadow: "0px 8px 0px #2c2c2c",
              transition: { duration: 0.2 },
            }}
            className="border-3 border-[#2c2c2c] p-8 bg-white transform origin-center rounded-2xl flex flex-col mb-[25px]"
            style={{ borderRadius: "1rem" }}
          >
            <h2 className="text-4xl md:text-[2.5rem] lg:text-5xl xl:text-[3.5rem] 2xl:text-6xl section-header mb-8 text-[#2c2c2c]">CODE</h2>
            <p className="text-lg mb-6 text-[#2c2c2c]">
              Building robust, performant applications with modern tech stacks.
              Clean code and best practices are non-negotiable.
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
              rotate: 3,
              y: 0,
              boxShadow: "-8px 8px 0px #2c2c2c",
            }}
            transition={{
              delay: 0.2,
              duration: 0.5,
              type: "spring",
              stiffness: 200,
              damping: 15,
            }}
            whileHover={{
              rotate: 0,
              scale: 1.02,
              boxShadow: "0px 8px 0px #2c2c2c",
              transition: { duration: 0.2 },
            }}
            className="border-3 border-[#2c2c2c] p-8 bg-white transform origin-center rounded-2xl flex flex-col mb-[25px]"
            style={{ borderRadius: "1rem" }}
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
      <div className="relative overflow-hidden bg-[#2c2c2c] py-8 w-full mt-8">
        <motion.div
          className="flex"
          animate={{
            x: [0, -3298.5]
          }}
          transition={{
            duration: 40,
            repeat: Infinity,
            ease: "linear",
            repeatType: "loop"
          }}
        >
          <div className="flex shrink-0">
            {skills.map((skill, index) => {
              const Icon = skill.icon;
              return (
                <div
                  key={index}
                  className="flex items-center gap-4 px-8 shrink-0"
                >
                  <Icon className="w-12 h-12 text-white shrink-0" />
                  <span className="text-white text-2xl font-bold whitespace-nowrap">
                    {skill.name}
                  </span>
                </div>
              );
            })}
          </div>
          {/* Exact duplicate for seamless loop */}
          <div className="flex shrink-0">
            {skills.map((skill, index) => {
              const Icon = skill.icon;
              return (
                <div
                  key={`dup-${index}`}
                  className="flex items-center gap-4 px-8 shrink-0"
                >
                  <Icon className="w-12 h-12 text-white shrink-0" />
                  <span className="text-white text-2xl font-bold whitespace-nowrap">
                    {skill.name}
                  </span>
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
