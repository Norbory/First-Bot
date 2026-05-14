import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { listCatalogByPrefix } from "../context/dbContextService";

export const listTablesByPrefixTool = tool(
  async ({
    prefix,
    onlyMain,
    limit,
  }: {
    prefix: string;
    onlyMain?: boolean;
    limit?: number;
  }): Promise<string> => {
    const results = await listCatalogByPrefix(prefix, onlyMain ?? false, limit ?? 50);

    if (!results.length) {
      return `No se encontraron tablas con prefijo "${prefix}".`;
    }

    return [
      `Tablas con prefijo "${prefix}" (${results.length}):`,
      ...results,
    ].join("\n");
  },
  {
    name: "list_tables_by_prefix",
    description:
      "Lista tablas Oracle por prefijo. Permite filtrar solo tablas prioritarias A/G.",
    schema: z.object({
      prefix: z.string().describe("Prefijo de tabla (ej: A25, G10)."),
      onlyMain: z
        .boolean()
        .optional()
        .describe("Si es true, devuelve solo tablas A/G."),
      limit: z
        .number()
        .int()
        .min(1)
        .max(300)
        .optional()
        .describe("Cantidad maxima de resultados."),
    }),
  }
);
