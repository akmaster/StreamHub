/**
 * Modül kayıt defteri - Dependency Injection ve modül yönetimi.
 */

import { IModule } from '../interfaces/IModule.js';

export interface ModuleFactory {
  (): IModule;
}

export interface ModuleRegistration {
  name: string;
  factory: ModuleFactory;
  dependencies: string[];
  exports: string[];
  singleton: boolean;
  instance?: IModule;
}

export class ModuleRegistry {
  private modules: Map<string, ModuleRegistration> = new Map();
  private exports: Map<string, string[]> = new Map(); // export name -> array of module names (multiple modules can export same interface)
  private resolutionCache: Map<string, IModule> = new Map(); // Resolution cache (optimization - O(1) lookup)
  private resolveAllCache: Map<string, IModule[]> = new Map(); // resolveAll cache (optimization)

  register(
    name: string,
    factory: ModuleFactory,
    dependencies: string[] = [],
    exports: string[] = [],
    singleton: boolean = true
  ): void {
    if (this.modules.has(name)) {
      throw new Error(`Module ${name} is already registered`);
    }

    const registration: ModuleRegistration = {
      name,
      factory,
      dependencies,
      exports,
      singleton,
    };

    this.modules.set(name, registration);

    // Clear caches when new module is registered (optimization)
    this.resolutionCache.clear();
    this.resolveAllCache.clear();

    // Allow multiple modules to export the same interface
    for (const exportName of exports) {
      if (!this.exports.has(exportName)) {
        this.exports.set(exportName, []);
      }
      const moduleList = this.exports.get(exportName)!;
      if (!moduleList.includes(name)) {
        moduleList.push(name);
      }
    }
  }

  resolve<T extends IModule = IModule>(name: string): T {
    // Check cache first (optimization - O(1) lookup)
    if (this.resolutionCache.has(name)) {
      return this.resolutionCache.get(name) as T;
    }

    // First check if it's an export name
    const exportedModules = this.exports.get(name);
    if (exportedModules && exportedModules.length > 0) {
      // If multiple modules export this interface, return the first one
      // For singleton exports, prefer the one that's already instantiated
      let moduleName = exportedModules[0];
      for (const modName of exportedModules) {
        const reg = this.modules.get(modName);
        if (reg && reg.singleton && reg.instance) {
          moduleName = modName;
          break;
        }
      }
      const registration = this.modules.get(moduleName);
      if (registration) {
        let instance: IModule;
        if (registration.singleton) {
          if (!registration.instance) {
            registration.instance = registration.factory();
          }
          instance = registration.instance;
        } else {
          instance = registration.factory();
        }
        
        // Cache result (optimization)
        this.resolutionCache.set(name, instance);
        return instance as T;
      }
    }

    // If not an export name, treat it as a direct module name
    const registration = this.modules.get(name);
    if (!registration) {
      throw new Error(`Module ${name} not found`);
    }

    let instance: IModule;
    if (registration.singleton) {
      if (!registration.instance) {
        registration.instance = registration.factory();
      }
      instance = registration.instance;
    } else {
      instance = registration.factory();
    }

    // Cache result (optimization)
    this.resolutionCache.set(name, instance);
    return instance as T;
  }

  resolveAll<T extends IModule = IModule>(interfaceName?: string): T[] {
    // Check cache first (optimization)
    const cacheKey = interfaceName || '__all__';
    if (this.resolveAllCache.has(cacheKey)) {
      return this.resolveAllCache.get(cacheKey) as T[];
    }

    const instances: T[] = [];

    if (interfaceName) {
      // If interface name is provided, get all modules that export this interface
      const exportedModules = this.exports.get(interfaceName) || [];
      for (const moduleName of exportedModules) {
        try {
          const registration = this.modules.get(moduleName);
          if (!registration) {
            continue;
          }

          let instance: IModule;
          if (registration.singleton) {
            if (!registration.instance) {
              registration.instance = registration.factory();
            }
            instance = registration.instance;
          } else {
            instance = registration.factory();
          }

          instances.push(instance as T);
        } catch (error) {
          console.warn(`Failed to resolve module ${moduleName}:`, error);
        }
      }
    } else {
      // If no interface name, return all modules
      for (const [name, registration] of this.modules.entries()) {
        try {
          let instance: IModule;
          if (registration.singleton) {
            if (!registration.instance) {
              registration.instance = registration.factory();
            }
            instance = registration.instance;
          } else {
            instance = registration.factory();
          }
          instances.push(instance as T);
        } catch (error) {
          console.warn(`Failed to resolve module ${name}:`, error);
        }
      }
    }

    // Cache result (optimization)
    this.resolveAllCache.set(cacheKey, instances);
    return instances;
  }

  has(name: string): boolean {
    return this.modules.has(name) || (this.exports.has(name) && this.exports.get(name)!.length > 0);
  }

  async initializeAll(): Promise<void> {
    const instances = this.resolveAll();
    for (const instance of instances) {
      try {
        await instance.initialize();
      } catch (error) {
        console.error(`Failed to initialize module ${instance.name}:`, error);
        throw error;
      }
    }
  }

  async activateAll(): Promise<void> {
    const instances = this.resolveAll();
    for (const instance of instances) {
      try {
        await instance.activate();
      } catch (error) {
        console.error(`Failed to activate module ${instance.name}:`, error);
        throw error;
      }
    }
  }

  async deactivateAll(): Promise<void> {
    const instances = this.resolveAll();
    for (let i = instances.length - 1; i >= 0; i--) {
      try {
        await instances[i].deactivate();
      } catch (error) {
        console.error(`Failed to deactivate module ${instances[i].name}:`, error);
      }
    }
  }

  async destroyAll(): Promise<void> {
    const instances = this.resolveAll();
    for (let i = instances.length - 1; i >= 0; i--) {
      try {
        await instances[i].destroy();
      } catch (error) {
        console.error(`Failed to destroy module ${instances[i].name}:`, error);
      }
    }
  }
}

