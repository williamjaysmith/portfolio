"use client";

import { motion } from "framer-motion";
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

const skills = [
  { name: "JavaScript", icon: SiJavascript, color: "#F7DF1E" },
  { name: "TypeScript", icon: SiTypescript, color: "#3178C6" },
  { name: "React", icon: SiReact, color: "#61DAFB" },
  { name: "Next.js", icon: SiNextdotjs, color: "#000000" },
  { name: "Express", icon: SiExpress, color: "#000000" },
  { name: "Node.js", icon: SiNodedotjs, color: "#339933" },
  { name: "Tailwind", icon: SiTailwindcss, color: "#06B6D4" },
  { name: "MongoDB", icon: SiMongodb, color: "#47A248" },
  { name: "HTML5", icon: SiHtml5, color: "#E34F26" },
  { name: "CSS3", icon: SiCss3, color: "#1572B6" },
  { name: "Redux", icon: SiRedux, color: "#764ABC" },
  { name: "Framer", icon: SiFramer, color: "#0055FF" },
  { name: "Figma", icon: SiFigma, color: "#F24E1E" },
  { name: "Photoshop", icon: SiAdobephotoshop, color: "#31A8FF" },
  { name: "REST API", icon: TbApi, color: "#FF6B6B" },
];

export default function SkillsSection() {
  return (
    <motion.div
      id="skills"
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="relative overflow-hidden bg-[#2c2c2c] py-8 my-12"
      style={{
        scrollMarginTop: "45px",
      }}
    >
      <motion.div
        className="flex gap-16 whitespace-nowrap"
        animate={{
          x: [0, -1920],
        }}
        transition={{
          duration: 30,
          repeat: Infinity,
          ease: "linear",
        }}
      >
        {/* Duplicate the skills array for seamless loop */}
        {[...skills, ...skills, ...skills].map((skill, index) => {
          const Icon = skill.icon;
          return (
            <div
              key={index}
              className="flex items-center gap-4 flex-shrink-0"
            >
              <Icon className="w-12 h-12 text-white" />
              <span className="text-white text-2xl font-bold">
                {skill.name}
              </span>
            </div>
          );
        })}
      </motion.div>
    </motion.div>
  );
}
