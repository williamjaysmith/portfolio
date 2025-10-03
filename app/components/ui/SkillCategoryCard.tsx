"use client";

import { motion } from "framer-motion";
import { SkillCategory } from "@/lib/types";

interface SkillCategoryCardProps {
  category: SkillCategory;
  index: number;
  isCenter?: boolean;
}

export default function SkillCategoryCard({
  category,
  index,
  isCenter = false,
}: SkillCategoryCardProps) {
  return (
    <motion.div
      whileHover={
        isCenter
          ? {
              rotate: 0,
              boxShadow: "0px 12px 0px #2c2c2c",
              y: -4,
              transition: { duration: 0.2 },
            }
          : {}
      }
      className={`border-3 border-[#2c2c2c] p-8 bg-white rounded-2xl w-[300px] md:w-[400px] aspect-square ${
        isCenter ? "cursor-pointer" : ""
      }`}
      style={{
        borderRadius: "1rem",
        boxShadow: isCenter ? "8px 8px 0px #2c2c2c" : "4px 4px 0px #2c2c2c",
        transform: isCenter ? "rotate(-2deg)" : "rotate(0deg)",
      }}
    >
      <h3 className="font-black text-2xl md:text-3xl mb-6 text-[#2c2c2c]">
        {category.category}
      </h3>
      <ul className="space-y-3">
        {category.skills.map((skill, j) => (
          <motion.li
            key={j}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: isCenter ? j * 0.05 : 0 }}
            className="text-base md:text-lg flex items-center text-[#2c2c2c]"
          >
            <span className="w-2 h-2 bg-[#2c2c2c] mr-3 block flex-shrink-0" />
            {skill}
          </motion.li>
        ))}
      </ul>
    </motion.div>
  );
}
