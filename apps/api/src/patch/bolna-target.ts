import type { LivePrompt, TargetAdapter, TargetRef } from "../../../../packages/core/src/seam.ts";
import { readLiveAgent } from "../queue/bolna";
import { bolnaLanguage, withLongerSilence, withTranscriberLanguage, withoutModelHangup } from "./live-agent";

type AgentIo = {
  readAgent: (agentId: string) => Promise<unknown>;
  writeAgent: (agentId: string, body: unknown) => Promise<void>;
};

/** The prompt the patch block reads. Demo agents use the demo key. */
export async function fetchDeskPrompt(agentId: string): Promise<LivePrompt> {
  const live = await readLiveAgent(agentId);
  return {
    text: live.systemPrompt,
    fields: [],
    transcriberLanguage: live.transcriberLanguage,
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * The patch GET and PUT. The write still updates the transcriber, the model hangup, and the silence
 * floor in the same request as the prompt. The desk transcript is not fetched here.
 */
export function bolnaTargetAdapter(
  io: AgentIo,
  patch: {
    requestedLanguage: string;
    languageSwitchBelow3: boolean;
    heardHindi: boolean;
    onTranscriber: (info: { flipped: boolean; from: string | null; to: string | null }) => void;
  },
): TargetAdapter {
  return {
    provider: "bolna",
    async fetchPrompt(target) {
      const agent = asRecord(await io.readAgent(agentIdOf(target)));
      const prompts = asRecord(agent.agent_prompts);
      const task1 = asRecord(prompts.task_1);
      return {
        text: typeof task1.system_prompt === "string" ? task1.system_prompt : "",
        fields: [],
        transcriberLanguage: null,
        fetchedAt: new Date().toISOString(),
      };
    },
    async writePrompt(target, next) {
      const agentId = agentIdOf(target);
      const agent = asRecord(await io.readAgent(agentId));
      const nextLanguage = bolnaLanguage(patch.requestedLanguage, agent.tasks);
      const updated = withTranscriberLanguage(agent.tasks, {
        languageSwitchBelow3: patch.languageSwitchBelow3,
        heardHindi: patch.heardHindi,
        nextLanguage,
      });
      const silenced = withoutModelHangup(updated.tasks);
      const slower = withLongerSilence(silenced.tasks);
      patch.onTranscriber({ flipped: updated.flipped, from: updated.from, to: updated.to });
      if (updated.flipped) console.log(`transcriber ${updated.from} -> ${updated.to}`);
      if (silenced.changed) console.log("model hangup off");
      if (slower.changed) console.log("silence hangup raised");
      await io.writeAgent(agentId, {
        agent_config: {
          agent_name: agent.agent_name,
          agent_type: agent.agent_type,
          agent_welcome_message: agent.agent_welcome_message,
          webhook_url: agent.webhook_url,
          tasks: slower.tasks,
          ingest_source_config: agent.ingest_source_config,
          calling_guardrails: agent.calling_guardrails,
          call_summary_enabled: agent.call_summary_enabled,
        },
        agent_prompts: { task_1: { system_prompt: next.text } },
        composition_by_language: { en: [{ type: "text", text: next.text }] },
      });
    },
    async fetchTranscript() {
      return null;
    },
  };
}

export function targetRefFor(agentId: string, categoryId = "clinic"): TargetRef {
  return {
    id: agentId,
    tenantId: "demo",
    provider: "bolna",
    address: { kind: "provider_agent", provider: "bolna", agentId },
    categoryId,
    categoryVersion: "file",
  };
}

function agentIdOf(target: TargetRef): string {
  if (target.address.kind === "provider_agent" && target.address.agentId) return target.address.agentId;
  return target.id;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : {};
}
