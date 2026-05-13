import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption: "flex justify-center pt-1 relative items-center",
        caption_label: "text-sm font-medium",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse space-y-1",
        head_row: "flex",
        head_cell: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
        row: "flex w-full mt-2",
        cell: cn(
          "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
          "calendar-cell"
        ),
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal",
          "text-[var(--calendar-text,inherit)] opacity-[var(--calendar-day-opacity,0.95)] hover:bg-[var(--calendar-hover-bg,theme(colors.accent.DEFAULT))] hover:text-[var(--calendar-text,inherit)]",
          "calendar-day"
        ),
        day_range_end: "day-range-end",
        day_selected: cn(
          "bg-[var(--calendar-selected-bg,theme(colors.primary.DEFAULT))] text-[var(--calendar-selected-text,theme(colors.primary.foreground))] hover:bg-[var(--calendar-selected-bg,theme(colors.primary.DEFAULT))] hover:text-[var(--calendar-selected-text,theme(colors.primary.foreground))] focus:bg-[var(--calendar-selected-bg,theme(colors.primary.DEFAULT))] focus:text-[var(--calendar-selected-text,theme(colors.primary.foreground))]",
          "calendar-day-selected opacity-100"
        ),
        day_today: cn(
          "bg-transparent border-[1.5px] border-[var(--calendar-today-border,theme(colors.accent.DEFAULT))] text-[var(--calendar-text,inherit)]",
          "calendar-day-today"
        ),
        day_outside: cn(
          "day-outside text-[var(--calendar-muted-text,theme(colors.muted.foreground))] opacity-[var(--calendar-outside-opacity,0.5)] aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
          "calendar-day-outside"
        ),
        day_disabled: cn(
          "text-[var(--calendar-disabled-text,theme(colors.muted.foreground))] opacity-[var(--calendar-disabled-opacity,0.4)]",
          "calendar-day-disabled"
        ),
        day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: ({ ..._props }) => <ChevronLeft className="h-4 w-4" />,
        IconRight: ({ ..._props }) => <ChevronRight className="h-4 w-4" />,
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
