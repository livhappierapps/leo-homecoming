export type SessionEntry = { date: string; summary: string };
export type Memory = {
  version: number;
  date: string;
  updated_by: string;
  language_notes: string;
  personal_context: string;
  dev_status: string;
  flags: string[];
  session_log: SessionEntry[];
};

export function emptyMemory(): Memory {
  return {
    version: 1,
    date: new Date().toISOString(),
    updated_by: 'liv-app',
    language_notes: '',
    personal_context: '',
    dev_status: '',
    flags: [],
    session_log: [],
  };
}

export function parseMemory(text: string): Memory {
  const j = JSON.parse(text);
  const base = emptyMemory();
  return {
    ...base,
    ...j,
    flags: Array.isArray(j.flags) ? j.flags.map(String) : [],
    session_log: Array.isArray(j.session_log) ? j.session_log : [],
  };
}

export const stringify = (m: Memory) => JSON.stringify(m, null, 2) + '\n';
