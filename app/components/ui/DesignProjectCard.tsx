"use client";

import { motion } from "framer-motion";
import { DesignProject } from "@/lib/types";

interface DesignProjectCardProps {
  project: DesignProject;
  index: number;
  onClick: () => void;
}

export default function DesignProjectCard({
  project,
  index,
  onClick,
}: DesignProjectCardProps) {
  return (
    <motion.button
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
      viewport={{ once: false, margin: "0px", amount: 0.3 }}
      transition={{
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
      className="border-3 border-[#2c2c2c] bg-white cursor-pointer rounded-2xl flex-shrink-0 w-full aspect-square overflow-hidden group relative"
      style={{
        borderRadius: "1rem",
      }}
    >
      {project.image && (
        <>
          {project.image.endsWith('.mp4') ? (
            <video
              src={project.image}
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-cover"
            />
          ) : project.title === "Plugin UI/UX Design" ? (
            <motion.img
              src={project.image}
              alt={project.title}
              className="w-full h-auto absolute top-0 left-0"
              style={{ minHeight: "100%" }}
              animate={{
                y: ["0%", "-31.6%", "0%"],
              }}
              transition={{
                duration: 15,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          ) : project.title === "Brand Design" ? (
            <motion.img
              src={project.image}
              alt={project.title}
              className="absolute top-0 left-0"
              style={{
                height: "100%",
                width: "auto",
                objectFit: "contain",
                maxWidth: "none",
              }}
              animate={{
                x: ["0%", "-63%", "0%"],
              }}
              transition={{
                duration: 15,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          ) : (
            <img
              src={project.image}
              alt={project.title}
              className="w-full h-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-[#2c2c2c]/80 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
            <span className="text-white text-3xl md:text-4xl" style={{ fontFamily: 'PortfolioFont1, sans-serif', letterSpacing: '0.2em' }}>
              VIEW PROJECT
            </span>
          </div>
        </>
      )}
    </motion.button>
  );
}
