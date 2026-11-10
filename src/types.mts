/** Shared contracts for input, validated projects and the portable runtime. */
export type PaymentMode = 'none' | 'demo' | 'stripe_test';
export type StackId = 'cloudflare' | 'vercel' | 'static';
export type HostId = 'codex' | 'claude';
export type Entries = Record<string, string | Buffer>;
export type Hashes = Record<string, string>;
export interface ContentItem { name: string; category: string; description: string; url?: string; }
export interface EventContent { startsAt: string; endsAt: string; location: string; }
export interface SiteContent { brand?: string; headline?: string; description?: string; contactEmail?: string; accent?: string; items?: ContentItem[]; event?: EventContent; }
export interface ResolvedSite extends SiteContent { brand: string; headline: string; description: string; contactEmail: string; accent: string; }
export interface Product { sku?: 'starter'; amount: number; currency: string; }
export interface Profile {
  schemaVersion: 1;
  design: { preset: 'editorial'; template?: string; };
  site?: SiteContent;
  payments: { mode: PaymentMode; product?: Product; };
  deploy: { provider: StackId; tier: 'preview'; databaseNamespace?: string; };
}
export interface ProjectConfig extends Profile { name: string; brief?: string; }
/** Unvalidated CLI and programmatic options are checked before becoming configuration. */
export interface Options {
  [key: string]: unknown;
  template?: string; stack?: string; recipe?: string; payment?: string; host?: string;
  name?: string; dir?: string; profile?: string; brief?: string; brand?: string;
  headline?: string; description?: string; accent?: string; email?: string;
  amount?: string | number; currency?: string; port?: string | number; url?: string;
  out?: string; home?: string; site?: SiteContent; type?: string; expectedBuild?: string;
  'site-config'?: string; 'project-config'?: string; 'reuse-database-from'?: string;
  'codex-home'?: string; 'claude-home'?: string;
  json?: boolean; 'dry-run'?: boolean; global?: boolean; interactive?: boolean; accept?: boolean; help?: boolean;
}
export interface TemplateDefinition { id: string; name: string; category: string; description: string; brand: string; headline: string; descriptionText: string; accent: string; payment: PaymentMode; features: string[]; }
export interface FrontendModule { id: string; name: string; description: string; templates: string[]; }
export interface StackModule { id: StackId; name: string; runtime: string; payments: PaymentMode[]; data: string; deploy: string; account: string; docs: string; }
export interface PaymentModule { id: PaymentMode; name: string; description: string; stacks: StackId[]; }
export interface Recipe { id: string; name: string; description: string; template: string; stack: StackId; payment: PaymentMode; }
export interface Reference { name: string; url: string; note: string; }
export interface Check { name: string; pass: boolean; action?: string; error?: string; note?: string; drifted?: Drift[]; }
export interface Drift { file: string; reason: string; }
export interface DesignFile { kind: 'structure' | 'style' | 'behavior'; hash: string; }
export interface DesignLock { schemaVersion: 1; template: string; files: Record<string, DesignFile>; }
export interface EvidenceResult { ok: boolean; [key: string]: unknown; }
export interface EvidenceRecord extends EvidenceResult { schemaVersion: number; kind: string; harnessVersion: string; nodeVersion: string; at: string; fingerprint: string; url?: string; buildId?: string; checks?: Check[]; status?: string; scope?: string; mode?: PaymentMode; stale?: boolean; evidence?: string; }
export interface EvidenceState { schemaVersion?: number; capabilities: Record<string, EvidenceRecord>; updatedAt?: string; }
export interface Manifest { schemaVersion: number; files: Hashes; blocks?: Hashes; }
export interface GlobalManifest { schemaVersion: number; version?: string; files: Hashes; blocks: Hashes; }
export interface GlobalMarker { schemaVersion: number; version: string; home: string; profile: string; hosts: HostId[]; instructions: Record<string, string>; skills: Record<string, string>; }
export interface DatabaseBinding { binding: string; database_name: string; database_id: string; migrations_dir?: string; migrations_table?: string; }
export interface WranglerConfig { name: string; main?: string; account_id?: string; vars?: Record<string, string>; d1_databases?: DatabaseBinding[]; [key: string]: unknown; }
export interface WorkerVersion { id: string; metadata?: { created_on?: string }; annotations?: Record<string, string>; }
export interface RemoteDatabase { uuid: string; name: string; }
export interface SharedDatabase { sourceProject: string; sourceDatabaseId: string; namespace: string; [key: string]: unknown; }
export interface Resources {
  schemaVersion: number; workerName: string; accountId?: string; workerCreatedByHarness?: boolean;
  workerVersionId?: string; databaseId?: string; databaseName?: string; url?: string; buildId?: string; lastDeploymentTag?: string; updatedAt?: string;
  sharedDatabase?: SharedDatabase;
  pendingCreation: {
    database?: { name: string; accountId: string; absenceConfirmed: boolean; at: string; };
    worker?: { tag: string; buildId: string; accountId: string; name: string; at: string; previousVersionId: string | null; };
  };
}
export interface VercelRecord { schemaVersion: number; projectId: string; teamId: string | null; buildId: string; releaseId: string; status: string; deploymentId?: string; url?: string; }
export interface HttpBody { ok?: boolean; app?: string; name?: string; mode?: string; configured?: boolean; buildId?: string; status?: string; orderId?: string; token?: string; url?: string; entitlement?: { downloadUrl?: string; product?: string } | null; }
export interface ClientSiteConfig extends ResolvedSite { template?: string; mode: PaymentMode; price: string; product?: Product; items?: ContentItem[]; event?: EventContent; }

export interface StudioTemplate extends TemplateDefinition { type: string; preview: string; references: Reference[]; }
export interface StudioCatalog { version: string; templates: StudioTemplate[]; frontends: FrontendModule[]; stacks: StackModule[]; payments: PaymentModule[]; recipes: Recipe[]; }

export interface DesignStatus {locked:boolean;ok:boolean;template:string|null;checked:number;drifted:Drift[];action?:string}
export interface DesignAcceptance {ok:true;accepted:boolean;template:string;checked:number;note:string}
