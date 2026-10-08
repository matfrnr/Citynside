import type { ReactNode } from "react";

function inlineContent(text: string, prefix: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*)/g).filter(Boolean);
  return parts.map((part, index) => {
    const key = `${prefix}-${index}`;
    if ((part.startsWith("**") && part.endsWith("**")) || (part.startsWith("__") && part.endsWith("__"))) {
      return <strong key={key}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*")) return <em key={key}>{part.slice(1, -1)}</em>;
    return part;
  });
}

function cleanMarkdown(text: string): string {
  return text.replace(/\\([*_`|])/g, "$1").replace(/\r/g, "").trim();
}

function parseFlatTable(text: string): { prefix: string; headers: string[]; rows: string[][] } | null {
  const cells = text.split("|").map((cell) => cell.trim());
  const separatorStart = cells.findIndex((cell) => /^:?-{3,}:?$/.test(cell));
  if (separatorStart < 1) return null;
  let columnCount = 0;
  while (separatorStart + columnCount < cells.length && /^:?-{3,}:?$/.test(cells[separatorStart + columnCount])) columnCount += 1;
  if (columnCount < 2 || separatorStart < columnCount) return null;

  const headerStart = separatorStart - columnCount;
  const headers = cells.slice(headerStart, separatorStart);
  const prefix = cells.slice(0, headerStart).filter(Boolean).join(" ");
  const values = cells.slice(separatorStart + columnCount).filter(Boolean);
  const rows: string[][] = [];
  for (let index = 0; index + columnCount <= values.length; index += columnCount) {
    const row = values.slice(index, index + columnCount);
    if (row.length === columnCount) rows.push(row);
  }
  return rows.length ? { prefix, headers, rows } : null;
}

function renderTable(headers: string[], rows: string[][], key: string) {
  return <div className="assistant-message-table-wrap" key={key}>
    <table className="assistant-message-table">
      <thead><tr>{headers.map((header, index) => <th key={`${key}-h-${index}`}>{inlineContent(header, `${key}-h-${index}`)}</th>)}</tr></thead>
      <tbody>{rows.map((row, rowIndex) => <tr key={`${key}-r-${rowIndex}`}>{row.map((cell, cellIndex) => <td key={`${key}-r-${rowIndex}-c-${cellIndex}`}>{inlineContent(cell, `${key}-r-${rowIndex}-c-${cellIndex}`)}</td>)}</tr>)}</tbody>
    </table>
  </div>;
}

export function FormattedAssistantMessage({ content }: { content: string }) {
  const text = cleanMarkdown(content);
  const flatTable = parseFlatTable(text);
  if (flatTable) return <div className="assistant-message-content">
    {flatTable.prefix && <p className="assistant-message-heading">{inlineContent(flatTable.prefix, "flat-title")}</p>}
    {renderTable(flatTable.headers, flatTable.rows, "flat-table")}
  </div>;

  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index].trim();
    if (!line) { index += 1; continue; }

    if (line.includes("|") && index + 1 < lines.length && /^\s*\|?\s*:?-{3,}/.test(lines[index + 1])) {
      const headers = line.replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());
      index += 2;
      const rows: string[][] = [];
      while (index < lines.length && lines[index].includes("|")) {
        rows.push(lines[index].replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim()));
        index += 1;
      }
      blocks.push(renderTable(headers, rows, `table-${blocks.length}`));
      continue;
    }

    const heading = line.match(/^#{1,3}\s+(.+)$/);
    if (heading) {
      blocks.push(<h4 key={`heading-${blocks.length}`}>{inlineContent(heading[1], `heading-${blocks.length}`)}</h4>);
      index += 1;
      continue;
    }

    if (/^[-*]\s+/.test(line) || /^\d+[.)]\s+/.test(line)) {
      const ordered = /^\d+[.)]\s+/.test(line);
      const items: string[] = [];
      while (index < lines.length && (/^[-*]\s+/.test(lines[index].trim()) || /^\d+[.)]\s+/.test(lines[index].trim()))) {
        items.push(lines[index].trim().replace(/^(?:[-*]|\d+[.)])\s+/, ""));
        index += 1;
      }
      const List = ordered ? "ol" : "ul";
      blocks.push(<List key={`list-${blocks.length}`}>{items.map((item, itemIndex) => <li key={`list-${blocks.length}-${itemIndex}`}>{inlineContent(item, `list-${blocks.length}-${itemIndex}`)}</li>)}</List>);
      continue;
    }

    const paragraph: string[] = [line];
    index += 1;
    while (index < lines.length && lines[index].trim() && !/^#{1,3}\s+/.test(lines[index].trim()) && !/^[-*]\s+/.test(lines[index].trim())) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    blocks.push(<p key={`paragraph-${blocks.length}`}>{inlineContent(paragraph.join(" "), `paragraph-${blocks.length}`)}</p>);
  }

  return <div className="assistant-message-content">{blocks}</div>;
}
