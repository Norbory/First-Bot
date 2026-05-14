import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { searchCatalogTables } from "../context/dbContextService";

export const searchCatalogTablesTool = tool(
  async ({ query, limit }: { query: string; limit?: number }): Promise<string> => {
    const results = await searchCatalogTables(query, limit ?? 30);

    if (!results.length) {
      return `No se encontraron tablas para "${query}".`;
    }

    return [
      `Resultados de busqueda para "${query}" (${results.length}):`,
      ...results,
    ].join("\n");
  },
  {
    name: "search_catalog_tables",
    description:
      "Busca tablas Oracle por nombre o descripcion en el catalogo. Ideal para localizar candidatas antes de pedir columnas.",
    schema: z.object({
      query: z.string().describe("Texto a buscar en nombre o descripcion de tabla."),
      limit: z
        .number()
        .int()
        .min(1)
        .max(200)
        .optional()
        .describe("Cantidad maxima de resultados."),
    }),
  }
);
