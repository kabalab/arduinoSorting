import type { Repository } from "./repository";
import { localRepository } from "./local/store";
import { supabaseRepository } from "./supabase/repository";

let repository: Repository | null = null;

export function getRepository(): Repository {
  if (!repository) {
    repository = process.env.DATA_PROVIDER === "supabase" ? supabaseRepository : localRepository;
  }
  return repository;
}
