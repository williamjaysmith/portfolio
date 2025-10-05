import Nav from "./components/Nav";
import HeroSection from "./components/home/HeroSection";
import CodeWorkSection from "./components/home/CodeWorkSection";
import DesignWorkSection from "./components/home/DesignWorkSection";
import ContactSection from "./components/home/ContactSection";

export default function Home() {
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
