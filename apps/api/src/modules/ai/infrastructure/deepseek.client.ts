import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface DeepseekChatOptions {
  system: string;
  user: string;
  /** Force the model to emit a single JSON object. */
  jsonMode?: boolean;
  temperature?: number;
  maxTokens?: number;
  /** Per-request timeout override (ms). */
  timeoutMs?: number;
}

interface DeepseekChatChoice {
  message?: { content?: string | null };
  finish_reason?: string;
}

interface DeepseekChatResponse {
  choices?: DeepseekChatChoice[];
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
}

/**
 * Thin client for the DeepSeek chat-completions API (OpenAI-compatible).
 * Mirrors the codebase's outbound-HTTP convention (native fetch + AbortController,
 * see billing.service.ts) — no axios dependency.
 *
 * The API key is read from DEEPSEEK_API_KEY. When it is absent the client reports
 * `isEnabled() === false` so callers can degrade gracefully instead of crashing.
 */
@Injectable()
export class DeepseekClient {
  private readonly logger = new Logger(DeepseekClient.name);
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly defaultTimeoutMs: number;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('DEEPSEEK_API_KEY')?.trim() ?? '';
    this.baseUrl = (
      this.config.get<string>('DEEPSEEK_BASE_URL')?.trim() || 'https://api.deepseek.com'
    ).replace(/\/+$/, '');
    this.model = this.config.get<string>('DEEPSEEK_MODEL')?.trim() || 'deepseek-chat';
    this.defaultTimeoutMs = Number(this.config.get<string>('DEEPSEEK_TIMEOUT_MS')) || 60_000;
  }

  isEnabled(): boolean {
    return this.apiKey.length > 0;
  }

  getModel(): string {
    return this.model;
  }

  /**
   * Calls chat/completions and returns the raw assistant message text.
   * Throws ServiceUnavailableException on transport/timeout/upstream errors.
   */
  async chat(options: DeepseekChatOptions): Promise<string> {
    if (!this.isEnabled()) {
      throw new ServiceUnavailableException('AI_DISABLED');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      options.timeoutMs ?? this.defaultTimeoutMs,
    );

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: options.system },
            { role: 'user', content: options.user },
          ],
          temperature: options.temperature ?? 0.4,
          max_tokens: options.maxTokens ?? 2400,
          ...(options.jsonMode ? { response_format: { type: 'json_object' } } : {}),
        }),
        signal: controller.signal,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`DeepSeek request failed: ${message}`);
      throw new ServiceUnavailableException('AI_UPSTREAM_ERROR');
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      this.logger.error(`DeepSeek HTTP ${response.status}: ${text.slice(0, 500)}`);
      throw new ServiceUnavailableException('AI_UPSTREAM_ERROR');
    }

    let data: DeepseekChatResponse;
    try {
      data = (await response.json()) as DeepseekChatResponse;
    } catch {
      throw new ServiceUnavailableException('AI_BAD_RESPONSE');
    }

    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new ServiceUnavailableException('AI_EMPTY_RESPONSE');
    }
    if (data.usage?.total_tokens) {
      this.logger.log(`DeepSeek ok — ${data.usage.total_tokens} tokens (${this.model})`);
    }
    return content;
  }

  /**
   * Calls chat in JSON mode and parses the result. Tolerates code-fenced JSON.
   */
  async chatJson<T = unknown>(options: DeepseekChatOptions): Promise<T> {
    const raw = await this.chat({ ...options, jsonMode: true });
    return this.parseJson<T>(raw);
  }

  private parseJson<T>(raw: string): T {
    const cleaned = raw
      .replace(/^\s*```(?:json)?/i, '')
      .replace(/```\s*$/i, '')
      .trim();
    try {
      return JSON.parse(cleaned) as T;
    } catch {
      // Last resort: extract the first {...} block.
      const start = cleaned.indexOf('{');
      const end = cleaned.lastIndexOf('}');
      if (start !== -1 && end > start) {
        try {
          return JSON.parse(cleaned.slice(start, end + 1)) as T;
        } catch {
          /* fall through */
        }
      }
      this.logger.error(`Failed to parse DeepSeek JSON: ${cleaned.slice(0, 300)}`);
      throw new ServiceUnavailableException('AI_BAD_RESPONSE');
    }
  }
}
