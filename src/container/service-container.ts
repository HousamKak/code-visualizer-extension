import { 
  IServiceContainer, 
  ServiceIdentifier, 
  ServiceFactory 
} from '../interfaces/container.interface';

type ServiceRegistration = {
  type: 'class' | 'singleton' | 'factory' | 'instance';
  implementation?: new (...args: any[]) => any;
  factory?: ServiceFactory;
  instance?: any;
  dependencies?: ServiceIdentifier[];
};

export class ServiceContainer implements IServiceContainer {
  private services = new Map<ServiceIdentifier, ServiceRegistration>();
  private singletonInstances = new Map<ServiceIdentifier, any>();
  private resolving = new Set<ServiceIdentifier>();

  register<T>(identifier: ServiceIdentifier<T>, implementation: new (...args: any[]) => T): void {
    this.services.set(identifier, {
      type: 'class',
      implementation,
      dependencies: this.extractDependencies(implementation)
    });
  }

  registerSingleton<T>(identifier: ServiceIdentifier<T>, implementation: new (...args: any[]) => T): void {
    this.services.set(identifier, {
      type: 'singleton',
      implementation,
      dependencies: this.extractDependencies(implementation)
    });
  }

  registerFactory<T>(identifier: ServiceIdentifier<T>, factory: ServiceFactory<T>): void {
    this.services.set(identifier, {
      type: 'factory',
      factory
    });
  }

  registerInstance<T>(identifier: ServiceIdentifier<T>, instance: T): void {
    this.services.set(identifier, {
      type: 'instance',
      instance
    });
  }

  resolve<T>(identifier: ServiceIdentifier<T>): T {
    // Check for circular dependencies
    if (this.resolving.has(identifier)) {
      throw new Error(`Circular dependency detected for service: ${String(identifier)}`);
    }

    const registration = this.services.get(identifier);
    if (!registration) {
      throw new Error(`Service not registered: ${String(identifier)}`);
    }

    this.resolving.add(identifier);

    try {
      switch (registration.type) {
        case 'instance':
          return registration.instance;

        case 'factory':
          return registration.factory!();

        case 'singleton':
          if (this.singletonInstances.has(identifier)) {
            return this.singletonInstances.get(identifier);
          }
          const singletonInstance = this.createInstance(registration);
          this.singletonInstances.set(identifier, singletonInstance);
          return singletonInstance;

        case 'class':
          return this.createInstance(registration);

        default:
          throw new Error(`Unknown registration type for service: ${String(identifier)}`);
      }
    } finally {
      this.resolving.delete(identifier);
    }
  }

  isRegistered<T>(identifier: ServiceIdentifier<T>): boolean {
    return this.services.has(identifier);
  }

  clear(): void {
    this.services.clear();
    this.singletonInstances.clear();
    this.resolving.clear();
  }

  getRegisteredServices(): ServiceIdentifier[] {
    return Array.from(this.services.keys());
  }

  private createInstance(registration: ServiceRegistration): any {
    if (!registration.implementation) {
      throw new Error('No implementation found for registration');
    }

    const dependencies = registration.dependencies || [];
    const resolvedDependencies = dependencies.map(dep => this.resolve(dep));
    
    return new registration.implementation(...resolvedDependencies);
  }

  private extractDependencies(implementation: new (...args: any[]) => any): ServiceIdentifier[] {
    // This is a simplified dependency extraction
    // In a real implementation, you might use reflection or decorators
    // For now, we'll return an empty array and handle dependencies manually
    return [];
  }

  // Helper method to manually set dependencies for services
  setDependencies<T>(identifier: ServiceIdentifier<T>, dependencies: ServiceIdentifier[]): void {
    const registration = this.services.get(identifier);
    if (registration) {
      registration.dependencies = dependencies;
    }
  }
}