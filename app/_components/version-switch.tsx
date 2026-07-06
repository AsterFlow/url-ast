'use client'

import { useState } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

/**
 * A release version the docs can point at. `href` is `null` for the version
 * this site currently documents (selecting it is a no-op); every other entry
 * links out to where that release's reference lives (npm registry page).
 */
type DocsVersion = {
  value: string
  label: string
  href: string | null
}

/**
 * The current docs site tracks the latest release. Older majors are not hosted
 * as versioned sites, so they link to their published npm pages instead.
 */
const VERSIONS: DocsVersion[] = [
  { value: 'v4', label: 'v4.0.0 (latest)', href: null },
  { value: 'v3', label: 'v3.0.0', href: 'https://www.npmjs.com/package/url-ast/v/3.0.0' },
  { value: 'v2', label: 'v2.x', href: 'https://www.npmjs.com/package/url-ast/v/2.0.3' },
]

/**
 * Release-version switcher rendered in the docs navbar. Selecting the current
 * version does nothing; selecting an older one navigates to its npm page.
 */
export function VersionSwitch({ current = 'v4' }: { current?: string }) {
  const [value, setValue] = useState(current)

  function onChange(next: string) {
    const target = VERSIONS.find((version) => version.value === next)
    if (!target || target.href === null) {
      setValue(next)
      return
    }
    window.location.href = target.href
  }

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        size="sm"
        aria-label="Select documentation version"
        className="font-medium"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {VERSIONS.map((version) => (
          <SelectItem key={version.value} value={version.value}>
            {version.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
