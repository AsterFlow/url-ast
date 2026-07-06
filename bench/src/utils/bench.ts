import { Bench } from 'tinybench';
import type { BenchResult, SuiteReport } from './types.js';

export interface SuiteConfig {
  name: string;
  description: string;
  durationMs?: number;
  warmup?: boolean;
}

export async function runSuite(
  config: SuiteConfig,
  register: (bench: Bench) => void,
): Promise<SuiteReport> {
  const bench = new Bench({ time: config.durationMs ?? 500, warmup: config.warmup ?? true });
  register(bench);
  await bench.run();

  const sorted = [...bench.tasks].sort((a, b) => {
    const aThroughput = (a.result as any)?.throughput?.mean ?? 0;
    const bThroughput = (b.result as any)?.throughput?.mean ?? 0;
    return bThroughput - aThroughput;
  });

  const results: BenchResult[] = sorted.map((task, index) => {
    const res = task.result!;
    const throughput = (res as any)?.throughput;
    return {
      operation: task.name,
      opsPerSecond: Math.round(throughput?.mean ?? 0),
      latencyNs: (res as any).period * 1_000_000,
      rank: index + 1,
    };
  });

  console.log(`\n--- ${config.name} ---`);
  console.table(bench.table());

  return { name: config.name, description: config.description, results };
}
