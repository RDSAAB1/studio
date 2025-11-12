"use client";

import * as React from "react";
import { format, isValid, parse, parseISO } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Button } from "./button";
import { Input } from "./input";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Calendar } from "./calendar";
import { cn } from "@/lib/utils";

const STORAGE_FORMAT = "yyyy-MM-dd";
const DISPLAY_FORMAT = "dd MMM yyyy";

type SmartDatePickerProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  buttonClassName?: string;
  name?: string;
  id?: string;
};

const candidateFormats = [
  "d/M/yyyy",
  "d-M-yyyy",
  "d.M.yyyy",
  "d/M/yy",
  "d-M-yy",
  "d.M.yy",
  "dd/MM/yyyy",
  "dd-MM-yyyy",
  "dd.MM.yyyy",
  "dd/MM/yy",
  "dd-MM-yy",
  "dd.MM.yy",
  "d MMM yyyy",
  "dd MMM yyyy",
  "yyyy-MM-dd",
  "yyyy/MM/dd",
];

const normalizeYear = (year: number, now: Date) => {
  if (year >= 100) return year;
  const currentYear = now.getFullYear();
  const currentCentury = Math.floor(currentYear / 100) * 100;
  let computed = currentCentury + year;
  if (computed > currentYear + 50) {
    computed -= 100;
  }
  return computed;
};

const buildDate = (day: number, month: number, year: number) => {
  const candidate = new Date(year, month - 1, day);
  if (
    candidate.getFullYear() !== year ||
    candidate.getMonth() !== month - 1 ||
    candidate.getDate() !== day
  ) {
    return null;
  }
  return candidate;
};

const parseSmartInput = (raw: string): Date | null => {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  try {
    const iso = parseISO(trimmed);
    if (isValid(iso)) {
      return iso;
    }
  } catch {
    // ignore
  }

  for (const fmt of candidateFormats) {
    try {
      const parsed = parse(trimmed, fmt, new Date());
      if (isValid(parsed)) {
        return parsed;
      }
    } catch {
      // continue
    }
  }

  const normalized = trimmed
    .replace(/[-./\\]/g, " ")
    .replace(/,/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const parts = normalized.split(" ").filter(Boolean);
  if (!parts.length) return null;

  const now = new Date();
  let day: number | null = null;
  let month: number | null = null;
  let year: number | null = null;

  const nums = parts.map((part) => Number.parseInt(part, 10)).filter((n) => !Number.isNaN(n));

  if (nums.length === 1) {
    day = nums[0];
    month = now.getMonth() + 1;
    year = now.getFullYear();
  } else if (nums.length === 2) {
    [day, month] = nums;
    year = now.getFullYear();
  } else {
    [day, month, year] = nums.slice(-3);
    if (year !== null) {
      year = normalizeYear(year, now);
    }
  }

  if (day === null || month === null) return null;
  if (year === null) {
    year = now.getFullYear();
  }

  if (month < 1 || month > 12) return null;

  const constructed = buildDate(day, month, year);
  return constructed;
};

const formatDisplay = (value: string) => {
  if (!value) return "";
  try {
    const date = parseISO(value);
    if (isValid(date)) {
      return format(date, DISPLAY_FORMAT);
    }
  } catch {
    // ignore
  }
  return value;
};

export const SmartDatePicker: React.FC<SmartDatePickerProps> = ({
  value,
  onChange,
  disabled,
  placeholder = "Select date",
  className,
  name,
  id,
  inputClassName,
  buttonClassName,
}) => {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState(() => formatDisplay(value));
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const lastValueRef = React.useRef<string>(value);

  React.useEffect(() => {
    if (value !== lastValueRef.current) {
      lastValueRef.current = value;
      setInputValue(formatDisplay(value));
    }
  }, [value]);

  const commitInput = React.useCallback(() => {
    const raw = inputRef.current?.value ?? "";
    if (!raw.trim()) {
      if (value !== "") {
        onChange("");
      }
      setInputValue("");
      return;
    }

    const parsed = parseSmartInput(raw);
    if (!parsed) {
      setInputValue(formatDisplay(value));
      return;
    }
    const nextValue = format(parsed, STORAGE_FORMAT);
    setInputValue(format(parsed, DISPLAY_FORMAT));
    if (nextValue !== value) {
      onChange(nextValue);
    }
  }, [onChange, value]);

  const handleCalendarSelect = (date: Date | undefined) => {
    if (!date) return;
    const iso = format(date, STORAGE_FORMAT);
    setInputValue(format(date, DISPLAY_FORMAT));
    setOpen(false);
    if (iso !== value) {
      onChange(iso);
    }
  };

  const selectedDate = React.useMemo(() => {
    if (!value) return undefined;
    try {
      const parsed = parseISO(value);
      if (isValid(parsed)) {
        return parsed;
      }
    } catch {
      return undefined;
    }
    return undefined;
  }, [value]);

  return (
    <div className={cn("flex w-full items-center gap-2", className)}>
      <Input
        ref={inputRef}
        name={name}
        id={id}
        value={inputValue}
        onChange={(event) => setInputValue(event.target.value)}
        onBlur={commitInput}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commitInput();
          }
        }}
        placeholder={placeholder}
        disabled={disabled}
        className={cn("flex-1 h-9", inputClassName)}
        autoComplete="off"
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={cn("h-9 w-9 px-2", buttonClassName)}
            disabled={disabled}
            aria-label="Open date picker"
          >
            <CalendarIcon className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleCalendarSelect}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
};

