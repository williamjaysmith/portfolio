"use client";

import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { DesignProject } from "@/lib/types";
import TechBadge from "./TechBadge";

interface DesignProjectCardProps {
  project: DesignProject;
  index: number;
}

export default function DesignProjectCard({
  project,
  index,
}: DesignProjectCardProps) {
  return (
    <motion.div
      initial={{
        opacity: 0,
        rotate: index % 2 === 0 ? -3 : 3,
        y: 50,
      }}
      whileInView={{
        opacity: 1,
        rotate: index % 2 === 0 ? -3 : 3,
        y: 0,
        boxShadow: "8px 8px 0px #2c2c2c",
      }}
      viewport={{ once: false, margin: "0px", amount: 0.3 }}
      transition={{
        duration: 0.5,
        type: "spring",
        stiffness: 200,
        damping: 15,
      }}
      whileHover={{
        scale: 1.03,
        rotate: 0,
        boxShadow: "0px 8px 0px #2c2c2c",
        transition: { duration: 0.2 },
      }}
      className="border-3 border-[#2c2c2c] p-8 bg-white group cursor-pointer rounded-2xl flex-shrink-0 w-full md:w-[calc((100%-48px)/2)]"
      style={{
        borderRadius: "1rem",
        scrollSnapAlign: "start",
      }}
    >
      <h4 className="text-3xl font-black mb-3 text-[#2c2c2c]">
        {project.title}
      </h4>
      <p className="text-lg mb-4 text-[#2c2c2c]">{project.description}</p>
      <div className="flex flex-wrap gap-2 mb-6">
        {project.tech.map((tech, j) => (
          <TechBadge key={j} tech={tech} />
        ))}
      </div>
      <div className="flex gap-4">
        <a
          href={project.link}
          target="_blank"
          rel="noopener noreferrer"
          className="font-black hover:underline text-[#2c2c2c] inline-flex items-center gap-1"
        >
          VIEW <ChevronRight className="w-4 h-4" strokeWidth={3} />
        </a>
      </div>
    </motion.div>
  );
}
