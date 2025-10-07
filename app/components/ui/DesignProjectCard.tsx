"use client";

import { motion } from "framer-motion";
import { DesignProject } from "@/lib/types";
import Image from "next/image";
import { useLazyVideo } from "@/app/hooks/useLazyVideo";

interface DesignProjectCardProps {
  project: DesignProject;
  index: number;
  onClick: () => void;
  noRotate?: boolean;
  showTitle?: boolean;
}

export default function DesignProjectCard({
  project,
  index,
  onClick,
  noRotate = false,
  showTitle = false,
}: DesignProjectCardProps) {
  const { videoRef, shouldLoad } = useLazyVideo();

  return (
    <motion.button
      onClick={onClick}
      initial={{
        opacity: 0,
        rotate: noRotate ? 0 : (index % 2 === 0 ? -3 : 3),
        y: 50,
      }}
      whileInView={{
        opacity: 1,
        rotate: noRotate ? 0 : (index % 2 === 0 ? -3 : 3),
        y: 0,
        boxShadow: noRotate
          ? "8px 8px 0px #2c2c2c"
          : (index % 2 === 0 ? "8px 8px 0px #2c2c2c" : "-8px 8px 0px #2c2c2c"),
      }}
      viewport={{ once: false, margin: "0px", amount: 0.3 }}
      transition={{
        duration: 0.5,
        type: "spring",
        stiffness: 200,
        damping: 15,
      }}
      whileHover={{
        scale: 1.05,
        rotate: 0,
        boxShadow: "0px 8px 0px #2c2c2c",
        transition: { duration: 0.2 },
      }}
      whileTap={{
        y: 4,
        boxShadow: "0px 4px 0px #2c2c2c",
        transition: { duration: 0.1 },
      }}
      className={`border-3 border-[#2c2c2c] bg-white cursor-pointer rounded-2xl flex-shrink-0 w-full overflow-hidden group relative ${showTitle ? 'flex flex-col' : 'aspect-square'}`}
      style={{
        borderRadius: "1rem",
      }}
    >
      {showTitle && (
        <div className="bg-[#2c2c2c] py-3 px-4 w-full flex-shrink-0">
          <h3 className="text-lg md:text-xl font-bold text-white text-center">
            {project.title}
          </h3>
        </div>
      )}
      {project.image && (
        <div className={showTitle ? 'relative w-full aspect-square overflow-hidden' : 'relative w-full h-full'}>
          {project.image.endsWith('.mp4') ? (
            <video
              ref={videoRef}
              src={shouldLoad ? project.image : undefined}
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-cover"
            />
          ) : project.title === "Plugin UI/UX Design" ? (
            <motion.div
              className="absolute top-0 left-0"
              style={{
                width: "100%",
                height: "auto",
              }}
              animate={{
                y: ["0%", "-31%", "0%"],
              }}
              transition={{
                duration: 15,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              <Image
                src={project.image}
                alt={project.title}
                width={1200}
                height={1800}
                loading="lazy"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                className="w-full h-auto"
                style={{
                  objectFit: "contain",
                  maxHeight: "none",
                }}
              />
            </motion.div>
          ) : project.title === "Brand Design" ? (
            <motion.div
              className="absolute top-0 left-0"
              style={{
                height: "100%",
                width: "auto",
              }}
              animate={{
                x: ["0%", "-63%", "0%"],
              }}
              transition={{
                duration: 15,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              <Image
                src={project.image}
                alt={project.title}
                width={2000}
                height={800}
                loading="lazy"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                className="h-full w-auto"
                style={{
                  objectFit: "contain",
                  maxWidth: "none",
                }}
              />
            </motion.div>
          ) : project.title === "Merch Design" ? (
            <motion.div
              className="relative w-full h-full"
              animate={{
                scale: [1, 1.5, 1],
              }}
              transition={{
                duration: 15,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              <Image
                src={project.image}
                alt={project.title}
                fill
                loading="lazy"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                className="object-cover"
              />
            </motion.div>
          ) : (
            <Image
              src={project.image}
              alt={project.title}
              fill
              loading="lazy"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover"
            />
          )}
          <div className="absolute inset-0 bg-[#2c2c2c]/80 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
            <span className="text-white text-3xl md:text-4xl" style={{ fontFamily: 'PortfolioFont1, sans-serif', letterSpacing: '0.2em' }}>
              VIEW PROJECT
            </span>
          </div>
        </div>
      )}
    </motion.button>
  );
}
