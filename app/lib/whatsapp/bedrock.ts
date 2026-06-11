import AnthropicBedrock from "@anthropic-ai/bedrock-sdk"

// Inference profile do Bedrock p/ Claude Haiku 4.5.
// NOTE: confirmar o ID exato contra a conta/região no teste manual do Bedrock — os testes
// unitários mockam o SDK e NÃO validam este valor; um ID errado só falha em runtime (InvokeModel).
const MODEL_ID = "us.anthropic.claude-haiku-4-5-20251001-v1:0"

export type ChatMsg = { role: "user" | "assistant"; content: string }

// Chama o Claude via Bedrock. Retorna o texto da resposta, ou null em QUALQUER erro
// (o orquestrador trata null como "ficar em silêncio"). Credenciais AWS vêm dos envs
// (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_REGION) via a cadeia padrão do SDK.
export const askClaude = async (system: string, messages: ChatMsg[]): Promise<string | null> => {
  try {
    const client = new AnthropicBedrock({ awsRegion: process.env.AWS_REGION ?? "us-east-1" })
    const res = await client.messages.create({ model: MODEL_ID, max_tokens: 400, system, messages })
    const text = res.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim()
    return text || null
  } catch (err) {
    console.error("[whatsapp] erro no Bedrock:", err)
    return null
  }
}
