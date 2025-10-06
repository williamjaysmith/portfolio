"use client";

import { motion, useAnimation } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { useEffect } from "react";
import { contacts } from "@/lib/data";
import ContactCard from "../ui/ContactCard";

export default function ContactSection() {
  const controls = useAnimation();

  useEffect(() => {
    const wiggle = async () => {
      await controls.start({
        rotate: [0, -5, 5, -5, 5, 0],
        transition: { duration: 0.5 },
      });
    };

    const interval = setInterval(() => {
      wiggle();
    }, 3000);

    return () => clearInterval(interval);
  }, [controls]);
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
          className="section-header code-section-heading mb-16 text-[#2c2c2c]"
          style={{ fontSize: 'var(--code-heading-size)' }}
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
          <div className="mb-8">
            <p className="text-2xl font-bold text-[#2c2c2c] blur-text-bg-inline">
              Available for freelance projects and full-time opportunities
            </p>
          </div>
          <motion.a
            href="mailto:williamjaysmith@example.com"
            animate={controls}
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
            className="inline-flex items-center gap-2 rounded-2xl border-3 border-[#2c2c2c] bg-[#2c2c2c] button-text code-view-button whitespace-nowrap text-white transition-colors hover:bg-white hover:text-[#2c2c2c]"
            style={{
              fontSize: 'var(--button-font-size)',
              paddingLeft: 'var(--button-px)',
              paddingRight: 'var(--button-px)',
              paddingTop: 'var(--button-py)',
              paddingBottom: 'var(--button-py)',
            }}
          >
            GET IN TOUCH <ChevronRight className="w-6 h-6" strokeWidth={3} />
          </motion.a>
        </motion.div>
      </div>
    </div>
  );
}
