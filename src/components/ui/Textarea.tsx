import React from 'react';
import { cn } from '@/lib/utils';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  variant?: 'default' | 'filled' | 'outlined';
  size?: 'sm' | 'md' | 'lg';
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, helperText, variant = 'default', size = 'md', ...props }, ref) => {
    const baseClasses = {
      default: 'border border-gray-300 bg-white !text-gray-900 placeholder-gray-500',
      filled: 'border-0 bg-gray-100 !text-gray-900 placeholder-gray-500',
      outlined: 'border-2 border-gray-300 bg-transparent !text-gray-900 placeholder-gray-500'
    };

    const sizeClasses = {
      sm: 'px-3 py-2 text-sm',
      md: 'px-4 py-3 text-base',
      lg: 'px-5 py-4 text-lg'
    };

    const textareaClasses = cn(
      'w-full rounded-lg transition-all duration-200 resize-vertical',
      'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
      'disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed disabled:resize-none',
      '!text-gray-900 !font-semibold', // Force dark text with !important and stronger weight
      error ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : '',
      baseClasses[variant],
      sizeClasses[size],
      className
    );

    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {label}
            {props.required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
        <textarea
          className={textareaClasses}
          ref={ref}
          {...props}
        />
        {error && (
          <p className="mt-1 text-sm text-red-600">{error}</p>
        )}
        {helperText && !error && (
          <p className="mt-1 text-sm text-gray-500">{helperText}</p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';

export { Textarea };