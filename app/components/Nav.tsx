'use client';

import { motion, useScroll, useTransform } from 'framer-motion';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';

export default function Nav() {
  const pathname = usePathname();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // Show header when scrolled past 80% of viewport height
      const scrolled = window.scrollY > window.innerHeight * 0.8;
      setIsVisible(scrolled);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <motion.div
      initial={{ y: -200 }}
      animate={{ y: isVisible ? 0 : -200 }}
      transition={{ type: 'spring', stiffness: 100, damping: 20 }}
      className="fixed top-0 left-0 right-0 z-50"
    >
      {/* Nav with charcoal background */}
      <nav className="px-8 py-4 relative bg-[#2c2c2c] -mb-1">
        <div className="max-w-7xl mx-auto flex items-center justify-center">
          <div className="flex gap-8 max-md:gap-4">
            <a
              href="#home"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById('home')?.scrollIntoView({ behavior: 'smooth' });
                setTimeout(() => {
                  const el = document.getElementById('home');
                  el?.classList.add('jiggle');
                  setTimeout(() => el?.classList.remove('jiggle'), 400);
                }, 600);
              }}
              className="font-black text-lg hover:scale-110 transition-transform max-md:text-sm text-white"
            >
              ABOUT
            </a>
            <a
              href="#projects"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById('projects')?.scrollIntoView({ behavior: 'smooth' });
                setTimeout(() => {
                  const el = document.getElementById('projects');
                  el?.classList.add('jiggle');
                  setTimeout(() => el?.classList.remove('jiggle'), 400);
                }, 600);
              }}
              className="font-black text-lg hover:scale-110 transition-transform max-md:text-sm text-white"
            >
              WORK
            </a>
            <a
              href="#contact"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
                setTimeout(() => {
                  const el = document.getElementById('contact');
                  el?.classList.add('jiggle');
                  setTimeout(() => el?.classList.remove('jiggle'), 400);
                }, 600);
              }}
              className="font-black text-lg hover:scale-110 transition-transform max-md:text-sm text-white"
            >
              CONTACT
            </a>
          </div>
        </div>
      </nav>

      {/* Dripping Divider - absolute positioned so it doesn't block content */}
      <div className="relative w-full -mb-2" style={{ height: 0 }}>
        <svg
          className="absolute top-0 left-0 w-full pointer-events-none"
          viewBox="0 0 1200 140"
          preserveAspectRatio="none"
          style={{ height: '40px' }}
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Single filled wave shape */}
          <path
            d="M 0 0
               L 1200 0
               L 1200 15
               C 1150 25, 1110 82, 1050 82
               C 980 82, 940 35, 870 35
               C 800 35, 760 68, 700 68
               C 640 68, 600 15, 540 15
               C 470 18, 430 95, 370 95
               C 310 95, 280 15, 230 15
               C 180 22, 150 45, 110 45
               C 70 45, 40 15, 0 15
               Z"
            fill="#2c2c2c"
          />
        </svg>
      </div>
    </motion.div>
  );
}
