interface TechBadgeProps {
  tech: string;
}

export default function TechBadge({ tech }: TechBadgeProps) {
  return (
    <span className="bg-brand-dark px-3 py-1 text-sm font-bold text-white border-3 border-[#2c2c2c] rounded-lg">
      {tech}
    </span>
  );
}
