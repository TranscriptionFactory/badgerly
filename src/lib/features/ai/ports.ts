import type {
  AiExecutionResult,
  AiPortRequest,
  AiProvider,
} from "$lib/features/ai/domain/ai_types";

export interface AiPort {
  check_cli(provider: AiProvider): Promise<boolean>;
  execute(input: AiPortRequest): Promise<AiExecutionResult>;
}
