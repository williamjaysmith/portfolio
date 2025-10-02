"use client";

import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef } from "react";
import { codeProjects } from "@/lib/data";
import CodeProjectCard from "../ui/CodeProjectCard";

export default function CodeWorkSection() {
  const codeRef = useRef<HTMLDivElement>(null);

  return (
    <div
      id="projects"
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
          CODE
        </motion.h2>
      </div>

      {/* Code Work Carousel */}
      <div className="max-w-7xl mx-auto relative">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="pl-10 pr-3  sm:pr-5 lg:pl-20 lg:pr-19"
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
              ref={codeRef}
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
              <div className="flex gap-12" style={{ padding: "2rem 2rem 2rem 2rem" }}>
                {codeProjects.map((project, i) => (
                  <CodeProjectCard key={i} project={project} index={i} />
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
            if (codeRef.current) {
              const boxWidth =
                codeRef.current.querySelector(".border-3")?.clientWidth || 400;
              codeRef.current.scrollBy({
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
            if (codeRef.current) {
              const boxWidth =
                codeRef.current.querySelector(".border-3")?.clientWidth || 400;
              codeRef.current.scrollBy({
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

      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-8 text-center"
        >
          <a
            href="https://github.com/williamjaysmith"
            target="_blank"
            rel="noopener noreferrer"
          >
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
              className="border-3 border-[#2c2c2c] bg-[#2c2c2c] text-white px-12 py-6 text-2xl font-black hover:bg-white hover:text-[#2c2c2c] transition-colors rounded-2xl inline-flex items-center gap-2 whitespace-nowrap"
            >
              VIEW ALL CODE <ChevronRight className="w-6 h-6" strokeWidth={3} />
            </motion.button>
          </a>
        </motion.div>
      </div>
    </div>
  );
}
