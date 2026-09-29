/**
 * LeewayThemeContext
 * Provides a global theme context for the WhatsApp chatbot admin panel
 * matching the design of https://leewaysoftech.com/
 */

import React, { createContext, useContext, useMemo } from 'react';
import { leewayColors, leewayTypography, leewaySpacing, leewayBorder, leewayShadow, cn } from '../styles/theme';

// ============================================================================
// Theme Type Definition
// ============================================================================

interface LeewayThemeProps {
  colors: typeof leewayColors;
  typography: typeof leewayTypography;
  spacing: typeof leewaySpacing;
  border: typeof leewayBorder;
  shadow: typeof leewayShadow;
}

interface LeewayThemeContextType extends LeewayThemeProps {
  // Add any theme functions here
  getStatusColor: (status: string) => string;
  getVariantColor: (variant: string) => string;
}

// ============================================================================
// Default Theme
// ============================================================================

const defaultTheme: LeewayThemeContextType = {
  colors: leewayColors,
  typography: leewayTypography,
  spacing: leewaySpacing,
  border: leewayBorder,
  shadow: leewayShadow,
  
  // Status color mapping
  getStatusColor: (status: string): string => {
    const statusMap: Record<string, string> = {
      active: leewayColors.secondary[500],
      inactive: leewayColors.accent.gray,
      pending: '#f59e0b',
      completed: leewayColors.secondary[500],
      failed: leewayColors.accent.red,
      processing: leewayColors.primary[500],
      cancelled: leewayColors.accent.gray,
      success: leewayColors.secondary[500],
      warning: '#f59e0b',
      error: leewayColors.accent.red,
      info: leewayColors.primary[500],
    };
    return statusMap[status.toLowerCase()] || leewayColors.accent.gray;
  },
  
  // Variant color mapping
  getVariantColor: (variant: string): string => {
    const variantMap: Record<string, string> = {
      primary: leewayColors.primary[500],
      secondary: leewayColors.secondary[500],
      success: leewayColors.secondary[500],
      warning: '#f59e0b',
      danger: leewayColors.accent.red,
      info: leewayColors.primary[500],
      ghost: 'transparent',
      outline: leewayColors.primary[500],
    };
    return variantMap[variant.toLowerCase()] || leewayColors.primary[500];
  },
};

// ============================================================================
// Context Creation
// ============================================================================

const LeewayThemeContext = createContext<LeewayThemeContextType>(defaultTheme);

// ============================================================================
// Theme Provider Component
// ============================================================================

interface LeewayThemeProviderProps {
  children: React.ReactNode;
}

export function LeewayThemeProvider({ children }: LeewayThemeProviderProps) {
  const theme = useMemo(() => defaultTheme, []);
  
  return (
    <LeewayThemeContext.Provider value={theme}>
      {children}
    </LeewayThemeContext.Provider>
  );
}

// ============================================================================
// Custom Hook
// ============================================================================

export function useLeewayTheme() {
  const context = useContext(LeewayThemeContext);
  
  if (context === undefined) {
    throw new Error('useLeewayTheme must be used within a LeewayThemeProvider');
  }
  
  return context;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get text color based on background color (for contrast)
 */
export function getContrastColor(backgroundColor: string): string {
  // List of light colors that need dark text
  const lightColors = [
    leewayColors.accent.white,
    leewayColors.primary[50],
    leewayColors.primary[100],
    leewayColors.secondary[50],
    leewayColors.accent.green,
    leewayColors.accent.lightGray,
  ];
  
  return lightColors.includes(backgroundColor) ? '#000000' : '#FFFFFF';
}

/**
 * Get background color based on status
 */
export function getStatusBgColor(status: string): string {
  const statusMap: Record<string, string> = {
    active: 'rgba(19, 156, 50, 0.1)',
    inactive: 'rgba(0, 0, 0, 0.05)',
    pending: 'rgba(245, 158, 11, 0.1)',
    completed: 'rgba(19, 156, 50, 0.1)',
    failed: 'rgba(227, 30, 37, 0.1)',
    processing: 'rgba(19, 76, 188, 0.1)',
    cancelled: 'rgba(0, 0, 0, 0.05)',
    success: 'rgba(19, 156, 50, 0.1)',
    warning: 'rgba(245, 158, 11, 0.1)',
    error: 'rgba(227, 30, 37, 0.1)',
    info: 'rgba(19, 76, 188, 0.1)',
  };
  
  return statusMap[status.toLowerCase()] || 'rgba(0, 0, 0, 0.05)';
}

// ============================================================================
// Styled Components
// ============================================================================

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export const LeewayButton: React.FC<ButtonProps> = ({
  children,
  className = '',
  variant = 'primary',
  size = 'md',
  ...props
}) => {
  const { colors } = useLeewayTheme();
  
  const baseClasses = 'font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 rounded-md inline-flex items-center justify-center gap-2';
  
  const variantClasses = {
    primary: 'bg-primary-500 text-white hover:bg-primary-600 focus:ring-primary-500',
    secondary: 'bg-secondary-500 text-white hover:bg-secondary-600 focus:ring-secondary-500',
    outline: 'border-2 border-primary-500 text-primary-500 hover:bg-primary-50 focus:ring-primary-500',
    ghost: 'text-gray-600 hover:bg-primary-50 hover:text-primary-500',
    danger: 'bg-red-500 text-white hover:bg-red-600 focus:ring-red-500',
  };
  
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };
  
  return (
    <button
      className={cn(baseClasses, variantClasses[variant], sizeClasses[size], className)}
      {...props}
    >
      {children}
    </button>
  );
};

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverEffect?: boolean;
}

export const LeewayCard: React.FC<CardProps> = ({
  children,
  className = '',
  hoverEffect = true,
  ...props
}) => {
  const baseClasses = 'bg-white rounded-lg p-6';
  const shadowClasses = hoverEffect 
    ? 'shadow-leeway-sm hover:shadow-leeway-md transition-all duration-200' 
    : 'shadow-leeway-sm';
  
  return (
    <div className={cn(baseClasses, shadowClasses, className)} {...props}>
      {children}
    </div>
  );
};

export default LeewayThemeProvider;
