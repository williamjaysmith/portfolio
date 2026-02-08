import { Mail, Github, Linkedin, Instagram } from "lucide-react";
import { CodeProject, DesignProject, SkillCategory, Contact, AudioTrack } from "./types";

export const codeProjects: CodeProject[] = [
  {
    title: "Strangebad Effects",
    description: "This project may look like a standard e-commerce shop for distributing audio tools, but behind the scenes, I'm building a system to protect the client's digital products from piracy.<br><br>By integrating device fingerprinting (similar to Netflix's \"three devices per customer\") and a custom licensing workflow tied directly to each product's sign-in, I'm combining Shopify-style e-commerce functionality with iLok-style piracy protection.<br><br>The result is a platform that lets the client sell with confidence, ensuring only authorized users can access their products while keeping the experience seamless for customers.",
    tech: ["TypeScript", "React", "Next.js", "Tailwind", "Appwrite", "Stripe", "Photoshop", "Procreate"],
    role: ["Frontend Development", "Backend Development", "UI/UX Design", "Data Modeling", "Brand Design and Development", "Custom E-commerce Integration", "Custom DRM Development", "Authentication", "Validation", "Email Integration", "Performance Optimization", "Responsiveness", "Accessibility"],
    link: "https://strangebadeffects.com",
    github: "#",
    image: "/Images/Code/StrangebadEffectsWebsite.mp4",
  },
  {
    title: "FriendlyReminder",
    description: "Friendly Reminder is more than a contact management app - it helps users stay consistent and intentional with their relationships.<br><br>Users can schedule personalized reminders and receive notifications when it's time to reach out - making it easy to maintain connections without letting anyone slip through the cracks.<br><br>A built-in Guest Mode lets anyone explore the app instantly - just click <strong>Sign In</strong> and select <strong>\"Login as Guest.\"</strong><br><br>Right now, the app prioritizes function over form - the interface is simple and utilitarian, designed to focus on solving the core problem efficiently.<br><br>While the design is minimal, every feature is built to help users manage their contacts and maintain meaningful connections.",
    tech: ["TypeScript", "React", "Next.js", "Tailwind", "Appwrite", "Resend"],
    role: ["Frontend Development", "Backend Development", "UI/UX Design", "Data Modeling", "Authentication", "Validation", "Email Integration", "Performance Optimization", "Responsiveness", "Accessibility"],
    link: "https://friendly-reminder-sage.vercel.app",
    github: "https://github.com/williamjaysmith/FriendlyReminder",
    image: "/Images/Code/friendlyremindervideo.mp4",
  },
  // {
  //   title: "TripForge",
  //   description: "Full-stack tour booking with Stripe & Mapbox",
  //   tech: ["Node.js", "Express", "MongoDB", "Stripe"],
  //   link: "https://tripforge-110a0edcf1cc.herokuapp.com/",
  //   github: "https://github.com/williamjaysmith/TripForge",
  //   image: "/Images/Code/tripforge.mp4",
  // },
  // {
  //   title: "Oddbird Portal",
  //   description: "Interactive portal application",
  //   tech: ["React", "TypeScript", "Next.js"],
  //   link: "#",
  //   github: "https://github.com/williamjaysmith",
  //   image: "/Images/Code/OddbirdPortal.mp4",
  // },
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
    description: "This is a complete skeuomorphic GUI/UX design for Strangebad Effects' DSP plugin, Superdope Machine. Crafted to mimick the feel  real-world hardware. I created custom interactive assets including buttons, knobs, sliders, switches, and LEDs - each responding dynamically to user input, to make complex controls intuitive and predictable.<br><br>By mimicking familiar hardware, the interface reduces users cognitive load, streamlines workflow within the DAW, and helps musicians and producers focus on making music rather than learning new software controls.",
    tech: ["Photoshop", "True Grit"],
    link: "https://strangebadeffects.com",
    github: "#",
    image: "/Images/Design/fuzzpedal.jpg",
    modalImage: "/Images/Design/fuzzpedal.jpg",
  },
  {
    title: "Brand Design",
    description: "This was a brand development project for Oktavamod (Michael Joly), a company specializing in transforming affordable microphones into professional-grade recording tools.<br><br>Oktavamod's original branding felt cold and digital, failing to capture the warm, rich character of their microphones. I developed a visual identity that reflects their sound - balancing vintage warmth with modern clarity. The result is a cohesive brand that helps Oktavamod connect with musicians and producers, making their affordable microphones feel like premium tools.",
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

export const audioTracks: Record<string, AudioTrack[]> = {
  "Rock": [
     {
      artist: "Go Crash Audio ",
      genre: "Pop Rock",
      provenance: [ "Engineering","Editing","Mixing", "Mastering"],
      audioSrc: "/audio/rock/Go Crash Audio.mp3",
    },
    {
      artist: "Andy Holley",
      genre: "Blues Rock",
      provenance: ["Engineering, Editing , Mixing, Mastering, Drums and Bass"],
      audioSrc: "/audio/rock/Andy Holley.mp3",
    },
     {
      artist: "Direct Hit",
      genre: "Pop Rock",
      provenance: ["Engineering, Mastering"],
      audioSrc: "/audio/rock/Direct Hit.mp3",
    },
  
  ],
  "Rap/Pop": [
    {
      artist: "Charlie Goldplated",
      genre: "Rnb/Pop",
      provenance: ["Tracking","Mixing", "Mastering"],
      audioSrc: "/audio/rap/Charlie Goldplated.mp3",
    },
    {
      artist: "Big Caption",
      genre: "Hip Hop",
      provenance: ["Engineering", "Mixing", "Mastering"],
      audioSrc: "/audio/rap/Big Caption.mp3",
    },
   
  ],
  "Punk/Metal": [
    {
      artist: "Skyhammer",
      genre: "Metal",
      provenance: ["Engineering", "Editing", "Mixing", "Mastering"],
      audioSrc: "/audio/punk/Skyhammer.mp3",
    },
    {
      artist: "Steel Iron",
      genre: "Speed Metal",
      provenance: ["Editing", "Mastering"],
      audioSrc: "/audio/punk/Steel Iron.mp3",
    },
    {
      artist: "Lowlives",
      genre: "Punk",
      provenance: ["Engineering", "Editing", "Mixing","Mastering"],
      audioSrc: "/audio/punk/Lowlives.mp3",
    },
  ],
  "Acoustic": [
    {
      artist: "Kevn Kinney",
      genre: "Acoustic",
      provenance: ["Tracking","Mixing", "Mastering"],
      audioSrc: "/audio/acoustic/Kevn Kinney.mp3",
    },
     {
      artist: "The Scarring Party",
      genre: "Steampunk",
      provenance: ["Tracking","Editing", "Mixing","Mastering"],
      audioSrc: "/audio/acoustic/Scarring Party.mp3",
    },
    {
      artist: "Patty Kinney",
      genre: "Worship",
      provenance: ["Engineering", "Mixing", "Mastering", "Cello"],
      audioSrc: "/audio/acoustic/Patty Kinney.mp3",
    },
  ],
};
