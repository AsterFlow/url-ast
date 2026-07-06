import type { SuiteReport } from './types.js';

function formatOps(ops: number): string {
  return ops.toLocaleString('en-US');
}

function formatLatency(ns: number): string {
  return ns.toFixed(2);
}

export function buildMarkdownReport(reports: SuiteReport[]): string {
  const reportTables = reports.map(report => {
    const fastest = report.results[0]?.operation ?? '';

    const rows = report.results.map(result => {
      const isFastest = result.operation === fastest;
      const name   = isFastest ? `**${result.operation}**` : result.operation;
      const lat    = isFastest ? `**${formatLatency(result.latencyNs)}**` : formatLatency(result.latencyNs);
      const thr    = isFastest ? `**${formatOps(result.opsPerSecond)}**`  : formatOps(result.opsPerSecond);
      return `| ${name} | ${lat} | ${thr} |`;
    }).join('\n');

    return `### ${report.name}

${report.description}

| Task Name | Latency avg (ns) | Throughput avg (ops/s) |
| :--- | :--- | :--- |
${rows}
`;
  }).join('\n\n');

  return `# 📊 URL-AST Benchmark Report

> Generated: ${new Date().toUTCString()}

The following benchmarks compare **url-ast** against other URL / query-string parsing libraries.
Each section only includes libraries that **natively** implement the tested operation — no shims or regex fallbacks.

> Lower latency is better. Higher throughput is better.

${reportTables}
`;
}
