'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { UrlAstEngine } from './engine'
import type { EngineVersion } from './types'

const STORAGE_KEY = 'url-ast-docs:engine-version'

interface EngineContextValue {
  /** Currently selected release line. */
  version: EngineVersion
  /** Switch release line; persisted across reloads. */
  setVersion: (version: EngineVersion) => void
  /** Loaded engine, or `null` while the selected version is initialising. */
  engine: UrlAstEngine | null
  /** `true` once `engine` is ready to use. */
  ready: boolean
  /** Initialization error message, if loading the engine failed. */
  error: string | null
}

const EngineContext = createContext<EngineContextValue | null>(null)

function isVersion(value: unknown): value is EngineVersion {
  return value === 'v3' || value === 'v4'
}

/**
 * Provides the version-agnostic {@link UrlAstEngine} to the whole docs tree and
 * owns the selected release line (persisted to localStorage). Switching version
 * lazily loads the other engine and re-renders every consumer.
 */
export function EngineProvider({
  children,
  defaultVersion = 'v4',
}: {
  children: ReactNode
  defaultVersion?: EngineVersion
}) {
  const [version, setVersionState] = useState<EngineVersion>(defaultVersion)
  const [engine, setEngine] = useState<UrlAstEngine | null>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Restore the previously chosen version on mount.
  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (isVersion(stored)) setVersionState(stored)
  }, [])

  // (Re)load the engine whenever the selected version changes.
  useEffect(() => {
    let alive = true
    setReady(false)
    setError(null)

    UrlAstEngine.load(version)
      .then((loaded) => {
        if (!alive) return
        setEngine(loaded)
        setReady(true)
      })
      .catch((err: unknown) => {
        if (!alive) return
        setEngine(null)
        setError(err instanceof Error ? err.message : String(err))
      })

    return () => {
      alive = false
    }
  }, [version])

  const setVersion = useCallback((next: EngineVersion) => {
    setVersionState(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Ignore storage failures (private mode, etc.).
    }
  }, [])

  const value = useMemo<EngineContextValue>(
    () => ({ version, setVersion, engine, ready, error }),
    [version, setVersion, engine, ready, error],
  )

  return <EngineContext.Provider value={value}>{children}</EngineContext.Provider>
}

/** Access the selected release line and its loaded engine. */
export function useEngine(): EngineContextValue {
  const ctx = useContext(EngineContext)
  if (!ctx) throw new Error('useEngine must be used within <EngineProvider>')
  return ctx
}
