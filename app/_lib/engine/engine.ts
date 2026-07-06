import type {
  AnalyzeLike,
  EngineError,
  EngineModule,
  EngineVersion,
  RuntimeClasses,
} from './types'

/** Display metadata for each selectable release line, shown in the docs UI. */
export const ENGINE_RELEASES: Record<
  EngineVersion,
  { label: string; short: string; range: string; engine: string }
> = {
  v4: { label: 'v4.1.0 (latest)', short: 'v4.1.0', range: '^4', engine: 'Rust / WebAssembly' },
  v3: { label: 'v3.0.1', short: 'v3.0.1', range: '^3', engine: 'TypeScript (legacy)' },
}

/** Release lines in display order (latest first). */
export const ENGINE_ORDER: EngineVersion[] = ['v4', 'v3']

/**
 * Loads and instantiates the runtime module for a release line.
 *
 * `^v4` uses the browser entry and must initialise WASM asynchronously; the raw
 * binary is resolved as a bundler asset. `^v3` is a pure-TypeScript module that
 * initialises itself on import, so there is nothing to await.
 */
async function loadModule(version: EngineVersion): Promise<EngineModule> {
  if (version === 'v4') {
    const mod = (await import('url-ast/browser')) as unknown as EngineModule
    // No argument: the browser entry's default `new URL('../wasm/wasm_bg.wasm',
    // import.meta.url)` is emitted as an asset by the bundler (honouring
    // assetPrefix / basePath), so the engine loads its own binary.
    await mod.initWasm?.()
    return mod
  }

  return (await import('url-ast-v3')) as unknown as EngineModule
}

/**
 * Unified facade over the two url-ast release lines.
 *
 * It translates the differences between `^v4` (Rust/WASM, async init, browser
 * entry) and `^v3` (legacy pure-TypeScript, sync) into one stable surface, so the
 * documentation components consume a single API and never branch on version.
 * Instances are created via {@link UrlAstEngine.load}, which caches one engine per
 * version for the lifetime of the page.
 */
export class UrlAstEngine {
  readonly version: EngineVersion
  private readonly module: EngineModule

  private constructor(version: EngineVersion, module: EngineModule) {
    this.version = version
    this.module = module
  }

  private static readonly cache = new Map<EngineVersion, Promise<UrlAstEngine>>()

  /** Loads (and caches) the engine for a release line. */
  static load(version: EngineVersion): Promise<UrlAstEngine> {
    let pending = this.cache.get(version)
    if (!pending) {
      pending = loadModule(version)
        .then((module) => new UrlAstEngine(version, module))
        .catch((error) => {
          // Drop the rejected promise so a later attempt can retry.
          this.cache.delete(version)
          throw error
        })
      this.cache.set(version, pending)
    }
    return pending
  }

  /** Metadata for the loaded release line. */
  get release() {
    return ENGINE_RELEASES[this.version]
  }

  /** The three classes the interactive playground injects. */
  get runtime(): RuntimeClasses {
    return {
      Analyze: this.module.Analyze,
      AST: this.module.AST,
      ErrorLog: this.module.ErrorLog,
    }
  }

  /** `new Analyze(input[, base])`, version-agnostic. */
  analyze(input: string, base?: AnalyzeLike): AnalyzeLike {
    return base ? new this.module.Analyze(input, base) : new this.module.Analyze(input)
  }

  /** AST JSON for `input` (labeled by default). Both versions expose `ast.toJSON`. */
  astToJson(input: string, labeled = true): unknown {
    return this.analyze(input).ast.toJSON(labeled)
  }

  /** Parse-time errors for `input`, or `[]` when it parses cleanly. */
  errorsFor(input: string): EngineError[] {
    const parsed = this.analyze(input)
    return parsed.hasErrors() ? parsed.errors : []
  }
}
