import { commands } from "$lib/generated/bindings";
import type { ProposalMutationPort } from "$lib/features/assistant/ports";

export function create_proposal_mutation_tauri_adapter(
  vault_id: () => string | null,
): ProposalMutationPort {
  const active_vault = () => {
    const id = vault_id();
    if (!id) throw new Error("No active vault");
    return id;
  };
  return {
    current_vault: vault_id,
    async prepare_rename(from, to) {
      const result = await commands.prepareProposalRename(
        active_vault(),
        from,
        to,
      );
      if (result.status === "error") throw new Error(result.error);
      return result.data;
    },
    async apply_mutations(mutations) {
      const result = await commands.applyProposalMutations(
        active_vault(),
        mutations,
      );
      if (result.status === "error") throw new Error(result.error);
    },
    async anchor_mutations(paths, anchor) {
      const result = await commands.prepareProposalRestore(
        active_vault(),
        paths,
        anchor,
      );
      if (result.status === "error") throw new Error(result.error);
      return result.data;
    },
  };
}
