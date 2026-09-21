export const backendMigration = Object.freeze({
  tngBackendEnabled: import.meta.env.VITE_TNG_BACKEND_ENABLED === 'true',
  base44FunctionsEnabled: import.meta.env.VITE_ENABLE_BASE44_FUNCTIONS === 'true',
});
