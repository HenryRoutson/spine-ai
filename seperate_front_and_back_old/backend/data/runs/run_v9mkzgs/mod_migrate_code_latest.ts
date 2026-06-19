(input) => {
  const spec = JSON.parse(input.mapping.body).fields;
  const transforms = {
    lowercase: (v) => String(v).toLowerCase(),
    first_word: (v) => String(v).trim().split(/\s+/)[0],
    last_word: (v) => String(v).trim().split(/\s+/).pop(),
    yn_to_bool: (v) => v === 'Y',
    ddmmyyyy_to_iso: (v) => { const [d, m, y] = String(v).split('/'); return y + '-' + m + '-' + d; }
  };
  const setPath = (obj, path, v) => {
    const keys = path.split('.');
    let cur = obj;
    for (const k of keys.slice(0, -1)) cur = cur[k] = cur[k] ?? {};
    cur[keys[keys.length - 1]] = v;
  };
  return input.legacy_users.map((rec) => {
    const out = {};
    for (const [target, s] of Object.entries(spec)) {
      const raw = s.source === undefined ? undefined : rec[s.source];
      setPath(out, target, raw === undefined ? (s.default === undefined ? null : s.default) : s.transform ? transforms[s.transform](raw) : raw);
    }
    return out;
  });
}