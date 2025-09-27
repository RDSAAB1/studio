
"use client";

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ChevronDown, ChevronUp, X, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from './input';

export interface CustomDropdownOption {
    value: string;
    label: string;
}

interface CustomDropdownProps {
    options: CustomDropdownOption[];
    value: string | null;
    onChange: (value: string | null) => void;
    placeholder?: string;
    searchPlaceholder?: string;
    noItemsPlaceholder?: string;
    onAdd?: (newItem: string) => void;
}

export const CustomDropdown: React.FC<CustomDropdownProps> = ({
    options,
    value,
    onChange,
    placeholder = 'Select an item...',
    searchPlaceholder = 'Search items...',
    noItemsPlaceholder = 'No item found.',
    onAdd,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const selectedItem = useMemo(() => options.find(option => option.value === value), [options, value]);

    useEffect(() => {
        // When the `value` prop changes from outside, update the searchTerm to reflect the new selection's label.
        setSearchTerm(selectedItem?.label || (value || ''));
    }, [value, selectedItem]);
    
    const filteredItems = useMemo(() => {
        if (!searchTerm || searchTerm === selectedItem?.label) {
            return options;
        }
        return options.filter(item =>
            item.label.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [searchTerm, options, selectedItem]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                 // If there's a selected item, revert input text to its label. Otherwise, clear it.
                setSearchTerm(selectedItem?.label || '');
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [selectedItem]);

    const handleSelect = (item: CustomDropdownOption) => {
        onChange(item.value);
        setSearchTerm(item.label);
        setIsOpen(false);
    };
    
    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange(null);
        setSearchTerm('');
        setIsOpen(true);
        inputRef.current?.focus();
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newSearchTerm = e.target.value;
        setSearchTerm(newSearchTerm);
        // We call onChange with the raw input value so the parent form state is updated in real-time
        onChange(newSearchTerm);
        if(!isOpen) {
            setIsOpen(true);
        }
    };
    
    const handleInputClick = () => {
        if (!isOpen) {
           setIsOpen(true);
        }
    };
    
    const handleInputBlur = () => {
        // Delay closing to allow click on options
        setTimeout(() => {
            if (!dropdownRef.current?.contains(document.activeElement)) {
                setIsOpen(false);
                // On blur, if no item is selected, but there's a search term, treat it as a new entry.
                // Otherwise, revert to the selected item's label or clear.
                if (onAdd && searchTerm && !options.some(opt => opt.label.toLowerCase() === searchTerm.toLowerCase())) {
                    onAdd(searchTerm);
                } else if (selectedItem) {
                    setSearchTerm(selectedItem.label);
                } else {
                    setSearchTerm('');
                }
            }
        }, 150);
    };

    const handleAddNew = () => {
        if (onAdd && searchTerm && !filteredItems.some(item => item.label.toLowerCase() === searchTerm.toLowerCase())) {
            onAdd(searchTerm);
            setIsOpen(false);
        }
    }

    return (
        <div className="relative w-full" ref={dropdownRef}>
            <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                    ref={inputRef}
                    type="text"
                    placeholder={placeholder}
                    value={searchTerm}
                    onChange={handleInputChange}
                    onClick={handleInputClick}
                    onFocus={handleInputClick}
                    onBlur={handleInputBlur}
                    className="w-full pl-8 pr-8 h-8 text-sm"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center space-x-1">
                    {value && (
                        <button type="button" onClick={handleClear} className="p-0.5 focus:outline-none rounded-full hover:bg-muted">
                            <X className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => setIsOpen(!isOpen)}
                        className="p-0.5 focus:outline-none"
                    >
                        {isOpen ? (
                            <ChevronUp className="w-4 h-4 text-muted-foreground" />
                        ) : (
                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        )}
                    </button>
                </div>
            </div>

            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg">
                    <ul className="py-1 max-h-60 overflow-y-auto scrollbar-hide">
                        {filteredItems.length > 0 ? (
                            filteredItems.map((item, index) => (
                                <li
                                    key={`${item.value}-${index}`}
                                    onClick={() => handleSelect(item)}
                                    className={cn(
                                        "cursor-pointer px-4 py-2 text-sm hover:bg-accent",
                                        selectedItem?.value === item.value ? 'bg-accent font-medium' : ''
                                    )}
                                >
                                    {item.label}
                                </li>
                            ))
                        ) : (
                             !onAdd && <li className="px-4 py-2 text-sm text-muted-foreground text-center">{noItemsPlaceholder}</li>
                        )}
                         {onAdd && searchTerm && !filteredItems.some(item => item.label.toLowerCase() === searchTerm.toLowerCase()) && (
                            <li
                                onClick={handleAddNew}
                                className="cursor-pointer px-4 py-2 text-sm hover:bg-accent text-primary font-medium"
                            >
                                Add "{searchTerm}"
                            </li>
                        )}
                    </ul>
                </div>
            )}
        </div>
    );
};
