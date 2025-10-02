"use client";

import { motion } from "framer-motion";
import { SkillCategory } from "@/lib/types";

interface SkillCategoryCardProps {
  category: SkillCategory;
  index: number;
}

export default function SkillCategoryCard({
  category,
  index,
}: SkillCategoryCardProps) {
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
      className="border-3 border-[#2c2c2c] p-8 bg-white cursor-pointer rounded-2xl flex-shrink-0 w-full md:w-[calc((100%-48px)/2)]"
      style={{
        borderRadius: "1rem",
        scrollSnapAlign: "start",
      }}
    >
      <h3 className="font-black text-3xl mb-6 text-[#2c2c2c]">
        {category.category}
      </h3>
      <ul className="space-y-3">
        {category.skills.map((skill, j) => (
          <motion.li
            key={j}
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: j * 0.05 }}
            className="text-lg flex items-center text-[#2c2c2c]"
          >
            <span className="w-2 h-2 bg-[#2c2c2c] mr-3 block" />
            {skill}
          </motion.li>
        ))}
      </ul>
    </motion.div>
  );
}
