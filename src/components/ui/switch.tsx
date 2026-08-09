
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
  
  React.useImperativeHandle(ref, () => rootRef.current as any);
  
  // Force update thumb position using direct DOM manipulation
  const updateThumbPosition = React.useCallback(() => {
    const root = rootRef.current;
    const thumb = thumbRef.current;
    
    if (!root || !thumb) return;
    
    const isChecked = root.getAttribute('data-state') === 'checked';
    const translateX = isChecked ? 36 : 0;
    
    // Read Group 5 CSS variables dynamically
    const activeBg = getComputedStyle(document.documentElement).getPropertyValue('--toggle-active-bg').trim() || '#d97706';
    const inactiveBg = getComputedStyle(document.documentElement).getPropertyValue('--toggle-inactive-bg').trim() || '#e2e8f0';

    // Set root styling dynamically from Group 5 Variables
    root.style.setProperty('background-color', isChecked ? 'var(--toggle-active-bg, #d97706)' : 'var(--toggle-inactive-bg, #e2e8f0)', 'important');
    root.style.boxShadow = isChecked 
      ? `0 3px 10px ${activeBg}45, inset 0 2px 4px rgba(0,0,0,0.25), inset 0 -1px 0 rgba(255,255,255,0.3)` 
      : 'inset 0 2px 4px rgba(0,0,0,0.12), inset 0 -1px 0 rgba(255,255,255,0.8)';

    // Update ON / OFF text visibility & opacity dynamically
    const onLabel = root.querySelector('.switch-label-on') as HTMLElement;
    const offLabel = root.querySelector('.switch-label-off') as HTMLElement;
    if (onLabel) {
      onLabel.style.color = 'var(--toggle-active-text, #ffffff)';
      onLabel.style.opacity = isChecked ? '1' : '0';
      onLabel.style.transform = isChecked ? 'scale(1)' : 'scale(0.7)';
      onLabel.style.transition = 'all 0.2s ease';
    }
    if (offLabel) {
      offLabel.style.color = 'var(--toggle-inactive-text, #475569)';
      offLabel.style.opacity = isChecked ? '0' : '1';
      offLabel.style.transform = isChecked ? 'scale(0.7)' : 'scale(1)';
      offLabel.style.transition = 'all 0.2s ease';
    }

    // Set 3D Floating Glass Knob with Inner Metallic Ring & Dot Indicator
    thumb.style.position = 'absolute';
    thumb.style.left = '2px';
    thumb.style.top = '2px';
    thumb.style.width = '26px';
    thumb.style.height = '26px';
    thumb.style.borderRadius = '50%';
    thumb.style.backgroundImage = 'radial-gradient(circle at 35% 35%, #ffffff 0%, #f8fafc 70%, #e2e8f0 100%)';
    thumb.style.boxShadow = '0 3px 8px rgba(0, 0, 0, 0.25), inset 0 1.5px 0 #ffffff, inset 0 -2px 3px rgba(0,0,0,0.15)';
    thumb.style.pointerEvents = 'none';
    thumb.style.transition = 'transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)';
    thumb.style.willChange = 'transform';
    thumb.style.transform = `translateX(${translateX}px)`;
    thumb.style.webkitTransform = `translateX(${translateX}px)`;

    // Inner Dot Indicator inside knob
    thumb.innerHTML = `<span style="display:block; width:8px; height:8px; margin:9px auto; border-radius:50%; background:${isChecked ? activeBg : '#94a3b8'}; box-shadow: inset 0 1px 1px rgba(0,0,0,0.3), 0 0 5px ${isChecked ? activeBg : 'transparent'};"></span>`;
    
    // Force reflow
    thumb.offsetHeight;
  }, []);
  
  React.useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    
    updateThumbPosition();
    
    const observer = new MutationObserver(() => {
      updateThumbPosition();
    });
    
    observer.observe(root, {
      attributes: true,
      attributeFilter: ['data-state']
    });
    
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
      ref={rootRef as unknown as React.Ref<HTMLButtonElement>}
      className={cn(
        "peer inline-flex h-8 w-[68px] shrink-0 cursor-pointer items-center rounded-full border border-slate-300/60 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 relative overflow-hidden shadow-xs",
        className
      )}
      {...props}
    >
      {/* Dynamic Background Track Text Labels (ON visible when ON, OFF visible when OFF) */}
      <span className="switch-label-on absolute left-3 text-[9px] font-black uppercase tracking-wider pointer-events-none select-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)] opacity-0" style={{ color: 'var(--toggle-active-text, #ffffff)' }}>ON</span>
      <span className="switch-label-off absolute right-3 text-[9px] font-black uppercase tracking-wider pointer-events-none select-none drop-shadow-none opacity-1" style={{ color: 'var(--toggle-inactive-text, #475569)' }}>OFF</span>

      <SwitchPrimitives.Thumb
        ref={thumbRef}
        className={cn(
          "pointer-events-none block rounded-full absolute left-0.5 top-0.5 z-10"
        )}
      />
    </SwitchPrimitives.Root>
  )
})
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
