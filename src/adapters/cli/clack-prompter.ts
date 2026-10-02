import { confirm, isCancel, log, multiselect, select } from '@clack/prompts';
import type { McpItem } from '../../domain/catalog/schema.js';
import type { ChangePlan, PlannedItem } from '../../domain/plan/change-plan.js';
import type { Scope } from '../../ports/agent-target.js';
import { PromptCancelled } from '../../ports/prompter.js';
import type { Prompter } from '../../ports/prompter.js';

/** Unwraps a clack answer, turning a dismissed prompt into PromptCancelled. */
function answer<T>(value: T | symbol): T {
  if (isCancel(value)) throw new PromptCancelled();
  return value as T;
}

export class ClackPrompter implements Prompter {
  async selectMcps(options: McpItem[]): Promise<string[]> {
    return answer<string[]>(
      await multiselect({
        message: 'Which MCP servers do you want to install?',
        options: options.map((m) => ({ value: m.name, label: m.name, hint: m.description })),
        required: true,
      }),
    );
  }

  async selectScope(): Promise<Scope> {
    return answer<Scope>(
      await select<Scope>({
        message: 'Where should they be installed?',
        options: [
          { value: 'project', label: 'Project', hint: './.mcp.json' },
          { value: 'user', label: 'User', hint: '~/.claude.json' },
        ],
      }),
    );
  }

  async resolveConflict(item: PlannedItem): Promise<'overwrite' | 'skip'> {
    return answer<'overwrite' | 'skip'>(
      await select<'overwrite' | 'skip'>({
        message: `'${item.name}' already exists with different content (${item.reason ?? 'conflict'}). What now?`,
        options: [
          { value: 'skip', label: 'Keep the existing entry' },
          { value: 'overwrite', label: 'Overwrite it' },
        ],
      }),
    );
  }

  async confirm(plan: ChangePlan): Promise<boolean> {
    const files = plan.files.length;
    return answer<boolean>(await confirm({ message: `Apply the changes to ${files} file${files === 1 ? '' : 's'}?` }));
  }

  info(message: string): void {
    log.info(message);
  }
}
