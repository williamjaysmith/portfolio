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
  SiGit,
} from "react-icons/si";
import { TbApi } from "react-icons/tb";

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
  { name: "Git", icon: SiGit },
  { name: "REST API", icon: TbApi },
];

export default function SkillsMarquee() {
  return (
    <div className="relative overflow-hidden bg-[#2c2c2c] py-8 w-full mt-8">
      <motion.div
        className="flex"
        animate={{
          x: [0, -3968]
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
  );
}
