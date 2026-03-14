import type {
  AiCliCheckRequest,
  AiExecutionResult,
  AiPortExecuteRequest,
} from "$lib/features/ai/domain/ai_types";

export interface AiPort {
  check_cli(input: AiCliCheckRequest): Promise<boolean>;
  execute(input: AiPortExecuteRequest): Promise<AiExecutionResult>;
}
