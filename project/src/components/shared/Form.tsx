import React from 'react';

interface FormFieldProps {
  label: string;
  error?: string;
  required?: boolean;
  helpText?: string;
  className?: string;
  children: React.ReactNode;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  error,
  required,
  helpText,
  className = '',
  children
}) => {
  return (
    <div className={`space-y-1 ${className}`}>
      <label className="block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
      {helpText && !error && (
        <p className="text-sm text-gray-500">{helpText}</p>
      )}
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  );
};

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input: React.FC<InputProps> = ({ error, className = '', ...props }) => {
  return (
    <input
      className={`
        block w-full rounded-lg border-gray-300 shadow-sm
        focus:border-blue-500 focus:ring-blue-500 sm:text-sm
        disabled:bg-gray-50 disabled:text-gray-500
        ${error ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}
        ${className}
      `}
      {...props}
    />
  );
};

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const TextArea: React.FC<TextAreaProps> = ({ error, className = '', ...props }) => {
  return (
    <textarea
      className={`
        block w-full rounded-lg border-gray-300 shadow-sm
        focus:border-blue-500 focus:ring-blue-500 sm:text-sm
        disabled:bg-gray-50 disabled:text-gray-500
        ${error ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}
        ${className}
      `}
      {...props}
    />
  );
};

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
  options: Array<{ value: string; label: string }>;
}

export const Select: React.FC<SelectProps> = ({ error, options, className = '', ...props }) => {
  return (
    <select
      className={`
        block w-full rounded-lg border-gray-300 shadow-sm
        focus:border-blue-500 focus:ring-blue-500 sm:text-sm
        disabled:bg-gray-50 disabled:text-gray-500
        ${error ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}
        ${className}
      `}
      {...props}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
};

interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  error?: boolean;
}

export const Checkbox: React.FC<CheckboxProps> = ({ label, error, className = '', ...props }) => {
  return (
    <label className={`inline-flex items-center ${className}`}>
      <input
        type="checkbox"
        className={`
          rounded border-gray-300 text-blue-600
          focus:ring-blue-500 disabled:opacity-50
          ${error ? 'border-red-300' : ''}
        `}
        {...props}
      />
      <span className="ml-2 text-sm text-gray-900">{label}</span>
    </label>
  );
};

interface RadioGroupProps {
  name: string;
  options: Array<{ value: string; label: string }>;
  value?: string;
  onChange?: (value: string) => void;
  error?: boolean;
  className?: string;
}

export const RadioGroup: React.FC<RadioGroupProps> = ({
  name,
  options,
  value,
  onChange,
  error,
  className = ''
}) => {
  return (
    <div className={`space-y-2 ${className}`}>
      {options.map((option) => (
        <label key={option.value} className="inline-flex items-center">
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={(e) => onChange?.(e.target.value)}
            className={`
              border-gray-300 text-blue-600
              focus:ring-blue-500 disabled:opacity-50
              ${error ? 'border-red-300' : ''}
            `}
          />
          <span className="ml-2 text-sm text-gray-900">{option.label}</span>
        </label>
      ))}
    </div>
  );
};