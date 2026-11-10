#!/usr/bin/env node
import { run } from '../src/cli.mjs';
try { await run(process.argv.slice(2)); }
catch (error) {
  const { redact, errorInfo } = await import('../src/core.mjs');
  const failure = errorInfo(error);
  const result = { ok: false, error: failure.code || 'OPC_ERROR', message: redact(failure.message), ...(failure.details ? { details: failure.details } : {}) };
  console.error(JSON.stringify(result, null, 2));
  process.exitCode = failure.exitCode || 1;
}
