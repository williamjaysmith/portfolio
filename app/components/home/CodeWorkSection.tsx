"use client";

import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { codeProjects } from "@/lib/data";
import { CodeProject } from "@/lib/types";
import CodeProjectCard from "../ui/CodeProjectCard";
import CodeProjectModal from "../ui/CodeProjectModal";

export default function CodeWorkSection() {
  const [selectedProject, setSelectedProject] = useState<CodeProject | null>(
    null
  );
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleProjectClick = (project: CodeProject) => {
    setSelectedProject(project);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setTimeout(() => setSelectedProject(null), 300);
  };

  return (
    <div
      id="projects"
      className="px-8 pt-20"
      style={{
        scrollMarginTop: "45px",
      }}
    >
      <div className="mx-auto max-w-7xl">
        <motion.h2
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-5xl font-black text-[#2c2c2c] md:text-7xl"
        >
          CODE
        </motion.h2>
      </div>

      <div className="mx-auto max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="grid grid-cols-1 md:grid-cols-2 gap-12 py-8"
        >
          {codeProjects.map((project, i) => (
            <CodeProjectCard
              key={i}
              project={project}
              index={i}
              onClick={() => handleProjectClick(project)}
            />
          ))}
        </motion.div>
      </div>

      <CodeProjectModal
        project={selectedProject}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
      />

      <div className="mx-auto max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-8 text-center"
        >
          <a
            href="https://github.com/williamjaysmith"
            target="_blank"
            rel="noopener noreferrer"
          >
            <motion.button
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
              className="inline-flex items-center gap-2 rounded-2xl border-3 border-[#2c2c2c] bg-[#2c2c2c] px-12 py-6 text-2xl font-black whitespace-nowrap text-white transition-colors hover:bg-white hover:text-[#2c2c2c]"
            >
              VIEW ALL CODE <ChevronRight className="h-6 w-6" strokeWidth={3} />
            </motion.button>
          </a>
        </motion.div>
      </div>
    </div>
  );
}
