import type { Profile, PlannedSession, Task } from "@/lib/types";

/**
 * Calls Groq's OpenAI-compatible chat completions endpoint to generate
 * human-friendly explanations for each planned session and a weekly summary.
 *
 * Returns null on any failure (timeout, rate limit, bad JSON, missing keys)
 * so the caller can fall back to deterministic reasons.
 */
export async function explainPlan(
  tasks: Task[],
  sessions: PlannedSession[],
  profile: Profile,
): Promise<{ reasons: Array<{ index: number; reason: string }>; summary: string } | null> {
  const apiKey = process.env.LLM_API_KEY;
  const model = process.env.LLM_MODEL ?? "llama-3.3-70b-versatile";

  if (!apiKey) {
    // No API key configured — silently fall back to deterministic reasons.
    console.error("[LLM] No LLM_API_KEY configured");
    return null;
  }

  // Build a compact task list for the prompt
  const taskList = tasks
    .filter((t) => sessions.some((s) => s.task_id === t.id))
    .map((t) => ({
      id: t.id,
      title: t.title,
      deadline: t.deadline,
      grade_weight: Number(t.grade_weight),
      difficulty: Number(t.difficulty),
    }));

  // Build session list with indices for the model to reference
  const sessionList = sessions.map((s, i) => ({
    index: i,
    task_id: s.task_id,
    start: s.start,
    end: s.end,
  }));

  const systemPrompt = `You are a study planner assistant. Given a list of tasks and their scheduled sessions for the week, return a JSON object with two fields:
- "reasons": an array of objects, each with "index" (matching the session index) and "reason" (one friendly sentence, ≤140 characters, explaining why that study block is placed there — consider deadline urgency, grade weight, difficulty)
- "summary": 1–2 sentences summarizing the week's plan.

Return ONLY valid JSON. Do not include markdown, commentary, or any other text.`;

  const userPrompt = `Tasks:
${JSON.stringify(taskList, null, 2)}

Sessions (in order):
${JSON.stringify(sessionList, null, 2)}

Timezone: ${profile.timezone}
Sleep: ${profile.sleep_start}–${profile.sleep_end}
Max work hours/day: ${profile.work_hours_per_day}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8_000);

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
        max_tokens: 800,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      // Rate limit, auth error, or other provider error — fall back silently.
      console.error(`[LLM] Groq API error: ${response.status} ${response.statusText}`);
      const text = await response.text().catch(() => "");
      if (text) console.error(`[LLM] Response body: ${text}`);
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content || typeof content !== "string") {
      return null;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      console.error(`[LLM] JSON parse error: ${e}`);
      return null;
    }

    // Validate shape by hand
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !Array.isArray((parsed as Record<string, unknown>).reasons) ||
      typeof (parsed as Record<string, unknown>).summary !== "string"
    ) {
      console.error("[LLM] Invalid response shape", parsed);
      return null;
    }

    const { reasons, summary } = parsed as {
      reasons: unknown[];
      summary: string;
    };

    // Validate each reason entry
    const validatedReasons = reasons
      .map((r) => {
        if (
          typeof r !== "object" ||
          r === null ||
          typeof (r as Record<string, unknown>).index !== "number" ||
          typeof (r as Record<string, unknown>).reason !== "string"
        ) {
          return null;
        }
        const { index, reason } = r as { index: number; reason: string };
        // Index must match a session position
        if (index < 0 || index >= sessions.length) {
          return null;
        }
        // Clamp reason to 140 chars
        const clamped = reason.slice(0, 140);
        return { index, reason: clamped };
      })
      .filter((r): r is { index: number; reason: string } => r !== null);

    // Must have a reason for every session (or at least a valid subset)
    if (validatedReasons.length === 0) {
      console.error("[LLM] No valid reasons after filtering");
      return null;
    }

    return { reasons: validatedReasons, summary: summary.slice(0, 280) };
  } catch (e) {
    // Any error (timeout, network, parse) — fall back silently.
    console.error(`[LLM] Unexpected error: ${e}`);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}