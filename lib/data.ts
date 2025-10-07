import { Mail, Github, Linkedin, Instagram } from "lucide-react";
import { CodeProject, DesignProject, SkillCategory, Contact } from "./types";

export const codeProjects: CodeProject[] = [
  {
    title: "Strangebad Effects",
    description: "This is my current work in progress. A custom e-commerce shop for distributing audio tools. Actively designing and chipping away at development feature by feature. Integrating a device fingerprinting and licensing system to mitigate piracy.",
    tech: ["TypeScript", "React", "Next.js", "Tailwind", "Appwrite", "Stripe", "Photoshop", "Procreate"],
    link: "https://strangebadeffects.com",
    github: "#",
    image: "/Images/Code/StrangebadEffectsWebsite.mp4",
  },
  {
    title: "FriendlyReminder",
    description: "Friendly Reminder is a contact management app. Users can schedule personalized reminders and receive notifications when it's time to reach out to their contacts. A built in GUEST MODE makes it easy to explore the app - Just click <strong>Sign In</strong> and select <strong>\"Login as Guest\"</strong> to try it without creating an account.",
    tech: ["TypeScript", "React", "Next.js", "Tailwind", "Appwrite", "Resend"],
    link: "https://friendly-reminder-sage.vercel.app",
    github: "https://github.com/williamjaysmith/FriendlyReminder",
    image: "/Images/Code/friendlyremindervideo.mp4",
  },
  {
    title: "TripForge",
    description: "Full-stack tour booking with Stripe & Mapbox",
    tech: ["Node.js", "Express", "MongoDB", "Stripe"],
    link: "https://tripforge-110a0edcf1cc.herokuapp.com/",
    github: "https://github.com/williamjaysmith/TripForge",
    image: "/Images/Code/tripforge.mp4",
  },
  {
    title: "Oddbird Portal",
    description: "Interactive portal application",
    tech: ["React", "TypeScript", "Next.js"],
    link: "#",
    github: "https://github.com/williamjaysmith",
    image: "/Images/Code/OddbirdPortal.mp4",
  },
];

export const designProjects: DesignProject[] = [
  {
    title: "Illustration",
    description: "A playful, hand-drawn portfolio. Less conventional in usability and approachability, but full of character. It was a fun opportunity to turn my textured illustration aesthetic into a functioning website.",
    tech: ["Procreate", "True Grit"],
    link: "https://www.instagram.com/strangebad_official/",
    github: "#",
    image: "/Images/Design/portfoliodesign.mp4",
  },
  {
    title: "Plugin UI/UX Design",
    description: "This is a complete skeuomorphic GUI/UX design for Strangebad Effects' DSP plugin, <em>Superdope Machine</em>, mimicking the look and feel of real-world hardware. I created custom interactive assets including buttons, knobs, sliders, switches, and LEDs - each responding dynamically to user input. The interface was designed with a strong focus on user simplicity and workflow efficiency within the DAW environment.",
    tech: ["Photoshop", "True Grit"],
    link: "https://strangebadeffects.com",
    github: "#",
    image: "/Images/Design/fuzzpedal.jpg",
    modalImage: "/Images/Design/fuzzpedal.jpg",
  },
  {
    title: "Brand Design",
    description: "This was a brand development project for OktavaMods, a company specializing in transforming affordable microphones into warm, articulate, and professional-grade recording tools. My goal was to create a visual identity that captures the character of their sound- which is rich, vintage warmth balanced with modern clarity.",
    tech: ["Photoshop"],
    link: "#",
    github: "#",
    image: "/Images/Design/MJEMasthead copy.jpg",
  },
  {
    title: "Merch Design",
    description: "Having run a recording studio for years, I've had the privilege of working with many bands, not only as an audio engineer, but also as a designer creating merchandise such as T-shirts and album covers. This particular shirt design was hand-drawn, scanned and then digitally colored in Photoshop to create a two-tone print optimized for screen printing.",
    tech: ["Photoshop"],
    link: "#",
    github: "#",
    image: "/Images/Design/paigemarshalltshirt.png",
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
    link: "mailto:williamjaysmith@gmail.com",
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
    link: "https://www.instagram.com/strangebad_official/",
    icon: Instagram,
  },
];
