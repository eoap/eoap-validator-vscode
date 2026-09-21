import { parseDocument } from 'yaml';

/** Inspect only root process objects, matching the validator's entrypoint scope. */
export function workflowIds(text: string): string[] {
  const document = parseDocument(text);
  // Let the validator report malformed CWL rather than guessing its structure.
  if (document.errors.length) return [];
  const data: unknown = document.toJS({ maxAliasCount: 100 });
  if (!data || typeof data !== 'object' || Array.isArray(data)) return [];
  const root = data as Record<string, unknown>;
  const nodes = Array.isArray(root.$graph) ? root.$graph : [root];
  const workflows = nodes.filter((node): node is Record<string, unknown> =>
    !!node && typeof node === 'object' && node.class === 'Workflow');
  if (workflows.length <= 1) return [];
  const ids = workflows.map(node => typeof node.id === 'string' ? node.id.replace(/^#/, '') : '');
  if (ids.some(id => !id) || new Set(ids).size !== ids.length) {
    throw new Error('Multiple workflows require distinct, nonempty workflow IDs before EOAP validation.');
  }
  return ids;
}
