"use client";

import { motion, useAnimation } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { useEffect } from "react";

export default function HeroSection() {
  const controls = useAnimation();

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
      className="min-h-screen flex items-center px-8 overflow-hidden"
      style={{
        scrollMarginTop: "45px",
      }}
    >
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          {/* WILLIAM */}
          <div className="flex mb-4">
            {["W", "I", "L", "L", "I", "A", "M"].map((letter, i) => (
              <motion.span
                key={i}
                initial={{ opacity: 0, y: 50, scale: 0.5 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{
                  delay: i * 0.03,
                  duration: 0.4,
                  type: "spring",
                  stiffness: 300,
                  damping: 10,
                }}
                whileHover={{
                  y: -10,
                  scale: 1.1,
                  rotate: Math.random() * 10 - 5,
                  transition: { duration: 0.2 },
                }}
                className="text-7xl md:text-9xl font-black text-[#2c2c2c] inline-block cursor-pointer max-md:text-6xl"
                style={{ transformStyle: "preserve-3d" }}
              >
                {letter}
              </motion.span>
            ))}
          </div>
          {/* SMITH */}
          <div className="flex">
            {["S", "M", "I", "T", "H"].map((letter, i) => (
              <motion.span
                key={i}
                initial={{ opacity: 0, y: 50, scale: 0.5 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{
                  delay: 0.21 + i * 0.03,
                  duration: 0.4,
                  type: "spring",
                  stiffness: 300,
                  damping: 10,
                }}
                whileHover={{
                  y: -10,
                  scale: 1.1,
                  rotate: Math.random() * 10 - 5,
                  transition: { duration: 0.2 },
                }}
                className="text-7xl md:text-9xl font-black text-[#2c2c2c] inline-block cursor-pointer max-md:text-6xl"
                style={{ transformStyle: "preserve-3d" }}
              >
                {letter}
              </motion.span>
            ))}
          </div>
        </div>

        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            delay: 0.4,
            duration: 0.4,
            type: "spring",
            stiffness: 300,
            damping: 10,
          }}
          className="text-2xl md:text-3xl font-bold max-w-3xl mb-8 text-[#2c2c2c]"
        >
          Full-stack developer crafting beautiful, performant web experiences
          with modern technologies.
        </motion.p>

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
            className="inline-flex items-center gap-2 border-3 border-[#2c2c2c] bg-[#2c2c2c] text-white px-10 py-4 text-xl font-black hover:bg-white hover:text-[#2c2c2c] transition-colors rounded-2xl whitespace-nowrap"
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
            <h2 className="text-3xl font-black mb-4 text-[#2c2c2c]">CODE</h2>
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
                className="border-3 border-[#2c2c2c] bg-[#2c2c2c] text-white px-8 py-3 text-lg font-black hover:bg-white hover:text-[#2c2c2c] transition-colors rounded-xl inline-flex items-center gap-2 whitespace-nowrap"
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
            <h2 className="text-3xl font-black mb-4 text-[#2c2c2c]">DESIGN</h2>
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
                className="border-3 border-[#2c2c2c] bg-[#2c2c2c] text-white px-8 py-3 text-lg font-black hover:bg-white hover:text-[#2c2c2c] transition-colors rounded-xl inline-flex items-center gap-2 whitespace-nowrap"
              >
                VIEW <ChevronRight className="w-5 h-5" strokeWidth={3} />
              </motion.a>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
