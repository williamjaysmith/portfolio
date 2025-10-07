"use client";

import { motion, useAnimation } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { contacts } from "@/lib/data";
import ContactCard from "../ui/ContactCard";

export default function ContactSection() {
  const controls = useAnimation();
  const marqueeRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && marqueeRef.current) {
      const calculateMarqueeWidth = () => {
        const firstChild = marqueeRef.current?.querySelector('.flex.shrink-0');
        if (firstChild) {
          const width = firstChild.getBoundingClientRect().width;
        }
      };

      // Wait a bit for fonts to load and render
      setTimeout(calculateMarqueeWidth, 1000);
    }
  }, [mounted]);

  useEffect(() => {
    const wiggleAndJump = async () => {
      // Wiggle
      await controls.start({
        rotate: [-3, -8, -3, -8, -3, -8, -3],
        transition: { duration: 1 },
      });

      // Small pause
      await new Promise(resolve => setTimeout(resolve, 200));

      // Jump
      await controls.start({
        y: [0, -8, 0],
        transition: { duration: 0.4 },
      });
    };

    const interval = setInterval(() => {
      wiggleAndJump();
    }, 3000);

    return () => clearInterval(interval);
  }, [controls]);
  return (
    <div
      id="contact"
      className="pt-20 px-5 xs:px-8"
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

      {/* Footer Marquee - Full Width, Edge to Edge */}
      <div className="relative overflow-hidden bg-[#2c2c2c] py-8 w-screen -mx-5 xs:-mx-8 mt-20">
        <motion.div
          ref={marqueeRef}
          className="flex"
          animate={{
            x: [0, -835.53125]
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "linear",
            repeatType: "loop"
          }}
        >
          {/* Repeat the text enough times for seamless loop */}
          {[...Array(10)].map((_, groupIndex) => (
            <div key={groupIndex} className="flex shrink-0">
              <div className="flex items-center shrink-0">
                <span className="text-white text-2xl font-bold whitespace-nowrap pr-8">
                  I AM AVAILABLE FOR FULLTIME OPPORTUNITIES
                </span>
                <motion.a
                  href="mailto:williamjaysmith@gmail.com"
                  animate={controls}
                  initial={{
                    rotate: -3,
                    boxShadow: "4px 4px 0px #ffffff"
                  }}
                  whileHover={{
                    y: -6,
                    rotate: -2,
                    boxShadow: "6px 6px 0px #ffffff",
                    transition: { duration: 0.2 },
                  }}
                  whileTap={{
                    x: 3,
                    y: -3,
                    rotate: -2,
                    boxShadow: "3px 3px 0px #ffffff",
                    transition: { duration: 0.1 },
                  }}
                  className="inline-flex items-center gap-2 rounded-full border-3 border-white bg-[#2c2c2c] text-white px-8 py-3 text-lg font-bold whitespace-nowrap mr-8"
                >
                  GET IN TOUCH
                </motion.a>
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
