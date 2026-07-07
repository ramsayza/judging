import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// Backend RequirementField.key requires ^[a-z][a-z0-9_]*$ -- underscores, no
// hyphens, must start with a letter. Distinct from slugify() (used for org
// URL slugs, which allow hyphens) since these are two different identifier
// formats.
export function toFieldKey(value: string): string {
  const cleaned = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return /^[a-z]/.test(cleaned) ? cleaned : `f_${cleaned}`;
}
