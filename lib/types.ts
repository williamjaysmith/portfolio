import { LucideIcon } from "lucide-react";

export interface CodeProject {
  title: string;
  description: string;
  tech: string[];
  link: string;
  github: string;
  image?: string;
}

export interface DesignProject {
  title: string;
  description: string;
  tech: string[];
  link: string;
  github: string;
  image?: string;
  modalImage?: string;
}

export interface SkillCategory {
  category: string;
  skills: string[];
}

export interface Contact {
  name: string;
  link: string;
  icon: LucideIcon;
}
