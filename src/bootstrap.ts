import { initializeDatabaseSaves } from './saves/CloudSaves';
// Hydrate the database save before importing any gameplay module or running map migrations.
await initializeDatabaseSaves();
await import('./main');
