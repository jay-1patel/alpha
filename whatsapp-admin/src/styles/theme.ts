/**
 * Leeway Softech Theme Configuration
 * This file contains the complete theme configuration for the WhatsApp chatbot admin panel
 * matching the design of https://leewaysoftech.com/
 */

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// ============================================================================
// LEeway Softech Color Palette
// ============================================================================

export const leewayColors = {
  // Primary Colors
  primary: {
    50: "rgba(19, 76, 188, 0.05)",   // #134cbc0d
    100: "rgba(19, 76, 188, 0.15)",  // #134cbc26
    500: "#134CBC",                  // Primary blue
    600: "#0F3A8C",                  // Darker blue (hover)
    700: "#0a2d6a",
  },
  
  // Secondary Colors (Green)
  secondary: {
    50: "rgba(19, 156, 50, 0.1)",    // #139c321a
    500: "#139C32",                  // Green accent
    600: "#0f7a25",
  },
  
  // Accent Colors
  accent: {
    green: "#ABDBD1",                // Light green from social icons
    red: "#E31E25",                  // Red from their theme
    white: "#FFFFFF",
    black: "#000000",
    gray: "#666666",
    lightGray: "#f8f9fa",
  },
  
  // Semantic Colors
  success: "#139C32",
  error: "#E31E25",
  warning: "#f59e0b",
  info: "#134CBC",
};

// ============================================================================
// Typography Configuration
// ============================================================================

export const leewayTypography = {
  fontFamily: {
    sans: "'Poppins', 'Inter', sans-serif",
    mono: "'Fira Code', monospace",
  },
  fontSize: {
    xs: "0.75rem",
    sm: "0.875rem",
    base: "0.95rem",
    lg: "1.125rem",
    xl: "1.25rem",
    "2xl": "1.5rem",
    "3xl": "1.875rem",
  },
  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  lineHeight: {
    normal: 1.6,
    tight: 1.4,
    relax: 1.8,
  },
};

// ============================================================================
// Spacing Configuration
// ============================================================================

export const leewaySpacing = {
  xs: "0.25rem",
  sm: "0.5rem",
  md: "1rem",
  lg: "1.5rem",
  xl: "2rem",
  "2xl": "3rem",
};

// ============================================================================
// Border & Radius Configuration
// ============================================================================

export const leewayBorder = {
  radius: {
    sm: "0.375rem",
    md: "0.5rem",
    lg: "0.625rem",
    xl: "0.75rem",
    full: "9999px",
  },
  width: {
    thin: "1px",
    medium: "2px",
    thick: "4px",
  },
};

// ============================================================================
// Shadow Configuration
// ============================================================================

export const leewayShadow = {
  sm: "0 4px 8px rgba(0, 0, 0, 0.1)",
  md: "0 16px 24px 15px rgba(0, 0, 0, 0.05)",
  lg: "0 15px 50px 0 rgba(19, 76, 188, 0.05)",
  blue: "0 16px 24px 15px rgba(19, 76, 188, 0.1)",
  green: "0 16px 24px 15px rgba(1, 145, 67, 0.1)",
};

// ============================================================================
// Transition Configuration
// ============================================================================

export const leewayTransition = {
  fast: "all 0.15s ease",
  normal: "all 0.2s ease",
  slow: "all 0.3s ease",
};

// ============================================================================
// Class Name Helpers
// ============================================================================

/**
 * Combine multiple class names with tailwind-merge for optimal class ordering
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Create a Leeway-themed class string
 */
export function leewayClass(...inputs: (string | undefined)[]): string {
  return cn(
    "font-[Poppins]",
    ...inputs.filter(Boolean)
  );
}

// ============================================================================
// Component Styling Functions
// ============================================================================

/**
 * Button styles with Leeway theme
 */
export function leewayButton(variant: "primary" | "secondary" | "outline" | "ghost" | "danger" = "primary", size: "sm" | "md" | "lg" = "md") {
  const base = "font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 rounded-md inline-flex items-center justify-center gap-2";
  
  const variants = {
    primary: "bg-primary-500 text-white hover:bg-primary-600 focus:ring-primary-500",
    secondary: "bg-secondary-500 text-white hover:bg-secondary-600 focus:ring-secondary-500",
    outline: "border-2 border-primary-500 text-primary-500 hover:bg-primary-50 focus:ring-primary-500",
    ghost: "text-gray-600 hover:bg-primary-50 hover:text-primary-500",
    danger: "bg-red-500 text-white hover:bg-red-600 focus:ring-red-500",
  };
  
  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-base",
    lg: "px-6 py-3 text-lg",
  };
  
  return cn(base, variants[variant], sizes[size]);
}

/**
 * Card styles with Leeway theme
 */
export function leewayCard(hoverEffect: boolean = true) {
  const base = "bg-white rounded-lg p-6";
  const shadow = hoverEffect ? "shadow-leeway-sm hover:shadow-leeway-md" : "shadow-leeway-sm";
  const transition = hoverEffect ? "transition-all duration-200" : "";
  
  return cn(base, shadow, transition);
}

/**
 * Input styles with Leeway theme
 */
export function leewayInput(error: boolean = false) {
  const base = "w-full px-4 py-2 rounded-md border font-medium text-base";
  const border = error ? "border-red-500 focus:ring-red-500" : "border-gray-300 focus:ring-primary-500";
  const focus = "focus:outline-none focus:ring-2 focus:border-transparent";
  
  return cn(base, border, focus);
}

/**
 * Badge styles with Leeway theme
 */
export function leewayBadge(variant: "primary" | "secondary" | "success" | "warning" | "danger" | "info" = "primary") {
  const base = "inline-block px-3 py-1 rounded-full text-xs font-medium";
  
  const variants = {
    primary: "bg-primary-100 text-primary-500",
    secondary: "bg-secondary-50 text-secondary-500",
    success: "bg-green-100 text-green-600",
    warning: "bg-yellow-100 text-yellow-600",
    danger: "bg-red-100 text-red-600",
    info: "bg-blue-100 text-blue-600",
  };
  
  return cn(base, variants[variant]);
}

/**
 * Table styles with Leeway theme
 */
export function leewayTable() {
  return cn(
    "w-full text-left border-collapse",
    "[&_th]:bg-primary-50 [&_th]:text-primary-600 [&_th]:font-semibold [&_th]:p-4",
    "[&_td]:p-4 [&_td]:border-b [&_td]:border-gray-100",
    "[&_tr:hover]:bg-gray-50"
  );
}

// ============================================================================
// Status Colors
// ============================================================================

export const statusColors = {
  active: "bg-green-100 text-green-600",
  inactive: "bg-gray-100 text-gray-600",
  pending: "bg-yellow-100 text-yellow-600",
  completed: "bg-green-100 text-green-600",
  failed: "bg-red-100 text-red-600",
  processing: "bg-blue-100 text-blue-600",
  cancelled: "bg-gray-100 text-gray-600",
};

// ============================================================================
// Export all theme utilities
// ============================================================================

export default {
  colors: leewayColors,
  typography: leewayTypography,
  spacing: leewaySpacing,
  border: leewayBorder,
  shadow: leewayShadow,
  transition: leewayTransition,
  cn,
  leewayClass,
  leewayButton,
  leewayCard,
  leewayInput,
  leewayBadge,
  leewayTable,
  statusColors,
};
