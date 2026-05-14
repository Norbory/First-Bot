import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { getCatalogTableInfo } from "../context/dbContextService";

export const getCatalogTableInfoTool = tool(
  async ({ tabla }: { tabla: string }): Promise<string> => {
    return getCatalogTableInfo(tabla);
  },
  {
    name: "get_catalog_table_info",
    description:
      "Devuelve metadatos de una tabla del catalogo (descripcion y clasificacion de prioridad).",
    schema: z.object({
      tabla: z.string().describe("Nombre exacto de la tabla."),
    }),
  }
);
