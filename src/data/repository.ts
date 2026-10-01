import type { StoreData } from "@/src/domain/types";

/**
 * Persistence seam for every domain record:
 * users, credentials, groups, items, item request blacklists,
 * ledger, requests, request lines, and settings.
 *
 * Server actions apply domain rules first, then commit the next
 * snapshot through this interface. A later Supabase mapper stays
 * inside src/data/supabase and does not change the UI.
 */
export interface Repository {
  read(): Promise<StoreData>;
  update<T>(mutate: (store: StoreData) => { store: StoreData; result: T }): Promise<T>;
}
