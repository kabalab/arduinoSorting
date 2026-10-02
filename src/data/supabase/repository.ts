import type { StoreData } from "@/src/domain/types";
import type { Repository } from "@/src/data/repository";

/**
 * Supabase adapter seam. This file does not invent a database schema.
 * When tables and auth exist, map them here and keep the same Repository
 * interface so the UI and domain rules stay unchanged.
 *
 * Records the mapper must cover:
 * - users
 * - groups
 * - items
 * - item request blacklists
 * - ledger
 * - requests
 * - request lines
 * - credentials (server-only access-code hashes, plus the code encrypted so an admin can view it)
 *
 * Row Level Security should later match the checks server actions already
 * make: members can read shared items except those blacklisted for their
 * group, and only their own requests. Stock changes and approvals stay
 * admin-only on the server.
 */
function notMapped(): never {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("DATA_PROVIDER=supabase requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }
  throw new Error("Supabase tables are not mapped yet. Add the schema mapping in src/data/supabase before using this provider.");
}

export const supabaseRepository: Repository = {
  async read(): Promise<StoreData> {
    notMapped();
  },
  async update<T>(): Promise<T> {
    notMapped();
  },
};
