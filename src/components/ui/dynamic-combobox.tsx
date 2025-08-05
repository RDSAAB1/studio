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
}

export function DynamicCombobox({
  options,
  value,
  onChange,
  onAdd,
  placeholder = "Select an option",
  searchPlaceholder = "Search...",
  emptyPlaceholder = "No options found.",
}: DynamicComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState("");

  const selectedOption = options.find((option) => option.value === value);

  const handleAddNew = () => {
    if (onAdd && inputValue) {
      onAdd(inputValue);
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {selectedOption ? selectedOption.label : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={searchPlaceholder}
            value={inputValue}
            onValueChange={setInputValue}
          />
          <CommandList>
            <CommandEmpty>
                {onAdd ? (
                    <Button
                        variant="ghost"
                        className="w-full justify-start"
                        onClick={handleAddNew}
                    >
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Add "{inputValue}"
                    </Button>
                ) : (
                    emptyPlaceholder
                )}
            </CommandEmpty>
            <CommandGroup>
              {options
                .filter(option => option.label.toLowerCase().includes(inputValue.toLowerCase()))
                .map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={(currentValue) => {
                    onChange(currentValue === value ? "" : currentValue);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === option.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
