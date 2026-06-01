'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

type Field = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

const fieldSelector = 'input:not([type="hidden"]):not([type="file"]), textarea, select';

function fieldLabel(field: Field) {
  const form = field.form;
  const explicit = field.id ? form?.querySelector(`label[for="${CSS.escape(field.id)}"]`)?.textContent?.trim() : '';
  const placeholder = field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement ? field.placeholder : '';
  const fallback = field.getAttribute('aria-label') || placeholder || field.name || 'Pole';
  return explicit || fallback;
}

function validationMessage(field: Field) {
  const label = fieldLabel(field);
  const validity = field.validity;
  if (validity.valueMissing) return `${label}: vyplň hodnotu.`;
  if (validity.typeMismatch) return `${label}: zadej platný formát.`;
  if (validity.patternMismatch) return `${label}: hodnota nemá správný formát.`;
  if (validity.rangeUnderflow) return `${label}: hodnota je příliš nízká.`;
  if (validity.rangeOverflow) return `${label}: hodnota je příliš vysoká.`;
  if (validity.stepMismatch) return `${label}: hodnota neodpovídá povolenému kroku.`;
  if (validity.tooShort) return `${label}: hodnota je příliš krátká.`;
  if (validity.tooLong) return `${label}: hodnota je příliš dlouhá.`;
  if (field.validationMessage) return `${label}: ${field.validationMessage}`;
  return `${label}: zkontroluj hodnotu.`;
}

export type ValidatedFormProps = React.FormHTMLAttributes<HTMLFormElement> & {
  showErrorSummary?: boolean;
};

export const ValidatedForm = React.forwardRef<HTMLFormElement, ValidatedFormProps>(
  ({ children, className, onBlur, onChange, onInput, onSubmit, showErrorSummary = true, ...props }, forwardedRef) => {
    const localRef = React.useRef<HTMLFormElement>(null);
    const [errors, setErrors] = React.useState<string[]>([]);

    React.useImperativeHandle(forwardedRef, () => localRef.current as HTMLFormElement);

    const validate = React.useCallback((markAll = false) => {
      const form = localRef.current;
      if (!form) return true;
      const nextErrors: string[] = [];
      const fields = Array.from(form.querySelectorAll<Field>(fieldSelector));
      for (const field of fields) {
        if (field.disabled) continue;
        const hasValue = field.value.trim().length > 0;
        const touched = markAll || field.dataset.touched === 'true' || hasValue;
        if (markAll) field.dataset.touched = 'true';
        const invalid = touched && !field.validity.valid;
        field.setAttribute('aria-invalid', invalid ? 'true' : 'false');
        if (invalid) nextErrors.push(validationMessage(field));
      }
      setErrors(nextErrors);
      return nextErrors.length === 0;
    }, []);

    function markField(event: React.SyntheticEvent<HTMLFormElement>) {
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
        target.dataset.touched = 'true';
      }
    }

    return (
      <form
        {...props}
        className={cn('validated-form', className)}
        ref={localRef}
        onBlur={(event) => {
          markField(event);
          validate();
          onBlur?.(event);
        }}
        onChange={(event) => {
          markField(event);
          validate();
          onChange?.(event);
        }}
        onInput={(event) => {
          markField(event);
          validate();
          onInput?.(event);
        }}
        onSubmit={(event) => {
          const valid = validate(true) && event.currentTarget.checkValidity();
          if (!valid) {
            event.preventDefault();
            event.stopPropagation();
            const firstInvalid = event.currentTarget.querySelector<Field>('[aria-invalid="true"]');
            firstInvalid?.focus({ preventScroll: false });
            return;
          }
          onSubmit?.(event);
        }}
      >
        {children}
        {showErrorSummary && errors.length > 0 && (
          <div className="form-errors" role="alert">
            {errors.slice(0, 3).map((error) => <span key={error}>{error}</span>)}
          </div>
        )}
      </form>
    );
  },
);
ValidatedForm.displayName = 'ValidatedForm';
