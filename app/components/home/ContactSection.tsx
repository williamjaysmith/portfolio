"use client";

import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { contacts } from "@/lib/data";
import ContactCard from "../ui/ContactCard";

export default function ContactSection() {
  return (
    <div
      id="contact"
      className="py-20 px-8"
      style={{
        scrollMarginTop: "45px",
      }}
    >
      <div className="max-w-7xl mx-auto">
        <motion.h2
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-5xl md:text-7xl font-black mb-16 text-[#2c2c2c]"
        >
          LET&apos;S CONNECT!
        </motion.h2>

        <div className="grid grid-cols-4 gap-6 max-md:gap-3">
          {contacts.map((contact, i) => (
            <ContactCard key={i} contact={contact} index={i} />
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-20 text-center"
        >
          <p className="text-2xl font-bold mb-8 text-[#2c2c2c]">
            Available for freelance projects and full-time opportunities
          </p>
          <motion.a
            href="mailto:williamjaysmith@example.com"
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
            GET IN TOUCH <ChevronRight className="w-6 h-6" strokeWidth={3} />
          </motion.a>
        </motion.div>
      </div>
    </div>
  );
}
