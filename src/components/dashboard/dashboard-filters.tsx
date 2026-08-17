import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";

interface DashboardFiltersProps {
  dateRange: [Date | null, Date | null];
  onDateRangeChange: (range: [Date | null, Date | null]) => void;
  category: string;
  onCategoryChange: (category: string) => void;
  supplier: string;
  onSupplierChange: (supplier: string) => void;
  location: string;
  onLocationChange: (location: string) => void;
}

export const DashboardFilters = ({
  dateRange,
  onDateRangeChange,
  category,
  onCategoryChange,
  supplier,
  onSupplierChange,
  location,
  onLocationChange,
}: DashboardFiltersProps) => {
  return (
    <div className="flex gap-4">
     <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-[280px] justify-start text-left font-normal">
            <CalendarIcon className="mr-2 h-4 w-4" />
            {dateRange[0] ? (
              dateRange[1] ? (
                <>
                  {format(dateRange[0], "LLL dd, y")} -{" "}
                  {format(dateRange[1], "LLL dd, y")}
                </>
              ) : (
                format(dateRange[0], "LLL dd, y")
              )
            ) : (
              <span>Pick a date range</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            defaultMonth={dateRange[0] || undefined}
            selected={{
              from: dateRange[0] || undefined,
              to: dateRange[1] || undefined,
            }}
            onSelect={(range) => {
              if (range) {
                onDateRangeChange([range.from || null, range.to || null]);
              } else {
                onDateRangeChange([null, null]);
              }
            }}
            numberOfMonths={2}
            initialFocus
          />
        </PopoverContent>
      </Popover>

      <Select value={category} onValueChange={onCategoryChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Select category" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Categories</SelectItem>
          <SelectItem value="electronics">Electronics</SelectItem>
          <SelectItem value="tools">Tools</SelectItem>
          <SelectItem value="parts">Parts</SelectItem>
        </SelectContent>
      </Select>

      <Select value={supplier} onValueChange={onSupplierChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Select supplier" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Suppliers</SelectItem>
          <SelectItem value="supplyCo">SupplyCo</SelectItem>
          <SelectItem value="techSupplies">TechSupplies</SelectItem>
        </SelectContent>
      </Select>

      <Select value={location} onValueChange={onLocationChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Select location" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Locations</SelectItem>
          <SelectItem value="warehouseA">Warehouse A</SelectItem>
          <SelectItem value="warehouseB">Warehouse B</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};