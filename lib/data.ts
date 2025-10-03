import { Mail, Github, Linkedin, Instagram } from "lucide-react";
import { CodeProject, DesignProject, SkillCategory, Contact } from "./types";

export const codeProjects: CodeProject[] = [
  {
    title: "Strangebad Effects",
    description: "Full-stack e-commerce website for audio effects pedals",
    tech: ["TypeScript", "React", "Next.js", "Tailwind", "Appwrite"],
    link: "https://strangebadeffects.com",
    github: "https://github.com/williamjaysmith",
    image: "/Images/Code/StrangebadEffectsWebsite.mp4",
  },
  {
    title: "FriendlyReminder",
    description: "TypeScript-based reminder application ",
    tech: ["TypeScript", "React", "Next.js"],
    link: "https://friendly-reminder-sage.vercel.app",
    github: "https://github.com/williamjaysmith/FriendlyReminder",
    image: "/Images/Code/friendlyreminderimage.png",
  },
  {
    title: "TripForge",
    description: "Full-stack tour booking with Stripe & Mapbox",
    tech: ["Node.js", "Express", "MongoDB", "Stripe"],
    link: "https://tripforge-110a0edcf1cc.herokuapp.com/",
    github: "https://github.com/williamjaysmith/TripForge",
    image: "/Images/Code/tripforge.gif",
  },
  {
    title: "Oddbird Portal",
    description: "Interactive portal application",
    tech: ["React", "TypeScript", "Next.js"],
    link: "#",
    github: "https://github.com/williamjaysmith",
    image: "/Images/Code/OddbirdPortal.gif",
  },
];

export const designProjects: DesignProject[] = [
  {
    title: "Portfolio",
    description: "My original portfolio design",
    tech: ["Procreate", "True Grit"],
    link: "#",
    github: "#",
    image: "/Images/Design/background.jpg",
  },
  {
    title: "Plugin",
    description: "Complete UI/UX design for audio plugin interface, including custom buttons, knobs, sliders, and visual assets",
    tech: ["Photoshop", "True Grit"],
    link: "#",
    github: "#",
    image: "/Images/Design/SuperDopePluginSquare.png",
    modalImage: "/Images/Design/fuzzpedal.png",
  },
];

export const skillCategories: SkillCategory[] = [
  {
    category: "LANGUAGES",
    skills: ["JavaScript", "TypeScript", "HTML", "CSS", "Python"],
  },
  {
    category: "FRONTEND",
    skills: ["React", "Next.js", "Tailwind CSS", "Framer Motion", "Redux"],
  },
  {
    category: "BACKEND",
    skills: ["Node.js", "Express", "MongoDB", "PostgreSQL", "REST APIs"],
  },
  {
    category: "TOOLS",
    skills: ["Git", "Docker", "Webpack", "VS Code", "Figma"],
  },
  {
    category: "DESIGN",
    skills: [
      "UI/UX",
      "Responsive Design",
      "Typography",
      "Color Theory",
      "Prototyping",
    ],
  },
];

export const contacts: Contact[] = [
  {
    name: "EMAIL",
    link: "mailto:williamjaysmith@example.com",
    icon: Mail,
  },
  {
    name: "GITHUB",
    link: "https://github.com/williamjaysmith",
    icon: Github,
  },
  {
    name: "LINKEDIN",
    link: "https://linkedin.com/in/williamjaysmith",
    icon: Linkedin,
  },
  {
    name: "INSTAGRAM",
    link: "https://instagram.com/williamjaysmith",
    icon: Instagram,
  },
];
