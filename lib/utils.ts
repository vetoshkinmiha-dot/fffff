import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Strip HTML tags to prevent stored XSS when rendering user-generated content. */
export function sanitize(value: string): string {
  if (!value) return ""
  return value.replace(/<[^>]*>/g, "").trim()
}
