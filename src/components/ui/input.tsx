
import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, onKeyDown, onChange, value, ...props }, ref) => {
    const isNumericField = type === "number" || type === "tel";
    
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      // ... (rest of handleKeyDown same as before)
      const input = e.currentTarget;
      const currentValue = input.value;
      
      if (isNumericField && currentValue) {
        const key = e.key.toUpperCase();
        if ((key === 'L' || key === 'T' || key === 'H' || key === 'C' || key === 'K' || key === 'M' || key === 'B') && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          const numericValue = parseFloat(currentValue.replace(/[^\d.-]/g, ''));
          if (!isNaN(numericValue) && numericValue !== 0) {
            let multiplier = 1;
            switch (key) {
              case 'H': multiplier = 100; break;
              case 'T': multiplier = 1000; break;
              case 'L': multiplier = 100000; break;
              case 'C': multiplier = 10000000; break;
              case 'K': multiplier = 10000; break;
              case 'M': multiplier = 1000000; break;
              case 'B': multiplier = 100000000; break;
            }
            const result = numericValue * multiplier;
            const resultString = result.toString();
            const syntheticEvent = { ...e, target: { ...input, value: resultString }, currentTarget: { ...input, value: resultString } } as React.ChangeEvent<HTMLInputElement>;
            input.value = resultString;
            if (onChange) onChange(syntheticEvent);
            const inputEvent = new Event('input', { bubbles: true }); input.dispatchEvent(inputEvent);
            const changeEvent = new Event('change', { bubbles: true }); input.dispatchEvent(changeEvent);
            return;
          }
        }
      }
      if (onKeyDown) onKeyDown(e);
    };

    const [isFocused, setIsFocused] = React.useState(false);

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true);
      
      // Force clear if value is 0 on focus
      if (isNumericField && (e.target.value === "0" || Number(e.target.value) === 0) && e.target.value !== "") {
        const input = e.currentTarget;
        input.value = "";
        
        // Trigger onChange for both controlled and uncontrolled components (like react-hook-form)
        if (onChange) {
          const syntheticEvent = {
            ...e,
            target: input,
            currentTarget: input,
            type: "change"
          } as unknown as React.ChangeEvent<HTMLInputElement>;
          onChange(syntheticEvent);
        }
      }
      
      if (props.onFocus) props.onFocus(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false);
      
      // Restore 0 if empty on blur
      if (isNumericField && e.target.value === "") {
        const input = e.currentTarget;
        input.value = "0";
        
        if (onChange) {
          const syntheticEvent = {
            ...e,
            target: input,
            currentTarget: input,
            type: "change"
          } as unknown as React.ChangeEvent<HTMLInputElement>;
          onChange(syntheticEvent);
        }
      }
      
      if (props.onBlur) props.onBlur(e);
    };

    // Calculate display value for controlled components
    let valueToDisplay = value;
    if (isFocused && isNumericField && valueToDisplay !== undefined && valueToDisplay !== null && valueToDisplay !== "" && Number(valueToDisplay) === 0) {
      valueToDisplay = "";
    }

    return (
      <input
        {...props}
        type={type}
        className={cn(
          "ui-field flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-0 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        onKeyDown={handleKeyDown}
        onChange={onChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        value={valueToDisplay}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
