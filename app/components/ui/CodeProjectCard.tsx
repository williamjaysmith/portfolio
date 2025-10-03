"use client";

import { motion } from "framer-motion";
import { CodeProject } from "@/lib/types";

interface CodeProjectCardProps {
  project: CodeProject;
  index: number;
  onClick: () => void;
}

export default function CodeProjectCard({
  project,
  index,
  onClick,
}: CodeProjectCardProps) {
  return (
    <motion.div
      onClick={onClick}
      initial={{
        opacity: 0,
        rotate: index % 2 === 0 ? -3 : 3,
        y: 50,
      }}
      whileInView={{
        opacity: 1,
        rotate: index % 2 === 0 ? -3 : 3,
        y: 0,
        boxShadow:
          index % 2 === 0 ? "8px 8px 0px #2c2c2c" : "-8px 8px 0px #2c2c2c",
      }}
      viewport={{ once: true }}
      transition={{
        delay: index * 0.1,
        duration: 0.5,
        type: "spring",
        stiffness: 200,
        damping: 15,
      }}
      whileHover={{
        scale: 1.05,
        rotate: 0,
        boxShadow: "0px 8px 0px #2c2c2c",
        transition: { duration: 0.2 },
      }}
      whileTap={{
        y: 4,
        boxShadow: "0px 4px 0px #2c2c2c",
        transition: { duration: 0.1 },
      }}
      className="relative group cursor-pointer rounded-2xl border-3 border-[#2c2c2c] bg-white overflow-hidden"
      style={{
        borderRadius: "1rem",
        aspectRatio: "4/3",
      }}
    >
      {project.image ? (
        <img
          src={project.image}
          alt={project.title}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gray-100">
          <h4 className="text-2xl md:text-3xl font-black text-[#2c2c2c] px-4 text-center">
            {project.title}
          </h4>
        </div>
      )}

      {/* Overlay on hover */}
      <div className="absolute inset-0 bg-[#2c2c2c]/80 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
        <p className="text-white text-xl md:text-2xl font-black px-6 text-center">
          VIEW PROJECT
        </p>
      </div>
    </motion.div>
  );
}
