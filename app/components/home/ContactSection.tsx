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
      className="py-20 px-5 xs:px-8"
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

      </div>
    </div>
  );
}
