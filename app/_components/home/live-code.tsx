'use client'

import { useState, useEffect, useId } from 'react'
import { usePathname } from 'next/navigation'
import { ENGINE_RELEASES, useEngine } from '@/lib/engine'
import { Play, RotateCcw, AlertCircle, Maximize, Minimize } from 'lucide-react'
import Editor, { useMonaco } from '@monaco-editor/react'
import enDictionary from '@app/_dictionaries/en'
import ptBRDictionary from '@app/_dictionaries/ptBR'

type OutputLogType = {
  type: 'log' | 'warn' | 'error' | 'return';
  label?: string;
  value: unknown;
}

export function LiveCode({ initialCode }: { initialCode: string }) {
  const uniqueComponentId = useId()
  const { engine, version } = useEngine()

  // LiveCode is embedded in MDX pages without a `lang` prop, so we derive the
  // locale from the URL segment (`/pt-BR/...` vs `/en/...`) and read the UI
  // strings from the shared dictionary.
  const pathname = usePathname()
  const t = (pathname?.includes('/pt-BR') ? ptBRDictionary : enDictionary).playground

  const [codeContent, setCodeContent] = useState(initialCode.trim())
  const [outputLogs, setOutputLogs] = useState<OutputLogType[]>([])
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [isExecutingCode, setIsExecutingCode] = useState(false)
  const [editorContainerHeight, setEditorContainerHeight] = useState<number>(200)
  const [isFullscreenMode, setIsFullscreenMode] = useState<boolean>(false)
  
  const monacoEditorInstance = useMonaco()

  useEffect(() => {
    if (isFullscreenMode) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }

    return () => {
      document.body.style.overflow = ''
    }
  }, [isFullscreenMode])

  useEffect(() => {
    if (monacoEditorInstance) {
      const typescriptNamespace = monacoEditorInstance.typescript
      
      if (typescriptNamespace && typescriptNamespace.typescriptDefaults) {
        typescriptNamespace.typescriptDefaults.setCompilerOptions({
          target: typescriptNamespace.ScriptTarget.ESNext,
          allowNonTsExtensions: true,
          moduleResolution: typescriptNamespace.ModuleResolutionKind.NodeJs,
          module: typescriptNamespace.ModuleKind.CommonJS,
          noEmit: true,
        })

        const rawTypescriptDefinitions = process.env.URL_AST_TYPES || ''
        const cleanedTypescriptDefinitions = rawTypescriptDefinitions.replace(/export \{\};/gm, '').replace(/^export /gm, '')

        const fullTypescriptString = `
          ${cleanedTypescriptDefinitions}
          
          declare module 'url-ast' {
            export { Analyze, AST, ErrorLog };
          }
        `

        typescriptNamespace.typescriptDefaults.addExtraLib(fullTypescriptString, 'ts:filename/url-ast.d.ts')
      }
    }
  }, [monacoEditorInstance])

  const executeCode = () => {
    if (!engine) {
      setErrorMessage(t.loadingEngine)
      return
    }

    setIsExecutingCode(true)
    setErrorMessage('')
    setOutputLogs([])

    try {
      const { Analyze, AST, ErrorLog } = engine.runtime
      const capturedLogsArray: OutputLogType[] = []
      
      const fakeConsole = {
        log: (...args: unknown[]) => { capturedLogsArray.push({ type: 'log', value: args.length === 1 ? args[0] : args }) },
        warn: (...args: unknown[]) => { capturedLogsArray.push({ type: 'warn', value: args.length === 1 ? args[0] : args }) },
        error: (...args: unknown[]) => { capturedLogsArray.push({ type: 'error', value: args.length === 1 ? args[0] : args }) }
      }

      const strippedCodeContent = codeContent.replace(/^import .* from .*/gm, '').trim()

      let currentBlockDepth = 0
      const textLines = strippedCodeContent.split('\n')
      
      const transformedCodeContent = textLines.map((currentLine, lineIndex) => {
        let isInsideString = false
        let activeStringCharacter = ''
        let codeContentWithoutComments = ''
        
        // Iteração segura de caracteres para isolar o que é código do que é comentário
        for (let characterIndex = 0; characterIndex < currentLine.length; characterIndex++) {
          const currentCharacter = currentLine[characterIndex]
          
          if ((currentCharacter === "'" || currentCharacter === '"' || currentCharacter === '`') && currentLine[characterIndex - 1] !== '\\') {
            if (!isInsideString) { 
              isInsideString = true
              activeStringCharacter = currentCharacter 
            } else if (activeStringCharacter === currentCharacter) { 
              isInsideString = false 
            }
          }
          
          if (!isInsideString && currentCharacter === '/' && currentLine[characterIndex + 1] === '/') {
            break
          }
          
          codeContentWithoutComments += currentCharacter
        }
        
        const codeCleanedFromBlockComments = codeContentWithoutComments.replace(/\/\*[\s\S]*?\*\//g, '')
        const trimmedCodeLine = codeCleanedFromBlockComments.trim()
        
        const openBracesMatch = codeCleanedFromBlockComments.match(/[\{\[\(]/g)
        const closeBracesMatch = codeCleanedFromBlockComments.match(/[\}\]\)]/g)
        
        const openDepthCount = openBracesMatch ? openBracesMatch.length : 0
        const closeDepthCount = closeBracesMatch ? closeBracesMatch.length : 0
        
        const previousBlockDepth = currentBlockDepth
        currentBlockDepth = currentBlockDepth + openDepthCount - closeDepthCount

        if (previousBlockDepth !== 0 || currentBlockDepth !== 0) return currentLine

        if (!trimmedCodeLine) return currentLine
        if (/^(const|let|var|function|class|if|else|for|while|do|switch|case|import|export|try|catch|finally|return|throw|await)\b/.test(trimmedCodeLine)) return currentLine
        if (trimmedCodeLine.startsWith('.')) return currentLine
        if (trimmedCodeLine.startsWith('console.')) return currentLine
        if (/[^=!<>]=[^=>]/.test(trimmedCodeLine)) return currentLine 
        if (/[+\-*/=&\?|:]$/.test(trimmedCodeLine)) return currentLine

        const nextLineContent = textLines[lineIndex + 1]?.trim() || ''
        if (nextLineContent.startsWith('.')) return currentLine

        const safeStringLabel = trimmedCodeLine.replace(/;$/, '').replace(/'/g, "\\'").replace(/"/g, '\\"')
        
        return `__logsArray.push({ type: 'return', label: '${safeStringLabel}', value: (\n${currentLine.replace(/;$/, '')}\n) });`
      }).join('\n')

      const wrappedExecutionCode = `
        try {
          const finalExecutionResult = eval(${JSON.stringify(transformedCodeContent)});
          return { finalExecutionResult, capturedLogsArray: __logsArray };
        } catch(executionError) {
          throw executionError;
        }
      `

      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      const executionFunction = new Function('Analyze', 'AST', 'ErrorLog', 'console', '__logsArray', wrappedExecutionCode)
      const executionResultData = executionFunction(Analyze, AST, ErrorLog, fakeConsole, capturedLogsArray) as { finalExecutionResult: unknown; capturedLogsArray: OutputLogType[] }

      if (executionResultData.capturedLogsArray.length > 0) {
        setOutputLogs(executionResultData.capturedLogsArray)
      } else if (executionResultData.finalExecutionResult !== undefined) {
        setOutputLogs([{ type: 'return', label: t.result, value: executionResultData.finalExecutionResult }])
      } else {
        setOutputLogs([])
      }

    } catch (errorDetails: unknown) {
      setErrorMessage(errorDetails instanceof Error ? errorDetails.message : String(errorDetails))
      setOutputLogs([])
    } finally {
      setIsExecutingCode(false)
    }
  }

  // Run on mount and re-run whenever the engine (i.e. selected version) changes,
  // so switching v4 ↔ v3 re-evaluates the sample against the other engine.
  useEffect(() => {
    if (engine) executeCode()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, version])

  const formatOutputValue = (valueData: unknown): string => {
    if (typeof valueData === 'string') return valueData
    if (valueData === undefined) return 'undefined'
    if (valueData === null) return 'null'
    if (typeof valueData === 'function') return '[Function]'
    try {
      return JSON.stringify(valueData, null, 2)
    } catch {
      return String(valueData)
    }
  }

  const mainContainerClasses = isFullscreenMode
    ? 'fixed inset-0 z-[100] flex flex-col bg-zinc-950/95 backdrop-blur-xl'
    : 'relative z-50 my-6 overflow-hidden rounded-xl border border-border/80 bg-zinc-950/80 shadow-md backdrop-blur-sm'

  const gridContainerClasses = isFullscreenMode
    ? 'flex-1 grid grid-cols-1 md:grid-cols-2 divide-y md:divide-x md:divide-y-0 divide-border/50 bg-zinc-950 h-full'
    : 'grid grid-cols-1 md:grid-cols-2 divide-y md:divide-x md:divide-y-0 divide-border/50 bg-zinc-950'

  return (
    <div className={mainContainerClasses}>
      <div className="flex items-center justify-between border-b border-border/50 bg-zinc-900/50 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
            <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
            <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
          </div>
          <span className="ml-2 text-xs font-medium text-zinc-400">{t.title}</span>
          <span
            className="ml-1 rounded-full bg-zinc-800 px-2 py-0.5 text-[0.625rem] font-semibold text-zinc-300 ring-1 ring-white/10"
            title={`Engine: ${ENGINE_RELEASES[version].engine}`}
          >
            {ENGINE_RELEASES[version].short} · {ENGINE_RELEASES[version].engine}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsFullscreenMode(!isFullscreenMode)}
            className="flex items-center justify-center rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
            title={isFullscreenMode ? t.exitFullscreen : t.fullscreen}
          >
            {isFullscreenMode ? <Minimize className="h-3.5 w-3.5" /> : <Maximize className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={() => { setCodeContent(initialCode.trim()); setTimeout(executeCode, 50); }}
            className="flex items-center justify-center rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
            title={t.reset}
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={executeCode}
            disabled={isExecutingCode}
            className="flex items-center justify-center gap-1.5 rounded-md bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-400 transition-colors hover:bg-emerald-500/20 active:scale-95 disabled:opacity-50"
          >
            <Play className="h-3 w-3" />
            {t.run}
          </button>
        </div>
      </div>

      <div className={gridContainerClasses}>
        <div className="relative flex flex-col group/editor h-full">
          <span className="absolute right-4 top-3 text-[0.65rem] font-bold uppercase tracking-wider text-zinc-600 transition-colors group-focus-within/editor:text-emerald-500/50 pointer-events-none z-10">
            {t.editor}
          </span>
          <div
            className="w-full pt-10 pb-4 transition-all duration-200"
            style={{ height: isFullscreenMode ? '100%' : editorContainerHeight }}
          >
            <Editor
              height="100%"
              language="typescript"
              path={`index-${uniqueComponentId}.ts`}
              theme="vs-dark"
              value={codeContent}
              onChange={value => setCodeContent(value || '')}
              onMount={(editorInstance) => {
                const updateEditorHeight = () => {
                  if (!isFullscreenMode) {
                    const contentHeight = editorInstance.getContentHeight()
                    setEditorContainerHeight(Math.max(150, contentHeight + 80))
                  }
                }
                
                editorInstance.onDidContentSizeChange(updateEditorHeight)
                updateEditorHeight()
              }}
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                lineNumbersMinChars: 3,
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                padding: { top: 24, bottom: 24 },
                overviewRulerLanes: 0,
                hideCursorInOverviewRuler: true,
                scrollbar: { vertical: 'hidden', horizontal: 'hidden' },
                automaticLayout: true,
              }}
            />
          </div>
        </div>

        <div className="relative flex flex-col bg-black h-full">
          <span className="absolute right-4 top-3 text-[0.65rem] font-bold uppercase tracking-wider text-zinc-600 pointer-events-none z-10">
            {t.output}
          </span>
          <div className="h-full w-full overflow-auto p-5 pt-10 font-mono text-[0.8125rem] leading-relaxed">
            {errorMessage ? (
              <div className="flex items-start gap-2 text-rose-400">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="whitespace-pre-wrap break-words">{errorMessage}</span>
              </div>
            ) : outputLogs.length > 0 ? (
              <div className="flex flex-col gap-5">
                {outputLogs.map((logItem, logIndex) => (
                  <div key={logIndex} className="flex flex-col gap-1.5">
                    {logItem.type === 'return' && logItem.label && (
                      <span className="text-zinc-500 select-none">// {logItem.label}</span>
                    )}
                    <pre className={`whitespace-pre-wrap break-words ${logItem.type === 'error' ? 'text-rose-400' : logItem.type === 'warn' ? 'text-amber-300' : 'text-emerald-300/90'}`}>
                      {formatOutputValue(logItem.value)}
                    </pre>
                  </div>
                ))}
              </div>
            ) : (
              <span className="text-zinc-600 italic">{t.noOutput}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}