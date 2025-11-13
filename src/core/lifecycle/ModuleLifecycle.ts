/**
 * Modül yaşam döngüsü yönetimi.
 */

export enum LifecycleState {
  CREATED = 'created',
  INITIALIZING = 'initializing',
  INITIALIZED = 'initialized',
  ACTIVATING = 'activating',
  ACTIVE = 'active',
  DEACTIVATING = 'deactivating',
  DEACTIVATED = 'deactivated',
  DESTROYING = 'destroying',
  DESTROYED = 'destroyed',
  ERROR = 'error',
}

export class ModuleLifecycle {
  private state: LifecycleState = LifecycleState.CREATED;
  private moduleName: string;

  constructor(moduleName: string) {
    this.moduleName = moduleName;
  }

  get module(): string {
    return this.moduleName;
  }

  get currentState(): LifecycleState {
    return this.state;
  }

  canInitialize(): boolean {
    return this.state === LifecycleState.CREATED;
  }

  canActivate(): boolean {
    return this.state === LifecycleState.INITIALIZED || this.state === LifecycleState.DEACTIVATED;
  }

  canDeactivate(): boolean {
    return this.state === LifecycleState.ACTIVE || this.state === LifecycleState.ACTIVATING;
  }

  canDestroy(): boolean {
    return (
      this.state === LifecycleState.CREATED ||
      this.state === LifecycleState.INITIALIZED ||
      this.state === LifecycleState.DEACTIVATED ||
      this.state === LifecycleState.ERROR
    );
  }

  markInitializing(): void {
    if (!this.canInitialize()) {
      throw new Error(`Cannot initialize module ${this.moduleName} in state ${this.state}`);
    }
    this.state = LifecycleState.INITIALIZING;
  }

  markInitialized(): void {
    if (this.state !== LifecycleState.INITIALIZING) {
      throw new Error(`Cannot mark as initialized in state ${this.state}`);
    }
    this.state = LifecycleState.INITIALIZED;
  }

  markActivating(): void {
    if (!this.canActivate()) {
      throw new Error(`Cannot activate module ${this.moduleName} in state ${this.state}`);
    }
    this.state = LifecycleState.ACTIVATING;
  }

  markActive(): void {
    if (this.state !== LifecycleState.ACTIVATING) {
      throw new Error(`Cannot mark as active in state ${this.state}`);
    }
    this.state = LifecycleState.ACTIVE;
  }

  markDeactivating(): void {
    if (!this.canDeactivate()) {
      throw new Error(`Cannot deactivate module ${this.moduleName} in state ${this.state}`);
    }
    this.state = LifecycleState.DEACTIVATING;
  }

  markDeactivated(): void {
    if (this.state !== LifecycleState.DEACTIVATING) {
      throw new Error(`Cannot mark as deactivated in state ${this.state}`);
    }
    this.state = LifecycleState.DEACTIVATED;
  }

  markDestroying(): void {
    if (!this.canDestroy()) {
      throw new Error(`Cannot destroy module ${this.moduleName} in state ${this.state}`);
    }
    this.state = LifecycleState.DESTROYING;
  }

  markDestroyed(): void {
    if (this.state !== LifecycleState.DESTROYING) {
      throw new Error(`Cannot mark as destroyed in state ${this.state}`);
    }
    this.state = LifecycleState.DESTROYED;
  }

  markError(): void {
    this.state = LifecycleState.ERROR;
  }

  getInfo(): Record<string, any> {
    return {
      module: this.moduleName,
      state: this.state,
      canInitialize: this.canInitialize(),
      canActivate: this.canActivate(),
      canDeactivate: this.canDeactivate(),
      canDestroy: this.canDestroy(),
    };
  }
}

