"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { skillCategories } from "@/lib/data";
import SkillCategoryCard from "../ui/SkillCategoryCard";

export default function SkillsSection() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [key, setKey] = useState(0);

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % skillCategories.length);
  };

  const handlePrev = () => {
    setCurrentIndex(
      (prev) => (prev - 1 + skillCategories.length) % skillCategories.length
    );
  };

  const handleResume = () => {
    setIsPaused(false);
    setKey((prev) => prev + 1); // Force reset the interval
  };

  // Auto-rotate carousel
  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      handleNext();
    }, 3000); // Rotate every 3 seconds

    return () => clearInterval(interval);
  }, [isPaused, key]);

  const getCardPosition = (index: number) => {
    const diff = index - currentIndex;
    const total = skillCategories.length;

    // Normalize difference to be between -total/2 and total/2
    let normalizedDiff = diff;
    if (diff > total / 2) {
      normalizedDiff = diff - total;
    } else if (diff < -total / 2) {
      normalizedDiff = diff + total;
    }

    return normalizedDiff;
  };

  return (
    <div
      id="skills"
      className="pt-20 px-8"
      style={{
        scrollMarginTop: "45px",
      }}
    >
      <div className="max-w-7xl mx-auto">
        <motion.h2
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-5xl md:text-7xl font-black text-[#2c2c2c]"
        >
          SKILLS
        </motion.h2>
      </div>

      {/* 3D Carousel */}
      <div
        className="relative max-w-7xl mx-auto h-[350px] md:h-[450px] flex items-center justify-center"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={handleResume}
      >
        <motion.div
          className="relative w-full h-full flex items-center justify-center perspective-1000 cursor-grab active:cursor-grabbing"
          style={{ touchAction: "none" }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.2}
          dragMomentum={false}
          onDragStart={() => setIsPaused(true)}
          onDragEnd={(e, { offset, velocity }) => {
            const swipe = Math.abs(offset.x) * velocity.x;

            if (swipe < -500 || offset.x < -50) {
              handleNext();
            } else if (swipe > 500 || offset.x > 50) {
              handlePrev();
            }

            // Resume after a brief delay
            setTimeout(() => handleResume(), 1000);
          }}
        >
          <AnimatePresence initial={false}>
            {skillCategories.map((category, index) => {
              const position = getCardPosition(index);
              const isCenter = position === 0;
              const absPosition = Math.abs(position);

              return (
                <motion.div
                  key={index}
                  initial={false}
                  animate={{
                    x: position === 0 ? 0 : position * 80 + (position > 0 ? 40 : -40),
                    scale: isCenter ? 1 : Math.max(0.7 - absPosition * 0.1, 0.5),
                    z: isCenter ? 0 : -absPosition * 100,
                    opacity: absPosition > 2 ? 0 : 1,
                    zIndex: isCenter ? 10 : 10 - absPosition,
                  }}
                  transition={{
                    duration: 0.5,
                    ease: "easeInOut",
                  }}
                  className="absolute pointer-events-none"
                >
                  <SkillCategoryCard
                    category={category}
                    index={index}
                    isCenter={isCenter}
                  />
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
