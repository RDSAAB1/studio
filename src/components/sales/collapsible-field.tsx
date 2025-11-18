"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface CollapsibleFieldProps {
    label: string;
    value: string | number | undefined;
    onChange: (value: string) => void;
    type?: "text" | "number" | "date";
    placeholder?: string;
    icon?: React.ReactNode;
    className?: string;
    displayValue?: string;
    inputClassName?: string;
}

export const CollapsibleField = ({
    label,
    value,
    onChange,
    type = "text",
    placeholder,
    icon,
    className,
    displayValue,
    inputClassName
}: CollapsibleFieldProps) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const handleClick = () => {
        setIsExpanded(!isExpanded);
    };

    const handleBlur = () => {
        // Small delay to allow for clicks
        setTimeout(() => setIsExpanded(false), 200);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" || e.key === "Escape") {
            setIsExpanded(false);
        }
    };

    const display = displayValue || (value !== undefined && value !== '' ? String(value) : '—');

    // If no label, render as inline input
    if (!label || label === '') {
        return (
            <span className="inline-block">
                {!isExpanded ? (
                    <span 
                        className="cursor-pointer text-sm text-foreground hover:text-primary min-w-[60px] inline-block"
                        onClick={handleClick}
                    >
                        {display}
                    </span>
                ) : (
                    <Input
                        type={type}
                        value={value || ''}
                        onChange={(e) => onChange(e.target.value)}
                        onBlur={handleBlur}
                        onKeyDown={handleKeyDown}
                        placeholder={placeholder || 'Enter value'}
                        className={cn("h-6 text-xs inline-block", inputClassName)}
                        style={{ width: '120px' }}
                        autoFocus
                    />
                )}
            </span>
        );
    }

    return (
        <div className={cn("border-b border-border pb-2 mb-2", className)}>
            <div 
                className="flex items-center justify-between cursor-pointer hover:bg-muted/50 rounded px-2 py-1 -mx-2"
                onClick={handleClick}
            >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                    ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                    <Label className="text-xs font-medium text-muted-foreground shrink-0">{label}:</Label>
                    {!isExpanded && (
                        <span className="text-sm text-foreground truncate ml-2">{display}</span>
                    )}
                </div>
                {icon && !isExpanded && (
                    <div className="text-muted-foreground shrink-0 ml-2">{icon}</div>
                )}
            </div>
            {isExpanded && (
                <div className="mt-2 px-2">
                    {icon && (
                        <div className="relative mb-2">
                            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                                {icon}
                            </div>
                            <Input
                                type={type}
                                value={value || ''}
                                onChange={(e) => onChange(e.target.value)}
                                onBlur={handleBlur}
                                onKeyDown={handleKeyDown}
                                placeholder={placeholder || label}
                                className={cn("pl-10 h-8 text-sm", inputClassName)}
                                autoFocus
                            />
                        </div>
                    )}
                    {!icon && (
                        <Input
                            type={type}
                            value={value || ''}
                            onChange={(e) => onChange(e.target.value)}
                            onBlur={handleBlur}
                            onKeyDown={handleKeyDown}
                            placeholder={placeholder || label}
                            className={cn("h-8 text-sm", inputClassName)}
                            autoFocus
                        />
                    )}
                </div>
            )}
        </div>
    );
};

