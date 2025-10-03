import { Mail, Github, Linkedin, Instagram } from "lucide-react";
import { CodeProject, DesignProject, SkillCategory, Contact } from "./types";

export const codeProjects: CodeProject[] = [
  {
    title: "FriendlyReminder",
    description: "TypeScript-based reminder application ",
    tech: ["TypeScript", "React", "Next.js"],
    link: "https://friendly-reminder-sage.vercel.app",
    github: "https://github.com/williamjaysmith/FriendlyReminder",
    image: "/Images/friendlyreminderimage.png",
  },
  {
    title: "TripForge",
    description: "Full-stack tour booking with Stripe & Mapbox",
    tech: ["Node.js", "Express", "MongoDB", "Stripe"],
    link: "https://tripforge-110a0edcf1cc.herokuapp.com/",
    github: "https://github.com/williamjaysmith/TripForge",
  },
];

export const designProjects: DesignProject[] = [
  {
    title: "Brand Identity System",
    description: "Complete visual identity for tech startup",
    tech: ["Figma", "Illustrator", "Photoshop"],
    link: "#",
    github: "#",
  },
  {
    title: "UI/UX Portfolio",
    description: "Modern interface designs and prototypes",
    tech: ["Figma", "Sketch", "Prototyping"],
    link: "#",
    github: "#",
  },
  {
    title: "Digital Art Collection",
    description: "Abstract and generative art pieces",
    tech: ["Procreate", "Blender", "Processing"],
    link: "#",
    github: "#",
  },
  {
    title: "Motion Graphics",
    description: "Animated logos and video content",
    tech: ["After Effects", "Cinema 4D"],
    link: "#",
    github: "#",
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
