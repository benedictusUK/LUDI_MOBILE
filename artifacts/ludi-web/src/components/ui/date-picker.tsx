import { useState } from "react";
import { CalendarIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const pad = (n: number) => String(n).padStart(2, "0");
const toYmd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromYmd = (v?: string) => {
  const m = (v || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : undefined;
};

interface DatePickerProps {
  id?: string;
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabledBefore?: Date;
  className?: string;
  "data-testid"?: string;
}

export function DatePicker({ id, value, onChange, placeholder = "Pick a date", disabledBefore, className, ...rest }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = fromYmd(value);
  return (
    <div className="flex min-w-0 items-center gap-1">
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          data-testid={rest["data-testid"]}
          className={cn("w-full justify-start bg-white font-normal", !selected && "text-muted-foreground", className)}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {selected ? selected.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          onSelect={(d) => { if (d) { onChange(toYmd(d)); setOpen(false); } }}
          disabled={disabledBefore ? { before: disabledBefore } : undefined}
          initialFocus
        />
      </PopoverContent>
    </Popover>
    {value && (
      <Button type="button" variant="ghost" size="icon" className="shrink-0"
        aria-label={`Clear ${id || "date"}`} onClick={() => onChange("")}>
        <X className="h-4 w-4" />
      </Button>
    )}
    </div>
  );
}

/** value: "YYYY-MM-DDTHH:MM" (local). Calendar for date, text input for time. */
export function DateTimePicker({ id, value, onChange }: { id?: string; value?: string; onChange: (v: string) => void }) {
  const [date, time] = (value || "").split("T");
  const emit = (d: string, t: string) => onChange(d || t ? `${d || ""}T${t || "00:00"}` : "");
  return (
    <div className="grid grid-cols-[1fr_96px] gap-2">
      <DatePicker id={id} value={date} onChange={(d) => onChange(d ? `${d}T${time || "00:00"}` : "")} />
      <Input
        type="time"
        aria-label={`${id || "Payment"} time`}
        disabled={!date}
        className="bg-white"
        value={time || ""}
        onChange={(e) => emit(date || "", e.target.value)}
      />
    </div>
  );
}
