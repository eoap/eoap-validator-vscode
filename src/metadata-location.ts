import { isMap, isScalar, LineCounter, parseDocument } from 'yaml';
import { Finding } from './report';

/** Anchor an absent metadata property to an existing metadata key, explicitly. */
export function missingMetadataAnchor(text: string, finding: Finding): { line: number; column: number; note: string } | undefined {
  const match = /^metadata\/([^/]+)$/.exec(finding.location.path);
  if (finding.rule_id !== 'TM.METADATA.MODEL' || finding.profile !== 'metadata' ||
      finding.status !== 'failed' || !match || finding.message !== `${match[1]}: Field required`) return undefined;
  const field = match[1];
  const lineCounter = new LineCounter();
  const document = parseDocument(text, { lineCounter });
  if (document.errors.length || !isMap(document.contents)) return undefined;
  const namespaces = document.get('$namespaces', true);
  const prefixes = isMap(namespaces) ? namespaces.items.flatMap(pair =>
    isScalar(pair.key) && isScalar(pair.value) && pair.value.value === 'https://schema.org/' ? [String(pair.key.value)] : []) : [];
  const schemaProperty = (key: string): string | undefined => {
    if (key.startsWith('https://schema.org/')) return key.slice('https://schema.org/'.length);
    const prefix = prefixes.find(value => key.startsWith(`${value}:`));
    return prefix === undefined ? undefined : key.slice(prefix.length + 1);
  };
  const keys = document.contents.items.flatMap(pair => isScalar(pair.key) ? [pair.key] : []);
  // Never relocate an existing field or infer aliases from an unknown context.
  if (document.has('@context') || keys.some(key => schemaProperty(String(key.value)) === field)) return undefined;
  const anchor = keys.find(key => schemaProperty(String(key.value)) !== undefined && key.range);
  if (!anchor?.range) return undefined;
  const position = lineCounter.linePos(anchor.range[0]);
  return {
    line: position.line - 1, column: position.col - 1,
    note: `Missing document metadata field: ${prefixes[0] ? prefixes[0] + ':' : 'https://schema.org/'}${field}. The underline marks the existing metadata section; add the field at document level.`,
  };
}
