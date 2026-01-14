"use client";

import * as React from "react";
import { format, isValid, parse, parseISO } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Button } from "./button";
import { Input } from "./input";
import { Label } from "./label";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Calendar } from "./calendar";
import { cn } from "@/lib/utils";

const STORAGE_FORMAT = "yyyy-MM-dd";
const DISPLAY_FORMAT = "dd MMM yyyy";

type SmartDatePickerProps = {
  value: string | Date | undefined | null;
  onChange: (value: string | Date) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  buttonClassName?: string;
  name?: string;
  id?: string;
  returnDate?: boolean; // If true, onChange returns Date object instead of string
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

  // Check for 8-digit format: DDMMYYYY (e.g., 12022005 = 12 Feb 2005)
  if (trimmed.match(/^\d{8}$/)) {
    const day = Number.parseInt(trimmed.substring(0, 2), 10);
    const month = Number.parseInt(trimmed.substring(2, 4), 10);
    const year = Number.parseInt(trimmed.substring(4, 8), 10);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1000 && year <= 9999) {
      const constructed = buildDate(day, month, year);
      if (constructed) {
        return constructed;
      }
    }
  }

  // Check for 6-digit format: DDMMYY (e.g., 120205 = 12 Feb 2005, assuming 20xx)
  if (trimmed.match(/^\d{6}$/)) {
    const day = Number.parseInt(trimmed.substring(0, 2), 10);
    const month = Number.parseInt(trimmed.substring(2, 4), 10);
    const year = Number.parseInt(trimmed.substring(4, 6), 10);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      const now = new Date();
      const normalizedYear = normalizeYear(year, now);
      const constructed = buildDate(day, month, normalizedYear);
      if (constructed) {
        return constructed;
      }
    }
  }

  // First, check if it's just a number (day only)
  const dayOnly = Number.parseInt(trimmed, 10);
  if (!Number.isNaN(dayOnly) && dayOnly >= 1 && dayOnly <= 31 && trimmed.match(/^\d+$/)) {
    const now = new Date();
    const constructed = buildDate(dayOnly, now.getMonth() + 1, now.getFullYear());
    if (constructed) {
      return constructed;
    }
  }

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
    // Single number: treat as day of current month and year
    day = nums[0];
    month = now.getMonth() + 1;
    year = now.getFullYear();
  } else if (nums.length === 2) {
    // Two numbers: day and month of current year
    [day, month] = nums;
    year = now.getFullYear();
  } else {
    // Three or more numbers: day, month, year
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
  if (day < 1 || day > 31) return null;

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
  returnDate = false,
}) => {
  // Convert value to string format for internal use
  const valueAsString = React.useMemo(() => {
    if (!value) return "";
    if (value instanceof Date) {
      return isValid(value) ? format(value, STORAGE_FORMAT) : "";
    }
    return value;
  }, [value]);

  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState(() => formatDisplay(valueAsString));
  const [calendarDay, setCalendarDay] = React.useState("");
  const [calendarMonth, setCalendarMonth] = React.useState("");
  const [calendarYear, setCalendarYear] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const lastValueRef = React.useRef<string>(valueAsString);

  React.useEffect(() => {
    if (valueAsString !== lastValueRef.current) {
      lastValueRef.current = valueAsString;
      setInputValue(formatDisplay(valueAsString));
    }
  }, [valueAsString]);

  const commitInput = React.useCallback(() => {
    const raw = inputRef.current?.value ?? "";
    if (!raw.trim()) {
      if (valueAsString !== "") {
        onChange(returnDate ? new Date() : "");
      }
      setInputValue("");
      return;
    }

    const parsed = parseSmartInput(raw);
    if (!parsed) {
      // If parsing fails, try to parse as just a day number
      const dayOnly = raw.trim();
      const dayNum = Number.parseInt(dayOnly, 10);
      if (!Number.isNaN(dayNum) && dayNum >= 1 && dayNum <= 31) {
        const now = new Date();
        const constructed = buildDate(dayNum, now.getMonth() + 1, now.getFullYear());
        if (constructed) {
          const nextValue = format(constructed, STORAGE_FORMAT);
          setInputValue(format(constructed, DISPLAY_FORMAT));
          if (nextValue !== valueAsString) {
            onChange(returnDate ? constructed : nextValue);
          }
          return;
        }
      }
      setInputValue(formatDisplay(valueAsString));
      return;
    }
    const nextValue = format(parsed, STORAGE_FORMAT);
    setInputValue(format(parsed, DISPLAY_FORMAT));
    if (nextValue !== valueAsString) {
      onChange(returnDate ? parsed : nextValue);
    }
  }, [onChange, valueAsString, returnDate]);

  const handleCalendarSelect = (date: Date | undefined) => {
    if (!date) return;
    const iso = format(date, STORAGE_FORMAT);
    setInputValue(format(date, DISPLAY_FORMAT));
    // Update calendar fields
    setCalendarDay(String(date.getDate()).padStart(2, '0'));
    setCalendarMonth(String(date.getMonth() + 1).padStart(2, '0'));
    setCalendarYear(String(date.getFullYear()));
    setOpen(false);
    if (iso !== valueAsString) {
      onChange(returnDate ? date : iso);
    }
  };

  const handleCalendarFieldsCommit = () => {
    const day = Number.parseInt(calendarDay, 10);
    const month = Number.parseInt(calendarMonth, 10);
    const year = Number.parseInt(calendarYear, 10);

    if (Number.isNaN(day) || Number.isNaN(month) || Number.isNaN(year)) {
      // Reset to current value if invalid
      if (valueAsString) {
        const date = parseISO(valueAsString);
        if (isValid(date)) {
          setCalendarDay(String(date.getDate()).padStart(2, '0'));
          setCalendarMonth(String(date.getMonth() + 1).padStart(2, '0'));
          setCalendarYear(String(date.getFullYear()));
        }
      }
      return;
    }

    if (day < 1 || day > 31 || month < 1 || month > 12 || year < 1000 || year > 9999) {
      // Reset to current value if out of range
      if (valueAsString) {
        const date = parseISO(valueAsString);
        if (isValid(date)) {
          setCalendarDay(String(date.getDate()).padStart(2, '0'));
          setCalendarMonth(String(date.getMonth() + 1).padStart(2, '0'));
          setCalendarYear(String(date.getFullYear()));
        }
      }
      return;
    }

    const constructed = buildDate(day, month, year);
    if (!constructed) {
      // Reset to current value if invalid date
      if (valueAsString) {
        const date = parseISO(valueAsString);
        if (isValid(date)) {
          setCalendarDay(String(date.getDate()).padStart(2, '0'));
          setCalendarMonth(String(date.getMonth() + 1).padStart(2, '0'));
          setCalendarYear(String(date.getFullYear()));
        }
      }
      return;
    }

    const iso = format(constructed, STORAGE_FORMAT);
    setInputValue(format(constructed, DISPLAY_FORMAT));
    if (iso !== valueAsString) {
      onChange(returnDate ? constructed : iso);
    }
  };

  // Update calendar fields when value changes or popup opens
  React.useEffect(() => {
    if (open) {
      if (valueAsString) {
        try {
          const date = parseISO(valueAsString);
          if (isValid(date)) {
            setCalendarDay(String(date.getDate()).padStart(2, '0'));
            setCalendarMonth(String(date.getMonth() + 1).padStart(2, '0'));
            setCalendarYear(String(date.getFullYear()));
            return;
          }
        } catch {
          // ignore
        }
      }
      // If no valid value, use current date
      const now = new Date();
      setCalendarDay(String(now.getDate()).padStart(2, '0'));
      setCalendarMonth(String(now.getMonth() + 1).padStart(2, '0'));
      setCalendarYear(String(now.getFullYear()));
    }
  }, [valueAsString, open]);

  const selectedDate = React.useMemo(() => {
    if (!valueAsString) return undefined;
    try {
      const parsed = parseISO(valueAsString);
      if (isValid(parsed)) {
        return parsed;
      }
    } catch {
      return undefined;
    }
    return undefined;
  }, [valueAsString]);

  // Live selected date that updates in real-time as user types in fields
  const liveSelectedDate = React.useMemo(() => {
    const day = Number.parseInt(calendarDay, 10);
    const month = Number.parseInt(calendarMonth, 10);
    const year = Number.parseInt(calendarYear, 10);

    // If all fields are valid, construct and return the date
    if (!Number.isNaN(day) && !Number.isNaN(month) && !Number.isNaN(year) &&
        day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1000 && year <= 9999) {
      const constructed = buildDate(day, month, year);
      if (constructed) {
        return constructed;
      }
    }

    // If only month and year are valid, use day 1
    if (!Number.isNaN(month) && !Number.isNaN(year) && month >= 1 && month <= 12 && year >= 1000 && year <= 9999) {
      const constructed = buildDate(1, month, year);
      if (constructed) {
        return constructed;
      }
    }

    // If only year is valid, use current month and day 1
    if (!Number.isNaN(year) && year >= 1000 && year <= 9999) {
      const now = new Date();
      const constructed = buildDate(1, now.getMonth() + 1, year);
      if (constructed) {
        return constructed;
      }
    }

    // If only month is valid, use current year and day 1
    if (!Number.isNaN(month) && month >= 1 && month <= 12) {
      const now = new Date();
      const constructed = buildDate(1, month, now.getFullYear());
      if (constructed) {
        return constructed;
      }
    }

    // Fallback to committed selected date
    return selectedDate;
  }, [calendarDay, calendarMonth, calendarYear, selectedDate]);

  // Calculate calendar month view based on input fields - updates in real-time
  const calendarMonthView = React.useMemo(() => {
    const month = Number.parseInt(calendarMonth, 10);
    const year = Number.parseInt(calendarYear, 10);
    
    // If month and year are valid, show that month in calendar
    if (!Number.isNaN(month) && !Number.isNaN(year) && month >= 1 && month <= 12 && year >= 1000 && year <= 9999) {
      return new Date(year, month - 1, 1);
    }
    
    // If only month is valid, use current year
    if (!Number.isNaN(month) && month >= 1 && month <= 12) {
      const now = new Date();
      return new Date(now.getFullYear(), month - 1, 1);
    }
    
    // If only year is valid, use current month
    if (!Number.isNaN(year) && year >= 1000 && year <= 9999) {
      const now = new Date();
      return new Date(year, now.getMonth(), 1);
    }
    
    // Fallback to selected date or current date
    if (selectedDate) {
      return selectedDate;
    }
    
    return new Date();
  }, [calendarMonth, calendarYear, selectedDate]);

  return (
    <div className={cn("flex w-full items-center gap-2", className)}>
      <Input
        ref={inputRef}
        name={name}
        id={id}
        value={inputValue}
        onChange={(event) => setInputValue(event.target.value)}
        onFocus={(event) => {
          // Clear the input when focused so user can type fresh
          event.target.select();
          setInputValue("");
        }}
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
        <PopoverContent className="w-auto p-0" align="center" sideOffset={5}>
          <div className="p-2 border-b bg-muted/30">
            <div className="flex items-end gap-2">
              <div className="flex flex-col gap-1 min-w-[50px]">
                <Label htmlFor="calendarDay" className="text-[10px] font-medium text-muted-foreground text-center leading-tight">Day</Label>
                <Input
                  id="calendarDay"
                  name="calendarDay"
                  type="number"
                  min="1"
                  max="31"
                  value={calendarDay}
                  onChange={(e) => setCalendarDay(e.target.value)}
                  onFocus={(e) => e.target.select()}
                  onBlur={handleCalendarFieldsCommit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleCalendarFieldsCommit();
                    }
                  }}
                  placeholder="DD"
                  className="h-7 text-xs font-medium text-center px-1.5"
                  autoComplete="off"
                />
              </div>
              <div className="flex flex-col gap-1 min-w-[50px]">
                <Label htmlFor="calendarMonth" className="text-[10px] font-medium text-muted-foreground text-center leading-tight">Month</Label>
                <Input
                  id="calendarMonth"
                  name="calendarMonth"
                  type="number"
                  min="1"
                  max="12"
                  value={calendarMonth}
                  onChange={(e) => setCalendarMonth(e.target.value)}
                  onFocus={(e) => e.target.select()}
                  onBlur={handleCalendarFieldsCommit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleCalendarFieldsCommit();
                    }
                  }}
                  placeholder="MM"
                  className="h-7 text-xs font-medium text-center px-1.5"
                  autoComplete="off"
                />
              </div>
              <div className="flex flex-col gap-1 min-w-[65px]">
                <Label htmlFor="calendarYear" className="text-[10px] font-medium text-muted-foreground text-center leading-tight">Year</Label>
                <Input
                  id="calendarYear"
                  name="calendarYear"
                  type="number"
                  min="1000"
                  max="9999"
                  value={calendarYear}
                  onChange={(e) => setCalendarYear(e.target.value)}
                  onFocus={(e) => e.target.select()}
                  onBlur={handleCalendarFieldsCommit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleCalendarFieldsCommit();
                    }
                  }}
                  placeholder="YYYY"
                  className="h-7 text-xs font-medium text-center px-1.5"
                  autoComplete="off"
                />
              </div>
            </div>
          </div>
          <Calendar
            mode="single"
            selected={selectedDate || liveSelectedDate}
            onSelect={handleCalendarSelect}
            month={calendarMonthView}
            onMonthChange={(date) => {
              // Update fields when user navigates calendar manually
              if (date) {
                setCalendarMonth(String(date.getMonth() + 1).padStart(2, '0'));
                setCalendarYear(String(date.getFullYear()));
              }
            }}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
};

