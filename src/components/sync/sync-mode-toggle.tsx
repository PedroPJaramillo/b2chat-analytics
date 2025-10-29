"use client"

import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

interface SyncModeToggleProps {
  value: 'full' | 'two-stage'
  onChange: (value: 'full' | 'two-stage') => void
  disabled?: boolean
}

export function SyncModeToggle({ value, onChange, disabled }: SyncModeToggleProps) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">Sync Mode</Label>
      <RadioGroup value={value} onValueChange={onChange} disabled={disabled}>
        <div className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-4">
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="full" id="full" disabled={disabled} />
            <Label htmlFor="full" className="cursor-pointer">
              <span className="font-medium">Full Sync</span>
              <span className="text-xs text-muted-foreground block">
                Extract + Transform automatically
              </span>
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="two-stage" id="two-stage" disabled={disabled} />
            <Label htmlFor="two-stage" className="cursor-pointer">
              <span className="font-medium">Two-Stage Sync</span>
              <span className="text-xs text-muted-foreground block">
                Manual control over extract & transform
              </span>
            </Label>
          </div>
        </div>
      </RadioGroup>
    </div>
  )
}
