import { tool } from "@langchain/core/tools";
import { readFile } from "fs/promises";
import { join } from "path";
import { z } from "zod";

interface ColumnaInfo {
  nombre: string;
  tipo: string;
  nullable: string;
}

interface TablaColumnasInfo {
  tabla: string;
  columnas: ColumnaInfo[];
}

interface ColumnasFile {
  info_columnas: TablaColumnasInfo[];
}

let cachedColumnas: Map<string, TablaColumnasInfo> | null = null;

async function getColumnasMap(): Promise<Map<string, TablaColumnasInfo>> {
  if (!cachedColumnas) {
    const columnasPath = join(process.cwd(), "src", "context", "contexto_columnas.json");
    const raw = await readFile(columnasPath, "utf8");
    const json = JSON.parse(raw) as ColumnasFile;
    cachedColumnas = new Map(
      (json.info_columnas || []).map((entry) => [entry.tabla.toUpperCase(), entry])
    );
  }
  return cachedColumnas;
}

export const getTableColumnsTool = tool(
  async ({ tabla }: { tabla: string }): Promise<string> => {
    const map = await getColumnasMap();
    const entry = map.get(tabla.toUpperCase().trim());

    if (!entry || !entry.columnas?.length) {
      return `No se encontraron columnas para la tabla "${tabla}".`;
    }

    const lines = entry.columnas.map(
      (c) => `  - ${c.nombre} ${c.tipo}${c.nullable === "Y" ? " NULL" : " NOT NULL"}`
    );

    return [`Columnas de ${entry.tabla} (${lines.length} columnas):`, ...lines].join("\n");
  },
  {
    name: "get_table_columns",
    description:
      "Devuelve las columnas de una tabla Oracle especifica. Usalo cuando necesites conocer la estructura de una tabla antes de proponer SQL/PLSQL.",
    schema: z.object({
      tabla: z.string().describe("Nombre exacto de la tabla Oracle (sin esquema)."),
    }),
  }
);
