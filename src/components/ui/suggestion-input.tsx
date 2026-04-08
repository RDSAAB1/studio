"use client";

import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { Input } from "./input";
import { cn } from "@/lib/utils";
import { ScrollArea } from "./scroll-area";
import { createPortal } from "react-dom";

interface SuggestionInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    suggestions: string[];
    onSuggestionSelect?: (value: string) => void;
    suggestionClassName?: string;
    transformValue?: (value: string) => string;
}

export const SuggestionInput = React.forwardRef<HTMLInputElement, SuggestionInputProps>(
    ({ className, suggestions, onSuggestionSelect, value, onChange, onBlur, transformValue, ...props }, ref) => {
        const [isOpen, setIsOpen] = useState(false);
        const [highlightedIndex, setHighlightedIndex] = useState(-1);
        const inputRef = useRef<HTMLInputElement | null>(null);
        const dropdownRef = useRef<HTMLDivElement>(null);

        // Sync local ref with forwarded ref
        React.useImperativeHandle(ref, () => inputRef.current!);

        const filteredSuggestions = useMemo(() => {
            const term = (String(value || '')).toLowerCase().trim();
            if (!term) return suggestions.slice(0, 10); // Show recent if empty
            return suggestions
                .filter(s => s.toLowerCase().includes(term) && s.toLowerCase() !== term)
                .slice(0, 10);
        }, [suggestions, value]);

        // Direct DOM update for position to ensure perfectly smooth scrolling
        const updatePosition = useCallback(() => {
            if (inputRef.current && dropdownRef.current) {
                const rect = inputRef.current.getBoundingClientRect();
                const viewportHeight = window.innerHeight;
                const dropdownHeight = dropdownRef.current.offsetHeight || 200;
                const spaceBelow = viewportHeight - rect.bottom;
                const openAbove = spaceBelow < dropdownHeight && rect.top > spaceBelow;

                const top = openAbove ? rect.top - dropdownHeight - 4 : rect.bottom + 4;
                
                dropdownRef.current.style.top = `${top}px`;
                dropdownRef.current.style.left = `${rect.left}px`;
                dropdownRef.current.style.width = `${rect.width}px`;
            }
        }, []);

        useEffect(() => {
            if (isOpen) {
                updatePosition();
                // Use capture: true for scroll events to catch all scrolling containers
                window.addEventListener('scroll', updatePosition, true);
                window.addEventListener('resize', updatePosition);
                
                // Also update on a fast loop if needed, but scroll events are usually enough
                const interval = setInterval(updatePosition, 100);
                return () => {
                    window.removeEventListener('scroll', updatePosition, true);
                    window.removeEventListener('resize', updatePosition);
                    clearInterval(interval);
                };
            }
        }, [isOpen, updatePosition]);

        const handleSelect = (s: string) => {
            const transformed = transformValue ? transformValue(s) : s;
            if (onSuggestionSelect) {
                onSuggestionSelect(transformed);
            } else if (onChange) {
                // Synthetic change event
                const event = {
                    target: { value: transformed },
                    currentTarget: { value: transformed }
                } as React.ChangeEvent<HTMLInputElement>;
                onChange(event);
            }
            setIsOpen(false);
        };

        return (
            <div className="relative w-full">
                <Input
                    {...props}
                    ref={inputRef}
                    value={value}
                    onChange={(e) => {
                        if (transformValue) {
                            e.target.value = transformValue(e.target.value);
                        }
                        onChange?.(e);
                        setIsOpen(true);
                        setHighlightedIndex(-1);
                    }}
                    onFocus={(e) => {
                        props.onFocus?.(e);
                        setIsOpen(true);
                        // Brief delay ensures the element is in the DOM before we position it
                        setTimeout(updatePosition, 0);
                    }}
                    onBlur={(e) => {
                        // Delay to allow clicking a suggestion
                        setTimeout(() => {
                            setIsOpen(false);
                            onBlur?.(e);
                        }, 200);
                    }}
                    onKeyDown={(e) => {
                        if (!isOpen) {
                            if (e.key === "ArrowDown") setIsOpen(true);
                            return;
                        }

                        if (e.key === "ArrowDown") {
                            e.preventDefault();
                            setHighlightedIndex(prev => (prev < filteredSuggestions.length - 1 ? prev + 1 : prev));
                        } else if (e.key === "ArrowUp") {
                            e.preventDefault();
                            setHighlightedIndex(prev => (prev > 0 ? prev - 1 : -1));
                        } else if (e.key === "Enter" && isOpen && filteredSuggestions.length > 0) {
                            e.preventDefault();
                            const indexToSelect = highlightedIndex >= 0 ? highlightedIndex : 0;
                            handleSelect(filteredSuggestions[indexToSelect]);
                        } else if (e.key === "Escape") {
                            setIsOpen(false);
                        }
                        props.onKeyDown?.(e);
                    }}
                    className={cn(className)}
                    autoComplete="off"
                />

                {isOpen && filteredSuggestions.length > 0 && typeof document !== 'undefined' && createPortal(
                    <div 
                        ref={dropdownRef}
                        className="fixed z-[10000] bg-popover border border-border rounded shadow-xl overflow-hidden overflow-y-auto max-h-[250px]"
                        style={{
                            // Initial dummy position, will be updated by updatePosition()
                            top: 0,
                            left: 0,
                            width: 0,
                            pointerEvents: 'auto'
                        }}
                    >
                        <ul className="py-1">
                            {filteredSuggestions.map((s, i) => (
                                <li
                                    key={i}
                                    className={cn(
                                        "px-3 py-1.5 text-xs cursor-pointer transition-colors",
                                        highlightedIndex === i ? "bg-accent text-accent-foreground" : "hover:bg-muted"
                                    )}
                                    onMouseDown={(e) => {
                                        // Use onMouseDown to prevent blur before selection
                                        e.preventDefault(); 
                                        handleSelect(s);
                                    }}
                                >
                                    {s}
                                </li>
                            ))}
                        </ul>
                    </div>,
                    document.body
                )}
            </div>
        );
    }
);

SuggestionInput.displayName = "SuggestionInput";
