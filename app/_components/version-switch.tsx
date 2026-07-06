'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ENGINE_ORDER, ENGINE_RELEASES, useEngine, type EngineVersion } from '@/lib/engine'

/**
 * Release-version switcher in the docs navbar. Selecting a line swaps the engine
 * that powers every live example: `^v4` runs the Rust/WASM engine, `^v3` the
 * legacy TypeScript engine. The choice is persisted by the EngineProvider.
 */
export function VersionSwitch() {
  const { version, setVersion } = useEngine()

  return (
    <Select value={version} onValueChange={(next) => setVersion(next as EngineVersion)}>
      <SelectTrigger
        size="sm"
        aria-label="Select documentation version"
        className="font-medium"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {ENGINE_ORDER.map((value) => (
          <SelectItem key={value} value={value}>
            {ENGINE_RELEASES[value].label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
