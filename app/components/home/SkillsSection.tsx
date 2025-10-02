"use client";

import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef } from "react";
import { skillCategories } from "@/lib/data";
import SkillCategoryCard from "../ui/SkillCategoryCard";

export default function SkillsSection() {
  const skillsRef = useRef<HTMLDivElement>(null);

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

      {/* Horizontal Scrolling Skills */}
      <div className="max-w-7xl mx-auto relative">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="pl-10 pr-8 lg:pl-20 lg:pr-15"
        >
          <div
            className="overflow-hidden"
            style={{
              scrollbarWidth: "none",
              scrollSnapType: "x mandatory",
              msOverflowStyle: "none",
              padding: "2rem 2rem",
            }}
          >
            <div
              ref={skillsRef}
              className="overflow-x-auto overflow-y-hidden scroll-smooth"
              style={{
                scrollbarWidth: "none",
                msOverflowStyle: "none",
                scrollSnapType: "x mandatory",
                margin: "-2rem -2rem",
              }}
            >
              <style jsx>{`
                div::-webkit-scrollbar {
                  display: none;
                }
              `}</style>
              <div
                className="flex gap-12"
                style={{ padding: "2rem 2rem 2rem 2rem" }}
              >
                {skillCategories.map((category, i) => (
                  <SkillCategoryCard key={i} category={category} index={i} />
                ))}
                {/* Spacer: width of one visible box so last pair aligns like all others */}
                <div
                  className="flex-shrink-0 w-full md:w-[calc(50%-24px)]"
                  style={{ scrollSnapAlign: "none" }}
                />
              </div>
            </div>
          </div>
        </motion.div>

        {/* Navigation Arrows */}
        <motion.button
          onClick={() => {
            if (skillsRef.current) {
              const boxWidth =
                skillsRef.current.querySelector(".border-3")?.clientWidth ||
                400;
              skillsRef.current.scrollBy({
                left: -(boxWidth + 24),
                behavior: "smooth",
              });
            }
          }}
          whileTap={{ scale: 0.9 }}
          className="absolute left-0 top-1/2 -translate-y-1/2 bg-[#2c2c2c] text-white w-[30px] h-[30px] lg:w-12 lg:h-12 rounded-full flex items-center justify-center z-10"
        >
          <ChevronLeft className="w-5 h-5 lg:w-8 lg:h-8" strokeWidth={3} />
        </motion.button>
        <motion.button
          onClick={() => {
            if (skillsRef.current) {
              const boxWidth =
                skillsRef.current.querySelector(".border-3")?.clientWidth ||
                400;
              skillsRef.current.scrollBy({
                left: boxWidth + 24,
                behavior: "smooth",
              });
            }
          }}
          whileTap={{ scale: 0.9 }}
          className="absolute right-0 top-1/2 -translate-y-1/2 bg-[#2c2c2c] text-white w-[30px] h-[30px] lg:w-12 lg:h-12 rounded-full flex items-center justify-center z-10"
        >
          <ChevronRight className="w-5 h-5 lg:w-8 lg:h-8" strokeWidth={3} />
        </motion.button>
      </div>
    </div>
  );
}
