"use client";

import { motion } from "framer-motion";
import { Contact } from "@/lib/types";

interface ContactCardProps {
  contact: Contact;
  index: number;
}

export default function ContactCard({ contact, index }: ContactCardProps) {
  const Icon = contact.icon;

  return (
    <motion.a
      href={contact.link}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ opacity: 0, rotate: -5, y: 30 }}
      whileInView={{
        opacity: 1,
        rotate: index % 2 === 0 ? -3 : 3,
        y: 0,
        boxShadow:
          index % 2 === 0 ? "8px 8px 0px #2c2c2c" : "-8px 8px 0px #2c2c2c",
      }}
      viewport={{ once: true }}
      transition={{
        delay: index * 0.03,
        duration: 0.4,
        type: "spring",
        stiffness: 200,
        damping: 15,
      }}
      whileHover={{
        scale: 1.1,
        rotate: 0,
        boxShadow: "0px 8px 0px #2c2c2c",
        transition: { duration: 0.2 },
      }}
      whileTap={{
        y: 4,
        boxShadow: "0px 4px 0px #2c2c2c",
        transition: { duration: 0.1 },
      }}
      className="border-3 border-[#2c2c2c] p-4 md:p-6 lg:p-8 text-center group bg-white cursor-pointer rounded-2xl flex flex-col items-center justify-center"
      style={{ borderRadius: "1rem", aspectRatio: "4/3" }}
    >
      <Icon
        className="w-8 h-8 md:w-10 md:h-10 lg:w-12 lg:h-12 text-[#2c2c2c]"
        strokeWidth={2}
      />
      <div className="hidden md:block text-base lg:text-xl font-black text-[#2c2c2c] mt-2 md:mt-3 lg:mt-4">
        {contact.name}
      </div>
    </motion.a>
  );
}
