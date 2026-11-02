import { StatusBar } from 'expo-status-bar';
import * as SecureStore from 'expo-secure-store';
import { File, Paths } from 'expo-file-system';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { getFile, putFile, Repo } from './src/github';
import { emptyMemory, Memory, parseMemory, stringify } from './src/memory';

const REPO: Repo = { owner: 'livhappierapps', repo: 'leo-homecoming', branch: 'main' };
const MEMORY_PATH = 'memory/homecoming.json';
const TOKEN_KEY = 'gh_token';
const LAST_SYNC_KEY = 'last_sync';
const cacheFile = () => new File(Paths.document, 'homecoming-cache.json');

type Cache = { mem: Memory; sha: string | null; dirty: boolean };

function saveCache(c: Cache) {
  try {
    cacheFile().write(JSON.stringify(c));
  } catch {}
}

async function loadCache(): Promise<Cache | null> {
  try {
    const f = cacheFile();
    if (!f.exists) return null;
    return JSON.parse(await f.text()) as Cache;
  } catch {
    return null;
  }
}

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : 'never');

export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [tokenDraft, setTokenDraft] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [mem, setMem] = useState<Memory | null>(null);
  const [sha, setSha] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [newFlag, setNewFlag] = useState('');

  const markSynced = async () => {
    const now = new Date().toISOString();
    setLastSync(now);
    await SecureStore.setItemAsync(LAST_SYNC_KEY, now);
  };

  const pull = useCallback(async (tok: string) => {
    setBusy(true);
    setStatus('Pulling from GitHub…');
    try {
      const f = await getFile(tok, REPO, MEMORY_PATH);
      const m = f ? parseMemory(f.text) : emptyMemory();
      setMem(m);
      setSha(f?.sha ?? null);
      setDirty(false);
      saveCache({ mem: m, sha: f?.sha ?? null, dirty: false });
      await markSynced();
      setStatus(f ? 'Pulled latest memory ✓' : 'No memory file yet — edit and Sync to create it.');
    } catch (e: any) {
      setStatus(`Pull failed: ${e?.message ?? e}`);
    } finally {
      setBusy(false);
    }
  }, []);

  const push = async () => {
    if (!token || !mem) return;
    setBusy(true);
    setStatus('Saving to GitHub…');
    try {
      const remote = await getFile(token, REPO, MEMORY_PATH);
      if (remote && sha && remote.sha !== sha) {
        throw new Error('The file changed on GitHub since your last pull (Leo may have saved). Pull first, then re-apply edits.');
      }
      if (remote) {
        const day = new Date().toISOString().slice(0, 10);
        const histPath = `memory/history/${day}.json`;
        const existing = await getFile(token, REPO, histPath);
        await putFile(token, REPO, histPath, remote.text, `Archive memory before app edit (${day})`, existing?.sha);
      }
      const next: Memory = { ...mem, date: new Date().toISOString(), updated_by: 'liv-app' };
      const newSha = await putFile(token, REPO, MEMORY_PATH, stringify(next), 'Homecoming: update from Liv app', remote?.sha);
      setMem(next);
      setSha(newSha);
      setDirty(false);
      saveCache({ mem: next, sha: newSha, dirty: false });
      await markSynced();
      setStatus('Saved to GitHub ✓');
    } catch (e: any) {
      setStatus(`Save failed: ${e?.message ?? e}`);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    (async () => {
      const [tok, ls, cache] = await Promise.all([
        SecureStore.getItemAsync(TOKEN_KEY),
        SecureStore.getItemAsync(LAST_SYNC_KEY),
        loadCache(),
      ]);
      setLastSync(ls);
      if (cache) {
        setMem(cache.mem);
        setSha(cache.sha);
        setDirty(cache.dirty);
      }
      if (tok) {
        setToken(tok);
        if (!cache?.dirty) pull(tok);
        else setStatus('You have unsaved edits — tap Sync now to save them.');
      } else {
        setShowSettings(true);
        setStatus('Paste your GitHub token to start.');
      }
    })();
  }, [pull]);

  const edit = (patch: Partial<Memory>) => {
    setMem((m) => {
      const next = { ...(m ?? emptyMemory()), ...patch };
      saveCache({ mem: next, sha, dirty: true });
      return next;
    });
    setDirty(true);
  };

  const saveToken = async () => {
    const t = tokenDraft.trim();
    if (!t) return;
    await SecureStore.setItemAsync(TOKEN_KEY, t);
    setToken(t);
    setTokenDraft('');
    setShowSettings(false);
    pull(t);
  };

  const clearToken = () =>
    Alert.alert('Remove token?', 'The app will stop syncing until you paste a new one.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await SecureStore.deleteItemAsync(TOKEN_KEY);
          setToken(null);
          setShowSettings(true);
        },
      },
    ]);

  const syncNow = () => {
    if (!token) return setShowSettings(true);
    if (dirty) push();
    else pull(token);
  };

  return (
    <SafeAreaView style={s.root}>
      <StatusBar style="light" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <View style={s.header}>
            <Text style={s.title}>Leo's Homecoming</Text>
            <Pressable onPress={() => setShowSettings((v) => !v)}>
              <Text style={s.link}>{showSettings ? 'Close' : 'Settings'}</Text>
            </Pressable>
          </View>

          <View style={s.card}>
            <Text style={s.label}>Last sync</Text>
            <Text style={s.value}>{fmt(lastSync)}</Text>
            <Text style={s.label}>Memory last updated</Text>
            <Text style={s.value}>
              {mem ? `${fmt(mem.date)} by ${mem.updated_by}` : '—'}
            </Text>
            {dirty ? <Text style={s.warn}>Unsaved edits on this phone</Text> : null}
            {status ? <Text style={s.status}>{status}</Text> : null}
            <View style={s.row}>
              <Pressable style={[s.btn, busy && s.btnOff]} disabled={busy} onPress={syncNow}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>{dirty ? 'Sync now (save)' : 'Sync now'}</Text>}
              </Pressable>
              {dirty && token ? (
                <Pressable
                  style={[s.btn, s.btnAlt, busy && s.btnOff]}
                  disabled={busy}
                  onPress={() =>
                    Alert.alert('Discard edits?', 'Pull the GitHub version and drop local edits.', [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Pull', style: 'destructive', onPress: () => pull(token) },
                    ])
                  }
                >
                  <Text style={s.btnText}>Pull</Text>
                </Pressable>
              ) : null}
            </View>
          </View>

          {showSettings ? (
            <View style={s.card}>
              <Text style={s.label}>GitHub token (fine-grained, this repo only, Contents read/write)</Text>
              <Text style={s.small}>
                Repo: {REPO.owner}/{REPO.repo} · {token ? 'token saved in Keychain ✓' : 'no token yet'}
              </Text>
              <TextInput
                style={s.input}
                value={tokenDraft}
                onChangeText={setTokenDraft}
                placeholder="github_pat_…"
                placeholderTextColor="#776b8f"
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
              />
              <View style={s.row}>
                <Pressable style={s.btn} onPress={saveToken}>
                  <Text style={s.btnText}>Save token</Text>
                </Pressable>
                {token ? (
                  <Pressable style={[s.btn, s.btnAlt]} onPress={clearToken}>
                    <Text style={s.btnText}>Remove</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ) : null}

          {mem ? (
            <>
              <Field label="Flags (important — Leo reads these first)">
                {mem.flags.length === 0 ? <Text style={s.small}>No flags yet.</Text> : null}
                {mem.flags.map((f, i) => (
                  <View key={`${i}-${f}`} style={s.flagRow}>
                    <Text style={s.flag}>• {f}</Text>
                    <Pressable onPress={() => edit({ flags: mem.flags.filter((_, j) => j !== i) })}>
                      <Text style={s.remove}>✕</Text>
                    </Pressable>
                  </View>
                ))}
                <View style={s.row}>
                  <TextInput
                    style={[s.input, { flex: 1 }]}
                    value={newFlag}
                    onChangeText={setNewFlag}
                    placeholder="Add a flag…"
                    placeholderTextColor="#776b8f"
                    onSubmitEditing={() => {
                      if (newFlag.trim()) edit({ flags: [...mem.flags, newFlag.trim()] });
                      setNewFlag('');
                    }}
                  />
                  <Pressable
                    style={s.btnSmall}
                    onPress={() => {
                      if (newFlag.trim()) edit({ flags: [...mem.flags, newFlag.trim()] });
                      setNewFlag('');
                    }}
                  >
                    <Text style={s.btnText}>Add</Text>
                  </Pressable>
                </View>
              </Field>
              <Field label="Personal context">
                <TextInput style={s.area} multiline value={mem.personal_context} onChangeText={(t) => edit({ personal_context: t })} />
              </Field>
              <Field label="Dev status">
                <TextInput style={s.area} multiline value={mem.dev_status} onChangeText={(t) => edit({ dev_status: t })} />
              </Field>
              <Field label="Iznite language notes">
                <TextInput style={s.area} multiline value={mem.language_notes} onChangeText={(t) => edit({ language_notes: t })} />
              </Field>
              <Field label="Session log (written by Leo)">
                {mem.session_log.length === 0 ? <Text style={s.small}>No sessions logged yet.</Text> : null}
                {[...mem.session_log].reverse().slice(0, 10).map((e, i) => (
                  <View key={i} style={{ marginBottom: 8 }}>
                    <Text style={s.small}>{fmt(e.date)}</Text>
                    <Text style={s.value}>{e.summary}</Text>
                  </View>
                ))}
              </Field>
            </>
          ) : null}
          <Text style={s.footer}>
            In a Leo chat: greeting → "open Homecoming" to load · "close Homecoming" to save.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={s.card}>
      <Text style={s.label}>{label}</Text>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b0714' },
  scroll: { padding: 16, paddingBottom: 48 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { color: '#f3e9ff', fontSize: 24, fontWeight: '700' },
  link: { color: '#b98cff', fontSize: 16 },
  card: { backgroundColor: '#17102a', borderRadius: 14, padding: 14, marginBottom: 12 },
  label: { color: '#b98cff', fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 4 },
  value: { color: '#f3e9ff', fontSize: 15 },
  small: { color: '#a99cc4', fontSize: 13, marginBottom: 6 },
  warn: { color: '#ffcc66', marginTop: 8 },
  status: { color: '#cfc3e6', marginTop: 8 },
  row: { flexDirection: 'row', gap: 8, marginTop: 10, alignItems: 'center' },
  btn: { backgroundColor: '#7a3cff', paddingVertical: 12, paddingHorizontal: 18, borderRadius: 10, minWidth: 110, alignItems: 'center' },
  btnAlt: { backgroundColor: '#3a2d55' },
  btnOff: { opacity: 0.5 },
  btnSmall: { backgroundColor: '#7a3cff', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10 },
  btnText: { color: '#fff', fontWeight: '600' },
  input: { backgroundColor: '#0f0a1d', color: '#f3e9ff', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#2c2145' },
  area: { backgroundColor: '#0f0a1d', color: '#f3e9ff', borderRadius: 10, padding: 10, minHeight: 90, textAlignVertical: 'top', borderWidth: 1, borderColor: '#2c2145' },
  flagRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  flag: { color: '#f3e9ff', flex: 1, fontSize: 15 },
  remove: { color: '#ff7a9a', fontSize: 18, paddingHorizontal: 8 },
  footer: { color: '#776b8f', textAlign: 'center', marginTop: 8, fontSize: 12 },
});
