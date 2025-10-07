"use client";

import { motion } from "framer-motion";
import { ChevronLeft } from "lucide-react";
import { useState } from "react";
import { designProjects } from "@/lib/data";
import { DesignProject } from "@/lib/types";
import DesignProjectCard from "../components/ui/DesignProjectCard";
import DesignProjectModal from "../components/ui/DesignProjectModal";
import Nav from "../components/Nav";

export default function DesignPage() {
  const [selectedProject, setSelectedProject] = useState<DesignProject | null>(
    null
  );
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleProjectClick = (project: DesignProject) => {
    setSelectedProject(project);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setTimeout(() => setSelectedProject(null), 300);
  };

  return (
    <div
      className="min-h-screen bg-white overflow-x-hidden"
      style={{
        backgroundImage:
          "radial-gradient(circle, #2c2c2c 1.5px, transparent 1.5px)",
        backgroundSize: "15px 15px",
      }}
    >
      <Nav />

      <div className="pt-20 px-5 xs:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Back Button */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: 0.1,
              duration: 0.4,
            }}
            className="mb-8"
          >
            <motion.button
              onClick={() => {
                // Navigate to home page with hash
                window.location.href = "/#design-work";
              }}
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
              className="inline-flex items-center gap-2 border-3 border-[#2c2c2c] bg-[#2c2c2c] text-white px-6 py-2 md:px-7 md:py-2.5 lg:px-8 lg:py-3 text-base md:text-lg lg:text-xl font-black hover:bg-white hover:text-[#2c2c2c] transition-colors rounded-xl"
            >
              <ChevronLeft className="w-5 h-5" strokeWidth={3} /> BACK
            </motion.button>
          </motion.div>

          {/* Page Title */}
          <motion.h1
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: 0.2,
              duration: 0.5,
            }}
            className="section-header code-section-heading text-[#2c2c2c] mb-12"
            style={{ fontSize: 'var(--code-heading-size)' }}
          >
            DESIGN PROJECTS
          </motion.h1>

          {/* Grid of Projects */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 pb-20">
            {designProjects.map((project, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: 0.3 + index * 0.1,
                  duration: 0.5,
                }}
              >
                <DesignProjectCard
                  project={project}
                  index={index}
                  onClick={() => handleProjectClick(project)}
                  noRotate={true}
                  showTitle={true}
                />
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      <DesignProjectModal
        project={selectedProject}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
      />
    </div>
  );
}
