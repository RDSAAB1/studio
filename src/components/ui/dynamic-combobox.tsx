
"use client";

import * as React from "react";
import { Check, ChevronsUpDown, PlusCircle, Trash } from "lucide-react";

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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toTitleCase } from "@/lib/utils";

export type ComboboxOption = {
  value: string;
  label: string;
};

interface DynamicComboboxProps {
  options: ComboboxOption[];
  value?: string;
  onChange: (value: string) => void;
  onAdd?: (value: string) => void;
  onDelete?: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyPlaceholder?: string;
  className?: string;
}

export function DynamicCombobox({
  options,
  value,
  onChange,
  onAdd,
  onDelete,
  placeholder = "Select an option...",
  searchPlaceholder = "Search...",
  emptyPlaceholder = "No options found.",
  className,
}: DynamicComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState("");

  const handleSelect = (currentValue: string) => {
    onChange(currentValue === value ? "" : currentValue);
    setOpen(false);
  };

  const handleAdd = () => {
    if (onAdd && inputValue) {
      const formattedValue = toTitleCase(inputValue);
      onAdd(formattedValue);
      onChange(formattedValue);
      setInputValue("");
      setOpen(false);
    }
  };

  const selectedLabel = options.find((option) => option.value.toLowerCase() === value?.toLowerCase())?.label;

  const showAddButton = onAdd && inputValue && !options.some(opt => opt.label.toLowerCase() === inputValue.toLowerCase());

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
        >
          <span className="truncate">{value ? selectedLabel : placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput 
            placeholder={searchPlaceholder}
            value={inputValue}
            onValueChange={setInputValue}
          />
          <CommandList>
            <CommandEmpty>
              {showAddButton ? (
                 <div className="p-1">
                    <Button variant="ghost" className="w-full justify-start" onClick={handleAdd}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Add "{inputValue}"
                    </Button>
                 </div>
              ) : (
                <div className="py-6 text-center text-sm">{emptyPlaceholder}</div>
              )}
            </CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={handleSelect}
                  className="group/item flex justify-between items-center"
                >
                  <div className="flex items-center">
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value?.toLowerCase() === option.value.toLowerCase() ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {option.label}
                  </div>
                  {onDelete && (
                     <AlertDialog>
                      <AlertDialogTrigger asChild>
                         <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover/item:opacity-100"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                        >
                          <Trash className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete "{option.label}".
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel onClick={(e) => e.stopPropagation()}>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={(e) => {
                              e.stopPropagation();
                              onDelete(option.value);
                            }}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
