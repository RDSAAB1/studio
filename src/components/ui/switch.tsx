
"use client"

import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => {
  const thumbRef = React.useRef<HTMLSpanElement>(null);
  const rootRef = React.useRef<HTMLButtonElement>(null);
  
  // Force update thumb position using direct DOM manipulation
  const updateThumbPosition = React.useCallback(() => {
    const root = rootRef.current;
    const thumb = thumbRef.current;
    
    if (!root || !thumb) return;
    
    const isChecked = root.getAttribute('data-state') === 'checked';
    const translateX = isChecked ? 20 : 0;
    
    // Set all styles including position
    thumb.style.position = 'absolute';
    thumb.style.left = '2px';
    thumb.style.top = '2px';
    thumb.style.width = '20px';
    thumb.style.height = '20px';
    thumb.style.borderRadius = '50%';
    thumb.style.backgroundColor = '#ffffff';
    thumb.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.4)';
    thumb.style.pointerEvents = 'none';
    thumb.style.transition = 'transform 0.15s ease-out';
    thumb.style.willChange = 'transform';
    thumb.style.transform = `translateX(${translateX}px)`;
    thumb.style.webkitTransform = `translateX(${translateX}px)`;
    
    // Force reflow to ensure styles are applied
    thumb.offsetHeight;
  }, []);
  
  // Watch for state changes
  React.useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    
    // Initial update
    updateThumbPosition();
    
    // Watch for data-state changes
    const observer = new MutationObserver(() => {
      updateThumbPosition();
    });
    
    observer.observe(root, {
      attributes: true,
      attributeFilter: ['data-state']
    });
    
    // Also listen to click events as backup
    const handleClick = () => {
      setTimeout(updateThumbPosition, 0);
    };
    
    root.addEventListener('click', handleClick);
    
    return () => {
      observer.disconnect();
      root.removeEventListener('click', handleClick);
    };
  }, [updateThumbPosition]);

  return (
    <SwitchPrimitives.Root
      ref={(node) => {
        rootRef.current = node;
        if (typeof ref === 'function') {
          ref(node);
        } else if (ref) {
          ref.current = node;
        }
      }}
      className={cn(
        "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted",
        className
      )}
      {...props}
    >
      <SwitchPrimitives.Thumb
        ref={thumbRef}
        className={cn(
          "pointer-events-none block h-5 w-5 rounded-full absolute left-0.5 top-0.5"
        )}
      />
    </SwitchPrimitives.Root>
  )
})
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
