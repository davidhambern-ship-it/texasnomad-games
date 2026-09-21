import { base44 } from '@/api/base44Client';
import { backendMigration } from '@/config/backendMigration';

export class LegacyBackendDisabledError extends Error {
  constructor(functionName) {
    super(`${functionName} is unavailable while TNG moves off the Base44 backend.`);
    this.name = 'LegacyBackendDisabledError';
    this.code = 'LEGACY_BACKEND_DISABLED';
  }
}

export async function invokeLegacyFunction(functionName, payload) {
  if (!backendMigration.base44FunctionsEnabled) {
    throw new LegacyBackendDisabledError(functionName);
  }

  return base44.functions.invoke(functionName, payload);
}
