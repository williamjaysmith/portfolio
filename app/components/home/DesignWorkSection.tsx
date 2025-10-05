"use client";

import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { designProjects } from "@/lib/data";
import { DesignProject } from "@/lib/types";
import DesignProjectCard from "../ui/DesignProjectCard";
import DesignProjectModal from "../ui/DesignProjectModal";

export default function DesignWorkSection() {
  const [selectedProject, setSelectedProject] = useState<DesignProject | null>(
    null
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleProjectClick = (project: DesignProject) => {
    setSelectedProject(project);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setTimeout(() => setSelectedProject(null), 300);
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % designProjects.length);
  };

  const handlePrev = () => {
    setCurrentIndex(
      (prev) => (prev - 1 + designProjects.length) % designProjects.length
    );
  };

  return (
    <div
      id="design-work"
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
          className="section-header code-section-heading text-[#2c2c2c]"
          style={{ fontSize: 'var(--code-heading-size)' }}
        >
          DESIGN
        </motion.h2>
      </div>

      {/* Design Work Carousel */}
      <div className="max-w-7xl mx-auto relative py-8">
        {/* Mobile: Single card */}
        <div className="md:hidden overflow-visible px-4 flex justify-center">
          <div className="relative h-[400px] flex items-center justify-center w-full max-w-[350px]">
            {designProjects.map((project, i) => (
              <motion.div
                key={i}
                initial={false}
                animate={{
                  x: `${(i - currentIndex) * 100}%`,
                  opacity: i === currentIndex ? 1 : 0,
                }}
                transition={{
                  duration: 0.5,
                  ease: "easeInOut",
                }}
                className="absolute w-full min-w-[280px]"
                style={{ pointerEvents: i === currentIndex ? "auto" : "none" }}
              >
                <DesignProjectCard
                  project={project}
                  index={i}
                  onClick={() => handleProjectClick(project)}
                />
              </motion.div>
            ))}
          </div>
        </div>

        {/* Desktop: Two cards with sliding */}
        <div className="hidden md:block overflow-visible px-4">
          <div className="relative h-[500px] flex items-center justify-center max-w-7xl mx-auto">
            <div className="relative flex items-center justify-center w-full max-w-[900px]">
              {designProjects.map((project, i) => {
                // Calculate position relative to current index
                const diff = i - currentIndex;
                const total = designProjects.length;

                let position = diff;
                if (diff > total / 2) position = diff - total;
                else if (diff < -total / 2) position = diff + total;

                // Show current and next card
                const isVisible = position === 0 || position === 1;

                // Position cards side by side with gap using percentage
                const xOffset = position === 0 ? '-54%' : position === 1 ? '54%' : `${position * 220}%`;

                return (
                  <motion.div
                    key={i}
                    initial={false}
                    animate={{
                      x: xOffset,
                      opacity: isVisible ? 1 : 0,
                    }}
                    transition={{
                      duration: 0.5,
                      ease: "easeInOut",
                    }}
                    className="absolute w-[45%] max-w-[400px] min-w-[280px]"
                    style={{
                      pointerEvents: isVisible ? "auto" : "none",
                    }}
                  >
                    <DesignProjectCard
                      project={project}
                      index={i}
                      onClick={() => handleProjectClick(project)}
                    />
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Dot Indicators with Arrow Navigation */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex items-center gap-4 z-20">
          {/* Left Arrow */}
          <motion.button
            onClick={handlePrev}
            whileTap={{ scale: 0.9 }}
            className="bg-[#2c2c2c] text-white w-10 h-10 md:w-8 md:h-8 rounded-full flex items-center justify-center"
          >
            <ChevronLeft className="w-5 h-5 md:w-4 md:h-4" strokeWidth={3} />
          </motion.button>

          {/* Dots */}
          <div className="flex gap-2">
            {designProjects.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={`w-2 h-2 rounded-full transition-all ${
                  index === currentIndex
                    ? "bg-[#2c2c2c] w-6"
                    : "bg-[#2c2c2c]/30"
                }`}
              />
            ))}
          </div>

          {/* Right Arrow */}
          <motion.button
            onClick={handleNext}
            whileTap={{ scale: 0.9 }}
            className="bg-[#2c2c2c] text-white w-10 h-10 md:w-8 md:h-8 rounded-full flex items-center justify-center"
          >
            <ChevronRight className="w-5 h-5 md:w-4 md:h-4" strokeWidth={3} />
          </motion.button>
        </div>
      </div>

      <DesignProjectModal
        project={selectedProject}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
      />

      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-8 text-center"
        >
          <a href="#" target="_blank" rel="noopener noreferrer">
            <motion.button
              initial={{ boxShadow: "0px 0px 0px #2c2c2c" }}
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
              className="inline-flex items-center gap-2 rounded-2xl border-3 border-[#2c2c2c] bg-[#2c2c2c] button-text code-view-button whitespace-nowrap text-white transition-colors hover:bg-white hover:text-[#2c2c2c]"
              style={{
                fontSize: 'var(--button-font-size)',
                paddingLeft: 'var(--button-px)',
                paddingRight: 'var(--button-px)',
                paddingTop: 'var(--button-py)',
                paddingBottom: 'var(--button-py)',
              }}
            >
              VIEW ALL DESIGN <ChevronRight className="w-6 h-6" strokeWidth={3} />
            </motion.button>
          </a>
        </motion.div>
      </div>
    </div>
  );
}
