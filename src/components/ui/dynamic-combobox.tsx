
"use client";

import * as React from "react";
import { Check, ChevronsUpDown, PlusCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toTitleCase } from "@/lib/utils";

export type ComboboxOption = {
  value: string;
  label: string;
};

interface DynamicComboboxProps {
  options: ComboboxOption[];
  value?: string;
  onChange: (value: string) => void;
  onAdd?: (inputValue: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyPlaceholder?: string;
  onIconClick?: () => void;
}

export function DynamicCombobox({
  options,
  value,
  onChange,
  onAdd,
  placeholder = "Select an option",
  searchPlaceholder = "Search...",
  emptyPlaceholder = "No options found.",
  onIconClick
}: DynamicComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState("");

  const selectedOption = options.find(
    (option) => option.value.toLowerCase() === value?.toLowerCase()
  );

  const handleAddNew = () => {
    if (onAdd && inputValue) {
      onAdd(inputValue);
      setInputValue("");
      setOpen(false);
    }
  };

  const filteredOptions = options.filter(option => 
    option.label.toLowerCase().includes(inputValue.toLowerCase())
  );
  
  const showAddNew = onAdd && inputValue && !filteredOptions.some(opt => opt.label.toLowerCase() === inputValue.toLowerCase());

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="relative">
        <PopoverTrigger asChild>
            <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-start h-8 text-sm font-normal pr-10"
            >
            {selectedOption ? toTitleCase(selectedOption.label) : placeholder}
            </Button>
        </PopoverTrigger>
         {onIconClick && (
            <Button
                variant="ghost"
                size="icon"
                onClick={onIconClick}
                className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
            >
                <PlusCircle className="h-4 w-4 shrink-0 opacity-50" />
            </Button>
        )}
      </div>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0 z-[51]">
        <Command>
          <CommandInput
            placeholder={searchPlaceholder}
            value={inputValue}
            onValueChange={setInputValue}
          />
          <CommandList>
            {filteredOptions.length === 0 && !showAddNew && (
                <CommandEmpty>{emptyPlaceholder}</CommandEmpty>
            )}
             <CommandGroup>
              {filteredOptions.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={() => {
                    onChange(option.value);
                    setInputValue("");
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedOption && selectedOption.value.toLowerCase() === option.value.toLowerCase()
                        ? "opacity-100"
                        : "opacity-0"
                    )}
                  />
                  {toTitleCase(option.label)}
                </CommandItem>
              ))}
               {showAddNew && (
                <CommandItem
                  onSelect={handleAddNew}
                  className="text-primary hover:!bg-primary/10 cursor-pointer"
                >
                   <PlusCircle className="mr-2 h-4 w-4" />
                   Add "{toTitleCase(inputValue)}"
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
