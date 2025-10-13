"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronRight } from "lucide-react";
import { DesignProject } from "@/lib/types";
import TechBadge from "./TechBadge";
import { useState, useRef, useEffect } from "react";
import Image from "next/image";

interface DesignProjectModalProps {
  project: DesignProject | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function DesignProjectModal({
  project,
  isOpen,
  onClose,
}: DesignProjectModalProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showToggle, setShowToggle] = useState(false);
  const textRef = useRef<HTMLParagraphElement>(null);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setIsExpanded(false);
      setShowToggle(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !project) return;

    const checkOverflow = () => {
      if (textRef.current) {
        setShowToggle(textRef.current.scrollHeight > textRef.current.clientHeight);
      }
    };

    // Delay check to ensure DOM is ready
    const timer = setTimeout(checkOverflow, 100);
    return () => clearTimeout(timer);
  }, [isOpen, project?.description]);

  if (!project) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-40"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[90%] max-w-3xl max-h-[90vh] overflow-y-auto bg-white border-3 border-[#2c2c2c] rounded-2xl p-6 md:p-8"
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-6 h-6 text-[#2c2c2c]" strokeWidth={3} />
            </button>

            {/* Content */}
            <h2 className="text-4xl md:text-5xl font-black text-[#2c2c2c] mb-6 pr-12">
              {project.title}
            </h2>

            {(project.modalImage || project.image) && (
              (() => {
                const src = project.modalImage || project.image || '';
                return src.endsWith('.mp4') ? (
                  <video
                    src={src}
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="w-full h-auto rounded-xl mb-6 border-2 border-[#2c2c2c]"
                  />
                ) : (
                  <Image
                    src={src}
                    alt={project.title}
                    width={800}
                    height={600}
                    loading="lazy"
                    sizes="(max-width: 768px) 90vw, 768px"
                    className="w-full h-auto rounded-xl mb-6 border-2 border-[#2c2c2c]"
                  />
                );
              })()
            )}

            <div className="mb-6">
              <p
                ref={textRef}
                className={`text-lg md:text-xl text-[#2c2c2c] ${!isExpanded ? 'line-clamp-2' : ''}`}
                dangerouslySetInnerHTML={{ __html: project.description }}
              />
              {showToggle && (
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="text-[#2c2c2c] font-bold mt-2 hover:underline"
                >
                  {isExpanded ? "Show less" : "Show more"}
                </button>
              )}
            </div>

            {project.role && (
              <div className="mb-8">
                <h3 className="text-xl font-black text-[#2c2c2c] mb-3">
                  MY ROLE
                </h3>
                <p className="text-lg md:text-xl text-[#2c2c2c] font-semibold mb-3">
                  Built from scratch, handling:
                </p>
                <ul className="list-disc list-inside space-y-2">
                  {project.role.map((role, i) => (
                    <li key={i} className="text-lg md:text-xl text-[#2c2c2c]">
                      {role}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mb-8">
              <h3 className="text-xl font-black text-[#2c2c2c] mb-3">
                TECHNOLOGIES
              </h3>
              <div className="flex flex-wrap gap-2">
                {project.tech.map((tech, i) => (
                  <TechBadge key={i} tech={tech} />
                ))}
              </div>
            </div>

            {project.link !== "#" && (
              <div className="flex gap-4">
                <a
                  href={project.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                >
                  <motion.button
                    whileHover={{
                      y: -4,
                      boxShadow: "4px 4px 0px #2c2c2c",
                    }}
                    whileTap={{
                      y: 0,
                      boxShadow: "2px 2px 0px #2c2c2c",
                    }}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-[#2c2c2c] text-white font-black rounded-xl border-3 border-[#2c2c2c] hover:bg-white hover:text-[#2c2c2c] transition-colors"
                  >
                    VIEW MORE <ChevronRight className="w-4 h-4" strokeWidth={3} />
                  </motion.button>
                </a>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
