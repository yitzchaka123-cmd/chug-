export type ExcelCell = string | number | boolean | null | undefined;
export type ExcelSheet = { name: string; rows: ExcelCell[][] };

function escapeXml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function safeSheetName(value: string) { return value.replace(/[\\/?*\[\]:]/g, " ").trim().slice(0, 31) || "Sheet"; }

export function createExcelWorkbook(sheets: ExcelSheet[]) {
  const worksheets = sheets.map((sheet) => {
    const rows = sheet.rows.map((row) => `<Row>${row.map((cell) => {
      const type = typeof cell === "number" ? "Number" : typeof cell === "boolean" ? "Boolean" : "String";
      const value = cell == null ? "" : typeof cell === "boolean" ? cell ? "1" : "0" : String(cell);
      return `<Cell><Data ss:Type="${type}">${escapeXml(value)}</Data></Cell>`;
    }).join("")}</Row>`).join("");
    return `<Worksheet ss:Name="${escapeXml(safeSheetName(sheet.name))}"><Table>${rows}</Table></Worksheet>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Styles><Style ss:ID="Default" ss:Name="Normal"><Alignment ss:Vertical="Bottom"/><Font ss:FontName="Aptos" ss:Size="11"/></Style></Styles>${worksheets}</Workbook>`;
}

