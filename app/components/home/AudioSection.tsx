"use client";

import { motion } from "framer-motion";
import MusicPlayer from "../ui/MusicPlayer";

export default function AudioSection() {
  return (
    <div
      id="audio-work"
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
          className="section-header code-section-heading text-[#2c2c2c]"
          style={{ fontSize: 'var(--code-heading-size)' }}
        >
          AUDIO
        </motion.h2>
      </div>

      {/* Music Player */}
      <div className="max-w-7xl mx-auto relative py-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex justify-center px-4 pt-8"
        >
          <div className="w-full max-w-2xl">
            <MusicPlayer />
          </div>
        </motion.div>
      </div>
    </div>
  );
}
