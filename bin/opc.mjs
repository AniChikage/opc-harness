#!/usr/bin/env node
import { run } from '../src/cli.mjs';
try { await run(process.argv.slice(2)); }
catch (error) {
  const { redact } = await import('../src/core.mjs');
  const result = { ok: false, error: error.code || 'OPC_ERROR', message: redact(error.message), ...(error.details ? { details: error.details } : {}) };
  console.error(JSON.stringify(result, null, 2));
  process.exitCode = error.exitCode || 1;
}
