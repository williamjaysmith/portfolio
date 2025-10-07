"use client";

import { useEffect } from "react";
import Nav from "./components/Nav";
import HeroSection from "./components/home/HeroSection";
import CodeWorkSection from "./components/home/CodeWorkSection";
import DesignWorkSection from "./components/home/DesignWorkSection";
import ContactSection from "./components/home/ContactSection";

export default function Home() {
  useEffect(() => {
    // Handle hash navigation on page load
    const hash = window.location.hash;
    if (hash) {
      setTimeout(() => {
        const el = document.getElementById(hash.substring(1));
        if (el) {
          el.scrollIntoView({ behavior: "smooth" });
        }
      }, 100);
    }
  }, []);

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
      <HeroSection />
      <CodeWorkSection />
      <DesignWorkSection />
      <ContactSection />
    </div>
  );
}
