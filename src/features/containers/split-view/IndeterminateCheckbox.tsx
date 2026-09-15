import React, { useRef, useEffect } from "react";

export const IndeterminateCheckbox: React.FC<{
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
  className?: string;
  title?: string;
}> = ({ checked, indeterminate = false, onChange, className = "", title }) => {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return (
    <input
      type="checkbox"
      ref={ref}
      checked={checked}
      onChange={onChange}
      title={title}
      className={`w-3.5 h-3.5 rounded border-border/80 text-primary accent-primary bg-surface/70 hover:bg-surface cursor-pointer shrink-0 transition-all ${className}`}
      onClick={(e) => e.stopPropagation()}
    />
  );
};
