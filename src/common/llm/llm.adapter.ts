/**
 * LLMAdapter — provider-agnostic LLM client.
 *
 * Auto-detects provider from env vars in priority order:
 *   1. ANTHROPIC_API_KEY  → Anthropic Claude (default model: claude-sonnet-4-6)
 *   2. OPENROUTER_API_KEY → OpenRouter  (default model: meta-llama/llama-3.1-8b-instruct:free)
 *   3. OPENAI_API_KEY     → OpenAI      (default model: gpt-4o-mini)
 *   4. LLM_API_KEY + LLM_BASE_URL → any OpenAI-compatible endpoint (Gemini, Ollama, etc.)
 *   5. No key             → stub / demo mode
 *
 * Override the model with LLM_MODEL env var regardless of provider.
 */
import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

// ─── Normalised types ────────────────────────────────────────────────────────

export interface NormalizedTool {
  name: string;
  description: string;
  /** JSON Schema object describing the tool's parameters */
  parameters: Record<string, unknown>;
}

export interface NormalizedToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface AgentLoopResult {
  finalText: string;
  toolCallLog: Array<{
    name: string;
    input: Record<string, unknown>;
    result: unknown;
  }>;
}

type Provider = 'anthropic' | 'openai' | 'stub';

// ─── Adapter ─────────────────────────────────────────────────────────────────

@Injectable()
export class LLMAdapter {
  private readonly logger = new Logger('LLMAdapter');
  readonly provider: Provider;
  readonly model: string;
  private readonly anthropic?: Anthropic;
  private readonly openai?: OpenAI;

  constructor() {
    const detected = LLMAdapter.detect();
    this.provider = detected.provider;
    this.model = detected.model;
    this.anthropic = detected.anthropic;
    this.openai = detected.openai;
    this.logger.log(`LLM provider: ${this.provider} | model: ${this.model}`);
  }

  get isStub(): boolean {
    return this.provider === 'stub';
  }

  // ── Single-turn chat (AgentService) ────────────────────────────────────────

  async chat(systemPrompt: string, userMessage: string): Promise<string> {
    if (this.provider === 'anthropic') {
      const resp = await this.anthropic!.messages.create({
        model: this.model,
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      });
      const block = resp.content[0];
      return block.type === 'text' ? block.text : '';
    }

    if (this.provider === 'openai') {
      const resp = await this.openai!.chat.completions.create({
        model: this.model,
        max_tokens: 1024,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
      });
      return resp.choices[0]?.message?.content ?? '';
    }

    throw new Error('LLM not configured — set an API key in .env');
  }

  // ── Agentic tool-use loop (OrchestratorService) ────────────────────────────

  async runAgentLoop(
    systemPrompt: string,
    userMessage: string,
    tools: NormalizedTool[],
    toolHandler: (
      name: string,
      input: Record<string, unknown>,
    ) => Promise<unknown>,
  ): Promise<AgentLoopResult> {
    if (this.provider === 'anthropic') {
      return this.anthropicLoop(systemPrompt, userMessage, tools, toolHandler);
    }
    if (this.provider === 'openai') {
      return this.openaiLoop(systemPrompt, userMessage, tools, toolHandler);
    }
    throw new Error('LLM not configured — set an API key in .env');
  }

  // ── Anthropic loop ─────────────────────────────────────────────────────────

  private async anthropicLoop(
    systemPrompt: string,
    userMessage: string,
    tools: NormalizedTool[],
    toolHandler: (name: string, input: Record<string, unknown>) => Promise<unknown>,
  ): Promise<AgentLoopResult> {
    const anthropicTools: Anthropic.Tool[] = tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters as Anthropic.Tool['input_schema'],
    }));

    const messages: Anthropic.MessageParam[] = [
      { role: 'user', content: userMessage },
    ];

    const toolCallLog: AgentLoopResult['toolCallLog'] = [];

    let response = await this.anthropic!.messages.create({
      model: this.model,
      max_tokens: 2048,
      system: systemPrompt,
      tools: anthropicTools,
      messages,
    });

    while (response.stop_reason === 'tool_use') {
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const block of response.content) {
        if (block.type !== 'tool_use') continue;
        const input = block.input as Record<string, unknown>;
        const result = await toolHandler(block.name, input);
        toolCallLog.push({ name: block.name, input, result });
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify(result),
        });
      }

      messages.push({ role: 'assistant', content: response.content });
      messages.push({ role: 'user', content: toolResults });

      response = await this.anthropic!.messages.create({
        model: this.model,
        max_tokens: 2048,
        system: systemPrompt,
        tools: anthropicTools,
        messages,
      });
    }

    const finalText = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as Anthropic.TextBlock).text)
      .join('');

    return { finalText, toolCallLog };
  }

  // ── OpenAI-compatible loop (OpenAI / OpenRouter / Gemini / etc.) ───────────

  private async openaiLoop(
    systemPrompt: string,
    userMessage: string,
    tools: NormalizedTool[],
    toolHandler: (name: string, input: Record<string, unknown>) => Promise<unknown>,
  ): Promise<AgentLoopResult> {
    const openaiTools: OpenAI.Chat.ChatCompletionTool[] = tools.map((t) => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ];

    const toolCallLog: AgentLoopResult['toolCallLog'] = [];

    let response = await this.openai!.chat.completions.create({
      model: this.model,
      max_tokens: 2048,
      tools: openaiTools,
      tool_choice: 'auto',
      messages,
    });

    while (response.choices[0]?.finish_reason === 'tool_calls') {
      const assistantMessage = response.choices[0].message;
      messages.push(assistantMessage);

      for (const tc of assistantMessage.tool_calls ?? []) {
        if (tc.type !== 'function') continue;
        const input = JSON.parse(tc.function.arguments || '{}') as Record<string, unknown>;
        const result = await toolHandler(tc.function.name, input);
        toolCallLog.push({ name: tc.function.name, input, result });
        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: JSON.stringify(result),
        });
      }

      response = await this.openai!.chat.completions.create({
        model: this.model,
        max_tokens: 2048,
        tools: openaiTools,
        tool_choice: 'auto',
        messages,
      });
    }

    const finalText = response.choices[0]?.message?.content ?? '';
    return { finalText, toolCallLog };
  }

  // ── Provider detection ─────────────────────────────────────────────────────

  private static detect(): {
    provider: Provider;
    model: string;
    anthropic?: Anthropic;
    openai?: OpenAI;
  } {
    const modelOverride = process.env.LLM_MODEL;

    // 1. Anthropic
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (anthropicKey && anthropicKey !== 'your_anthropic_api_key_here') {
      return {
        provider: 'anthropic',
        model: modelOverride || 'claude-sonnet-4-6',
        anthropic: new Anthropic({ apiKey: anthropicKey }),
      };
    }

    // 2. OpenRouter (free tier available — many models)
    const openrouterKey = process.env.OPENROUTER_API_KEY;
    if (openrouterKey) {
      return {
        provider: 'openai',
        model: modelOverride || 'meta-llama/llama-3.1-8b-instruct:free',
        openai: new OpenAI({
          apiKey: openrouterKey,
          baseURL: 'https://openrouter.ai/api/v1',
          defaultHeaders: {
            'HTTP-Referer': 'https://smartyield.app',
            'X-Title': 'SmartYield',
          },
        }),
      };
    }

    // 3. OpenAI
    const openaiKey = process.env.OPENAI_API_KEY;
    if (openaiKey) {
      return {
        provider: 'openai',
        model: modelOverride || 'gpt-4o-mini',
        openai: new OpenAI({ apiKey: openaiKey }),
      };
    }

    // 4. Generic OpenAI-compatible (Gemini, Ollama, Together, etc.)
    //    Set LLM_BASE_URL + LLM_API_KEY + optionally LLM_MODEL
    //    e.g. Gemini: LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
    //                 LLM_API_KEY=<gemini-key>  LLM_MODEL=gemini-1.5-flash
    const customKey = process.env.LLM_API_KEY;
    const customBaseUrl = process.env.LLM_BASE_URL;
    if (customKey && customBaseUrl) {
      return {
        provider: 'openai',
        model: modelOverride || 'gemini-1.5-flash',
        openai: new OpenAI({ apiKey: customKey, baseURL: customBaseUrl }),
      };
    }

    // 5. No key — stub/demo mode
    return { provider: 'stub', model: 'stub' };
  }
}
