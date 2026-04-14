import { type ReactNode, type InputHTMLAttributes, type TextareaHTMLAttributes, type SelectHTMLAttributes } from 'react';
import { AlertCircle } from 'lucide-react';

interface BaseFieldProps {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  showCharCount?: boolean;
  maxLength?: number;
  currentLength?: number;
}

interface InputFieldProps extends BaseFieldProps, InputHTMLAttributes<HTMLInputElement> {
  type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url';
}

interface TextareaFieldProps extends BaseFieldProps, TextareaHTMLAttributes<HTMLTextAreaElement> {}

interface SelectFieldProps extends BaseFieldProps, SelectHTMLAttributes<HTMLSelectElement> {
  children: ReactNode;
}

const baseInputClasses = `
  w-full px-4 py-2.5 
  bg-white border border-slate-200 rounded-xl
  text-slate-900 placeholder:text-slate-400
  transition-all duration-150
  focus:outline-none focus:ring-2 focus:ring-[#2AA7A0]/20 focus:border-[#2AA7A0]
  hover:border-slate-300
  disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed
`;

const errorInputClasses = `
  border-rose-300 focus:border-rose-500 focus:ring-rose-500/20
`;

export function Input({ label, error, hint, required, showCharCount, maxLength, currentLength, className = '', ...props }: InputFieldProps) {
  return (
    <div className="space-y-2">
      {label && (
        <label className="flex items-center justify-between text-sm font-medium text-slate-700">
          <span>
            {label}
            {required && <span className="text-rose-500 ml-1">*</span>}
          </span>
          {showCharCount && maxLength && (
            <span className={`text-xs font-normal ${(currentLength || 0) > maxLength ? 'text-rose-500' : 'text-slate-400'}`}>
              {currentLength || 0} / {maxLength}
            </span>
          )}
        </label>
      )}
      <input
        className={`${baseInputClasses} ${error ? errorInputClasses : ''} ${className}`}
        maxLength={maxLength}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={error ? `${props.id}-error` : undefined}
        {...props}
      />
      {error && (
        <div id={`${props.id}-error`} className="flex items-start gap-2 text-sm text-rose-600">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {hint && !error && (
        <p className="text-xs text-slate-500">{hint}</p>
      )}
    </div>
  );
}

export function Textarea({ label, error, hint, required, showCharCount, maxLength, currentLength, className = '', rows = 3, ...props }: TextareaFieldProps) {
  return (
    <div className="space-y-2">
      {label && (
        <label className="flex items-center justify-between text-sm font-medium text-slate-700">
          <span>
            {label}
            {required && <span className="text-rose-500 ml-1">*</span>}
          </span>
          {showCharCount && maxLength && (
            <span className={`text-xs font-normal ${(currentLength || 0) > maxLength ? 'text-rose-500' : 'text-slate-400'}`}>
              {currentLength || 0} / {maxLength}
            </span>
          )}
        </label>
      )}
      <textarea
        className={`${baseInputClasses} resize-none ${error ? errorInputClasses : ''} ${className}`}
        rows={rows}
        maxLength={maxLength}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={error ? `${props.id}-error` : undefined}
        {...props}
      />
      {error && (
        <div id={`${props.id}-error`} className="flex items-start gap-2 text-sm text-rose-600">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {hint && !error && (
        <p className="text-xs text-slate-500">{hint}</p>
      )}
    </div>
  );
}

export function Select({ label, error, hint, required, children, className = '', ...props }: SelectFieldProps) {
  return (
    <div className="space-y-2">
      {label && (
        <label className="flex items-center text-sm font-medium text-slate-700">
          {label}
          {required && <span className="text-rose-500 ml-1">*</span>}
        </label>
      )}
      <select
        className={`${baseInputClasses} ${error ? errorInputClasses : ''} cursor-pointer ${className}`}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={error ? `${props.id}-error` : undefined}
        {...props}
      >
        {children}
      </select>
      {error && (
        <div id={`${props.id}-error`} className="flex items-start gap-2 text-sm text-rose-600">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {hint && !error && (
        <p className="text-xs text-slate-500">{hint}</p>
      )}
    </div>
  );
}
