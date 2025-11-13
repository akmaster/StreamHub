/**
 * Temel modül interface'i - Tüm modüller bu interface'i implemente eder.
 */

export enum CapsuleType {
  ORIGIN = 'origin',
  PROCESSOR = 'processor',
  MEMORY = 'memory',
  OBSERVER = 'observer',
  BRIDGE = 'bridge',
  PLUGIN = 'plugin',
  COMPOSABLE = 'composable',
}

export interface IModule {
  readonly name: string;
  readonly version: string;
  readonly capsuleType: CapsuleType;
  readonly dependencies: string[];
  readonly exports: string[];

  initialize(): Promise<void>;
  activate(): Promise<void>;
  deactivate(): Promise<void>;
  destroy(): Promise<void>;
  getStatus(): Promise<Record<string, any>>;
  validateDependencies(registry: any): boolean;
}

