import { EmptyState } from "@/components/ui/empty-state";

export default function MissingSupply() {
  return <EmptyState title="Supply not found" body="It may have been removed. Ledger history is still on the History page." />;
}
