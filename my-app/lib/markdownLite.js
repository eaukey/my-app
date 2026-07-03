import React from "react";

// Mini-renderer Markdown, sans dépendance et sans dangerouslySetInnerHTML
// (on construit des éléments React => pas de risque XSS). Couvre ce que renvoie
// typiquement l'agent SAV : gras/italique (** * ***), code inline, liens, titres
// (#..####), listes à puces et numérotées, paragraphes. Objectif : ne plus
// afficher les *, **, *** bruts dans les réponses.

// --- inline : **gras**, ***gras+italique***, *italique*, `code`, [texte](url)
function renderInline(text, keyBase) {
  const pattern =
    /(\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_|`[^`]+`|\[[^\]]+\]\([^)]+\))/;
  const out = [];
  let rest = text;
  let k = 0;
  while (rest) {
    const m = rest.match(pattern);
    if (!m) {
      out.push(rest);
      break;
    }
    if (m.index > 0) out.push(rest.slice(0, m.index));
    const tok = m[0];
    const key = `${keyBase}-${k++}`;
    if (tok.startsWith("***")) {
      out.push(
        <strong key={key}>
          <em>{tok.slice(3, -3)}</em>
        </strong>
      );
    } else if (tok.startsWith("**") || tok.startsWith("__")) {
      out.push(<strong key={key}>{tok.slice(2, -2)}</strong>);
    } else if (tok.startsWith("`")) {
      out.push(<code key={key}>{tok.slice(1, -1)}</code>);
    } else if (tok.startsWith("[")) {
      const lm = tok.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      out.push(
        <a key={key} href={lm[2]} target="_blank" rel="noopener noreferrer">
          {lm[1]}
        </a>
      );
    } else {
      out.push(<em key={key}>{tok.slice(1, -1)}</em>);
    }
    rest = rest.slice(m.index + tok.length);
  }
  return out;
}

// --- blocs : titres, listes, paragraphes
export function renderMarkdown(text) {
  const lines = String(text ?? "").split("\n");
  const nodes = [];
  let list = null; // { ordered: bool, items: [] }
  let key = 0;

  const flushList = () => {
    if (!list) return;
    const items = list.items.map((it, i) => (
      <li key={i}>{renderInline(it, `li-${key}-${i}`)}</li>
    ));
    nodes.push(
      list.ordered ? (
        <ol key={`b-${key++}`}>{items}</ol>
      ) : (
        <ul key={`b-${key++}`}>{items}</ul>
      )
    );
    list = null;
  };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");
    if (!line.trim()) {
      flushList();
      continue;
    }
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      flushList();
      const Tag = `h${Math.min(h[1].length + 2, 6)}`; // # -> h3, etc.
      nodes.push(<Tag key={`b-${key++}`}>{renderInline(h[2], `h-${key}`)}</Tag>);
      continue;
    }
    const ul = line.match(/^\s*[-*+]\s+(.*)$/);
    if (ul) {
      if (!list || list.ordered) {
        flushList();
        list = { ordered: false, items: [] };
      }
      list.items.push(ul[1]);
      continue;
    }
    const ol = line.match(/^\s*\d+\.\s+(.*)$/);
    if (ol) {
      if (!list || !list.ordered) {
        flushList();
        list = { ordered: true, items: [] };
      }
      list.items.push(ol[1]);
      continue;
    }
    flushList();
    nodes.push(<p key={`b-${key++}`}>{renderInline(line, `p-${key}`)}</p>);
  }
  flushList();
  return nodes;
}
