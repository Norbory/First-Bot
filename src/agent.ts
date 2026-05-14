import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { MemorySaver } from "@langchain/langgraph";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { AzureChatOpenAI } from "@langchain/openai";
import { ActivityTypes } from "@microsoft/agents-activity";
import {
  AgentApplicationBuilder,
  TurnContext,
} from "@microsoft/agents-hosting";
import { getDbContextSummary } from "./context/dbContextService";
import { getTableColumnsTool } from "./tools/getTableColumnsTool";
import { getCatalogTableInfoTool } from "./tools/getCatalogTableInfoTool";
import { listTablesByPrefixTool } from "./tools/listTablesByPrefixTool";
import { extractPdfRequirementText } from "./tools/pdfRequirementReader";
import { searchCatalogTablesTool } from "./tools/searchCatalogTablesTool";

export const weatherAgent = new AgentApplicationBuilder().build();

weatherAgent.onConversationUpdate(
  "membersAdded",
  async (context: TurnContext) => {
    await context.sendActivity(
      "Hola, soy tu asistente PL/SQL Oracle para Indra - Mapfre Paraguay. Puedo ayudarte a analizar requerimientos, definir flujo de trabajo."
    );
  }
);

interface WeatherForecastAgentResponse {
  contentType: "Text" | "AdaptiveCard";
  content: string | Record<string, unknown>;
}

let _agent: ReturnType<typeof createReactAgent> | null = null;
const threadContextInjected = new Set<string>();

function getAgent() {
  if (!_agent) {
    const apiKey = process.env.AZURE_OPENAI_API_KEY;
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT_NAME;

    if (!apiKey || !endpoint || !deployment) {
      throw new Error(
        `Faltan variables de entorno de Azure OpenAI. Verifica AZURE_OPENAI_API_KEY, AZURE_OPENAI_ENDPOINT y AZURE_OPENAI_DEPLOYMENT_NAME en .localConfigs`
      );
    }

    const agentModel = new AzureChatOpenAI({
      azureOpenAIApiVersion: "2024-12-01-preview",
      azureOpenAIApiKey: apiKey,
      azureOpenAIEndpoint: endpoint,
      azureOpenAIApiDeploymentName: deployment,
      temperature: 0,
    });

    const agentCheckpointer = new MemorySaver();
    _agent = createReactAgent({
      llm: agentModel,
      tools: [
        searchCatalogTablesTool,
        listTablesByPrefixTool,
        getCatalogTableInfoTool,
        getTableColumnsTool,
      ],
      checkpointSaver: agentCheckpointer,
    });
  }
  return _agent;
}

function buildSystemMessage(dbContextSummary: string): SystemMessage {
  return new SystemMessage(`
Eres un senior programador PL/SQL Oracle de la empresa Indra, asignado al proyecto Mapfre Paraguay.
Tu objetivo es analizar requerimientos funcionales/técnicos enviados por clientes para definir el flujo de trabajo que el equipo debe seguir.

Tono y estilo:
- Mantener un tono alegre y proactivo.
- Responder de forma profesional, clara y directa.
- Responder de forma concisa, priorizando lo accionable.

Reglas de análisis de base de datos:
- Prioriza unicamente tablas que inician con A o G.
- Dentro de A/G, prioriza especialmente las tablas sin sufijos (sin underscore).
- Si una tabla termina en _MPY, solo clasifícala como tabla local de Paraguay.
- Si una tabla termina en _TRN, solo clasifícala como tabla core/transaccional.
- No uses _MPY ni _TRN como criterio de prioridad.

Cuando recibas un requerimiento:
1) Resume el problema en una frase.
2) Lista preguntas de aclaración (solo si faltan datos clave).
3) Propón flujo de trabajo recomendado en pasos concretos.
4) Identifica tablas/objetos Oracle impactados, priorizando A/G y especialmente A/G sin sufijos; clasifica _MPY/_TRN solo como etiquetas cuando aplique.
5) Propón riesgos técnicos y validaciones (SQL/PLSQL, datos, pruebas, rollback).

Uso obligatorio de herramientas:
- No asumas columnas de tablas sin verificar.
- Para descubrir tablas candidatas usa search_catalog_tables o list_tables_by_prefix.
- Para validar metadatos usa get_catalog_table_info.
- Para columnas exactas usa get_table_columns.
- Evita repetir llamadas de tool para la misma tabla si ya tienes el dato en el turno.

Contexto base cargado desde documentos internos:
${dbContextSummary}

Formato de salida obligatorio:
- Responde en texto plano legible para Teams.
- No devuelvas objetos JSON tipo {"contentType":..., "content":...}.
- Usa secciones con titulos cortos y listas simples cuando ayuden.
- Si incluyes SQL, colocalo como bloque de texto simple.
- Limita la respuesta a lo esencial; evita parrafos largos.`);
}

function extractJsonCandidate(raw: string): string {
  const trimmed = raw.trim();

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return trimmed;
}

function normalizeContentType(value: unknown): "Text" | "AdaptiveCard" | null {
  if (typeof value !== "string") return null;

  const normalized = value.trim().toLowerCase();
  if (normalized === "text") return "Text";
  if (normalized === "adaptivecard" || normalized === "adaptive_card") {
    return "AdaptiveCard";
  }

  return null;
}

function tryParseStructuredResponse(raw: string): WeatherForecastAgentResponse | null {
  const candidate = extractJsonCandidate(raw);

  try {
    const parsed = JSON.parse(candidate) as Record<string, unknown>;
    const contentType = normalizeContentType(parsed.contentType);
    if (!contentType || !("content" in parsed)) return null;

    return {
      contentType,
      content: parsed.content as string | Record<string, unknown>,
    };
  } catch {
    return null;
  }
}

function parseAgentResponse(rawContent: unknown): WeatherForecastAgentResponse {
  if (typeof rawContent !== "string") {
    return {
      contentType: "Text",
      content: "No se obtuvo un formato de respuesta valido del modelo.",
    };
  }

  const structured = tryParseStructuredResponse(rawContent);
  if (structured) {
    return structured;
  }

  // Compatibilidad: algunos modelos siguen devolviendo un "sobre" JSON-like
  // aunque el prompt pida texto plano. Intentamos extraer solo el campo content.
  const jsonLike = extractJsonCandidate(rawContent);
  const contentStringMatch = jsonLike.match(
    /"content"\s*:\s*"([\s\S]*?)"\s*(?:,|})/
  );
  if (contentStringMatch?.[1]) {
    const unescaped = contentStringMatch[1]
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "\r")
      .replace(/\\t/g, "\t")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\");

    return {
      contentType: "Text",
      content: unescaped,
    };
  }

  return {
    contentType: "Text",
    content: rawContent.trim(),
  };
}

async function sendTypingActivity(context: TurnContext): Promise<void> {
  const typingActivity = {
    type: ActivityTypes.Typing,
  } as any;

  await context.sendActivity(typingActivity);
}

weatherAgent.onActivity(ActivityTypes.Message, async (context, state) => {
  await sendTypingActivity(context);

  const typingHeartbeat = setInterval(() => {
    void sendTypingActivity(context);
  }, 2500);

  try {
    const threadId = context.activity.conversation?.id || "default-thread";
    const includeCatalogContext = !threadContextInjected.has(threadId);
    const dbContextSummary = includeCatalogContext
      ? await getDbContextSummary()
      : "Contexto base de catalogo ya cargado para esta conversacion. Usa tools para consultar tablas/columnas bajo demanda.";

    if (includeCatalogContext) {
      threadContextInjected.add(threadId);
    }

    const sysMessage = buildSystemMessage(dbContextSummary);
    const pdfText = await extractPdfRequirementText(context);
    const userText = (context.activity.text || "").trim();

    const composedUserInput = [
      `Mensaje del usuario: ${userText || "(sin texto)"}`,
      pdfText
        ? `Texto extraido de PDFs adjuntos o referenciados:\n${pdfText}`
        : "No se detectaron PDFs en el mensaje actual.",
    ].join("\n\n");

    const llmResponse = await getAgent().invoke(
      {
        messages: [sysMessage, new HumanMessage(composedUserInput)],
      },
      {
        configurable: { thread_id: threadId },
      }
    );

    const llmResponseContent = parseAgentResponse(
      llmResponse.messages[llmResponse.messages.length - 1].content
    );

    await context.sendActivity(String(llmResponseContent.content));
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : String(error);
    console.error("[agent] Error en handler de mensaje:", message);
    await context.sendActivity(
      `Lo siento, ocurrio un error al procesar tu mensaje. Detalle: ${message}`
    );
  } finally {
    clearInterval(typingHeartbeat);
  }
});
