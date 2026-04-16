
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-[8px] text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[0_14px_32px_rgba(15,23,42,0.18),inset_0_1px_0_rgba(255,255,255,0.30)] hover:bg-primary/90 hover:shadow-[0_18px_38px_rgba(15,23,42,0.22),inset_0_1px_0_rgba(255,255,255,0.34)] active:translate-y-[1px] active:shadow-[0_10px_26px_rgba(15,23,42,0.20),inset_0_2px_10px_rgba(15,23,42,0.28)]",
        destructive:
          "bg-destructive text-destructive-foreground shadow-[0_14px_32px_rgba(15,23,42,0.18),inset_0_1px_0_rgba(255,255,255,0.28)] hover:bg-destructive/90 hover:shadow-[0_18px_38px_rgba(15,23,42,0.22),inset_0_1px_0_rgba(255,255,255,0.32)] active:translate-y-[1px] active:shadow-[0_10px_26px_rgba(15,23,42,0.20),inset_0_2px_10px_rgba(15,23,42,0.28)]",
        outline:
          "border border-border bg-card text-foreground shadow-sm hover:bg-muted active:bg-muted/80 active:translate-y-[1px]",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/90 active:translate-y-[1px]",
        ghost: "hover:bg-muted hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3",
        lg: "h-11 px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
