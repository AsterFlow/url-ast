'use client'

import React, { useState, useEffect } from 'react';
import { Check, Copy, TerminalSquare } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';

export interface CommandOption {
  tabName: string;
  commandString: string;
}

export interface TerminalCommandSelectorProps<Options extends CommandOption[]> {
  commandOptions: Options;
  defaultTabName?: Options[number]['tabName'];
}

export function TerminalCommandSelector<Options extends CommandOption[]>({
  commandOptions,
  defaultTabName,
}: TerminalCommandSelectorProps<Options>) {
  const initialTab = defaultTabName ?? commandOptions[0]?.tabName ?? '';
  const [activeTabName, setActiveTabName] = useState<string>(initialTab);
  const [hasCopiedText, setHasCopiedText] = useState<boolean>(false);

  useEffect(() => {
    let timeoutIdentifier: number;

    if (hasCopiedText) {
      timeoutIdentifier = window.setTimeout(() => {
        setHasCopiedText(false);
      }, 2000);
    }

    return () => {
      if (timeoutIdentifier) {
        window.clearTimeout(timeoutIdentifier);
      }
    };
  }, [hasCopiedText]);

  const handleCopyToClipboard = async () => {
    const currentCommandOption = commandOptions.find(
      (optionDetail) => optionDetail.tabName === activeTabName
    );

    if (currentCommandOption) {
      await navigator.clipboard.writeText(currentCommandOption.commandString);
      setHasCopiedText(true);
    }
  };

  if (commandOptions.length === 0) {
    return null;
  }

  return (
    <div className="w-full max-w-2xl rounded-lg border border-zinc-800 bg-zinc-950 text-zinc-50 overflow-hidden">
      <Tabs
        defaultValue={initialTab}
        value={activeTabName}
        onValueChange={setActiveTabName}
        className="w-full"
      >
        <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/50 px-3 py-2">
          <div className="flex items-center gap-3">
            <TerminalSquare className="h-4 w-4 text-zinc-400" />
            <TabsList className="h-8 bg-transparent p-0 gap-1">
              {commandOptions.map((optionDetail) => (
                <TabsTrigger
                  key={optionDetail.tabName}
                  value={optionDetail.tabName}
                  className="rounded-md px-3 py-1.5 text-xs font-medium text-zinc-400 transition-colors data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-50 hover:text-zinc-300"
                >
                  {optionDetail.tabName}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleCopyToClipboard}
            className="h-8 w-8 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-50"
          >
            {hasCopiedText ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            <span className="sr-only">Copiar comando</span>
          </Button>
        </div>

        {commandOptions.map((optionDetail) => (
          <TabsContent
            key={optionDetail.tabName}
            value={optionDetail.tabName}
            className="px-4 py-3.5 mt-0 font-mono text-sm text-zinc-300 bg-zinc-950"
          >
            {optionDetail.commandString}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}