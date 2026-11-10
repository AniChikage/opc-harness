/** Compile-only assertions: tsc must reject invalid public contracts. */
import type { PaymentMode, StackId, ProjectConfig } from '../src/types.mjs';
import type { WorkerEnv } from '../templates/paid-site/worker.mjs';

const payment: PaymentMode = 'stripe_test';
const stack: StackId = 'cloudflare';
// @ts-expect-error Live payments are outside the supported contract.
const unsupportedPayment: PaymentMode = 'stripe_live';
// @ts-expect-error Unknown providers must be rejected.
const unsupportedStack: StackId = 'unknown';
// @ts-expect-error A project requires validated design, payment and deployment settings.
const incompleteProject: ProjectConfig = { schemaVersion: 1, name: 'example' };
// @ts-expect-error A database binding must implement the statement interface.
const invalidWorker: WorkerEnv = { DB: { prepare: () => null } };
void [payment, stack, unsupportedPayment, unsupportedStack, incompleteProject, invalidWorker];
