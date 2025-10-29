"use client"

import * as React from "react"
import { Check, ChevronsUpDown, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"

export interface MultiSelectOption {
  label: string
  value: string
  count?: number
}

interface MultiSelectProps {
  options: MultiSelectOption[]
  value: string[]
  onChange: (value: string[]) => void
  placeholder?: string
  className?: string
  maxCount?: number
  emptyText?: string
}

export function MultiSelect({
  options,
  value = [],
  onChange,
  placeholder = "Select items...",
  className,
  maxCount = 3,
  emptyText = "No options available",
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false)

  const handleSelect = (selectedValue: string) => {
    const newValue = value.includes(selectedValue)
      ? value.filter((v) => v !== selectedValue)
      : [...value, selectedValue]
    onChange(newValue)
  }

  const handleRemove = (removedValue: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    onChange(value.filter((v) => v !== removedValue))
  }

  const handleSelectAll = () => {
    if (value.length === options.length) {
      onChange([])
    } else {
      onChange(options.map((opt) => opt.value))
    }
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange([])
  }

  const selectedOptions = options.filter((opt) => value.includes(opt.value))
  const displayText = React.useMemo(() => {
    if (value.length === 0) return placeholder
    if (value.length === 1) {
      const option = options.find((opt) => opt.value === value[0])
      return option?.label || value[0]
    }
    return `${value.length} selected`
  }, [value, options, placeholder])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "justify-between font-normal hover:bg-accent",
            className
          )}
        >
          <span className="truncate">{displayText}</span>
          <div className="flex items-center gap-1">
            {value.length > 0 && (
              <Badge variant="secondary" className="rounded-sm px-1 font-normal">
                {value.length}
              </Badge>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[250px] p-0" align="start">
        <div className="max-h-[300px] overflow-auto">
          {/* Header with Select All / Clear All */}
          <div className="flex items-center justify-between border-b px-3 py-2">
            <button
              onClick={handleSelectAll}
              className="text-xs font-medium text-primary hover:underline"
            >
              {value.length === options.length ? "Clear All" : "Select All"}
            </button>
            {value.length > 0 && (
              <button
                onClick={handleClear}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
            )}
          </div>

          {/* Options List */}
          {options.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              {emptyText}
            </div>
          ) : (
            <div className="p-1">
              {options.map((option) => {
                const isSelected = value.includes(option.value)
                return (
                  <div
                    key={option.value}
                    className={cn(
                      "flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm cursor-pointer hover:bg-accent",
                      isSelected && "bg-accent"
                    )}
                    onClick={() => handleSelect(option.value)}
                  >
                    <Checkbox checked={isSelected} className="pointer-events-none" />
                    <span className="flex-1 truncate">{option.label}</span>
                    {option.count !== undefined && (
                      <span className="text-xs text-muted-foreground">
                        ({option.count})
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Selected Items Footer */}
        {value.length > 0 && (
          <div className="border-t bg-muted/50 p-2">
            <div className="flex flex-wrap gap-1">
              {selectedOptions.slice(0, maxCount).map((option) => (
                <Badge
                  key={option.value}
                  variant="secondary"
                  className="gap-1 pr-0.5"
                >
                  <span className="text-xs">{option.label}</span>
                  <button
                    onClick={(e) => handleRemove(option.value, e)}
                    className="ml-1 rounded-sm hover:bg-muted p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              {value.length > maxCount && (
                <Badge variant="secondary" className="text-xs">
                  +{value.length - maxCount} more
                </Badge>
              )}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
