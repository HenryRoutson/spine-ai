// AI : TODO refactor — only used by scripts/write_task_example_seeds.ts; move under scripts/ or keep as dev-only util.
// AI : seeds paste duplicate splitMdRow/mdTableToRows strings; import this module instead.
// AI : markdown table → row objects (CSV-equivalent) → JSON for custom-code seed steps.

export type MarkdownTable = {
  name: string;
  rows: Record<string, string>[];
};

export function splitMarkdownRow(row: string): string[] {
  return row
    .slice(1, -1)
    .split("|")
    .map((c) => c.trim());
}

export function parseMarkdownTables(body: string): MarkdownTable[] {
  const tables: MarkdownTable[] = [];
  const lines = body.split("\n");
  let i = 0;
  let tableIndex = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line.startsWith("|") || !line.endsWith("|")) {
      i += 1;
      continue;
    }
    const block: string[] = [];
    while (i < lines.length) {
      const l = lines[i].trim();
      if (!l.startsWith("|") || !l.endsWith("|")) break;
      block.push(l);
      i += 1;
    }
    if (block.length < 2) continue;
    const headers = splitMarkdownRow(block[0]);
    const dataLines = block.slice(2).filter((l) => !/^\|[\s\-:|]+\|$/.test(l));
    const rows = dataLines.map((ln) => {
      const cells = splitMarkdownRow(ln);
      const obj: Record<string, string> = {};
      headers.forEach((h, j) => {
        obj[h] = cells[j] ?? "";
      });
      return obj;
    });
    tableIndex += 1;
    tables.push({ name: `table_${tableIndex}`, rows });
  }
  return tables;
}

export function firstMarkdownTableRows(body: string): Record<string, string>[] {
  return parseMarkdownTables(body)[0]?.rows ?? [];
}

// AI : minified preamble injected into browser custom-code — keep in sync with functions above.
export const MD_TABLE_PARSER_PREAMBLE =
  'const splitMdRow=(r)=>r.slice(1,-1).split("|").map(c=>c.trim());' +
  'const mdTableToRows=(body)=>{const t=[];const lines=body.split("\\n");let i=0,ti=0;' +
  'while(i<lines.length){const line=lines[i].trim();if(!line.startsWith("|")||!line.endsWith("|")){i++;continue;}' +
  'const block=[];while(i<lines.length){const l=lines[i].trim();if(!l.startsWith("|")||!l.endsWith("|"))break;block.push(l);i++;}' +
  'if(block.length<2)continue;const headers=splitMdRow(block[0]);' +
  'const data=block.slice(2).filter(l=>!/^[|][\\s\\-:|]+[|]$/.test(l));' +
  't.push({name:"table_"+ ++ti,rows:data.map(ln=>{const c=splitMdRow(ln);const o={};headers.forEach((h,j)=>o[h]=c[j]??"");return o;})});}' +
  "return t;};const mdFirstTableRows=(body)=>(mdTableToRows(body)[0]?.rows??[]);";

export function customCodeParseDocBodyToParsedTable(): string {
  return `${MD_TABLE_PARSER_PREAMBLE}(doc)=>({rows_json:JSON.stringify(mdFirstTableRows(doc.content)),row_count:mdFirstTableRows(doc.content).length})`;
}

export function customCodeParseDocBodyAllTables(): string {
  return `${MD_TABLE_PARSER_PREAMBLE}(doc)=>({rows_json:JSON.stringify(mdTableToRows(doc.content)),row_count:mdTableToRows(doc.content).reduce((n,t)=>n+t.rows.length,0)})`;
}

export function customCodeParseDocToTableRows(): string {
  return `${MD_TABLE_PARSER_PREAMBLE}(doc)=>mdFirstTableRows(doc.content).map((row,i)=>({row_id:String(i+1),cells_json:JSON.stringify(row)}))`;
}

export function customCodeMergeTableRowsFromCombined(
  pipelineField: string,
  documentField: string,
  outAKey: string,
  outBKey: string,
): string {
  return `${MD_TABLE_PARSER_PREAMBLE}(combined)=>({${outAKey}:JSON.stringify(combined.${pipelineField}.map((r)=>JSON.parse(r.cells_json))),${outBKey}:JSON.stringify(mdFirstTableRows(combined.${documentField}.content))})`;
}
