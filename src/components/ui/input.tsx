
import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, onKeyDown, onChange, ...props }, ref) => {
    const isNumericField = type === "number" || type === "tel";
    
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      const input = e.currentTarget;
      const currentValue = input.value;
      
      // Handle Indian numbering shortcuts for numeric fields
      if (isNumericField && currentValue) {
        const key = e.key.toUpperCase();
        
        // Check if user pressed L, T, H, C, K, M, or B
        if (key === 'L' || key === 'T' || key === 'H' || key === 'C' || key === 'K' || key === 'M' || key === 'B') {
          e.preventDefault();
          
          // Get the numeric value (remove any non-numeric characters except decimal point and minus)
          const numericValue = parseFloat(currentValue.replace(/[^\d.-]/g, ''));
          
          if (!isNaN(numericValue) && numericValue !== 0) {
            let multiplier = 1;
            
            switch (key) {
              case 'H': // Hundred (100)
                multiplier = 100;
                break;
              case 'T': // Thousand (1000)
                multiplier = 1000;
                break;
              case 'L': // Lakh (100000)
                multiplier = 100000;
                break;
              case 'C': // Crore (10000000)
                multiplier = 10000000;
                break;
              case 'K': // 50 Thousand (10000)
                multiplier = 10000;
                break;
              case 'M': // 50 Lakh (1000000)
                multiplier = 1000000;
                break;
              case 'B': // 50 Crore (100000000)
                multiplier = 100000000;
                break;
            }
            
            const result = numericValue * multiplier;
            const resultString = result.toString();
            
            // Create a synthetic event to update the value
            const syntheticEvent = {
              ...e,
              target: { ...input, value: resultString },
              currentTarget: { ...input, value: resultString }
            } as React.ChangeEvent<HTMLInputElement>;
            
            // Update the input value directly first
            input.value = resultString;
            
            // Call onChange if provided (for controlled components)
            if (onChange) {
              onChange(syntheticEvent);
            }
            
            // Trigger input event for form libraries like react-hook-form
            const inputEvent = new Event('input', { bubbles: true });
            input.dispatchEvent(inputEvent);
            
            // Trigger change event as well
            const changeEvent = new Event('change', { bubbles: true });
            input.dispatchEvent(changeEvent);
            
            return;
          }
        }
      }
      
      // Call original onKeyDown if provided
      if (onKeyDown) {
        onKeyDown(e);
      }
    };

    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        onKeyDown={handleKeyDown}
        onChange={onChange}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
