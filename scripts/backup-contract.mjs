// Nur Struktur- und Berechtigungsmetadaten. Das Ergebnis bleibt im verschlüsselten Backup.
export const CATALOG_SQL = `SELECT json_build_object(
  'functions',(SELECT coalesce(json_agg(f ORDER BY schema,name,arguments),'[]'::json) FROM (
    SELECT n.nspname AS schema,p.proname AS name,pg_get_function_identity_arguments(p.oid) AS arguments,
      pg_get_userbyid(p.proowner) AS owner,p.prosecdef AS security_definer,pg_get_functiondef(p.oid) AS definition,p.proacl::text AS acl
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind IN ('f','p')) f),
  'triggers',(SELECT coalesce(json_agg(t ORDER BY schema,table_name,name),'[]'::json) FROM (
    SELECT n.nspname AS schema,c.relname AS table_name,t.tgname AS name,t.tgenabled,pg_get_triggerdef(t.oid) AS definition
    FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE NOT t.tgisinternal AND n.nspname IN ('public','auth','storage')) t),
  'constraints',(SELECT coalesce(json_agg(k ORDER BY schema,table_name,name),'[]'::json) FROM (
    SELECT n.nspname AS schema,c.relname AS table_name,k.conname AS name,k.convalidated,pg_get_constraintdef(k.oid) AS definition
    FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname IN ('public','auth','storage')) k),
  'grants',(SELECT coalesce(json_agg(g ORDER BY schema,name,grantee,privilege_type,is_grantable),'[]'::json) FROM (
    SELECT n.nspname AS schema,c.relname AS name,pg_get_userbyid(c.relowner) AS owner,
      a.grantor::regrole::text AS grantor,a.grantee::regrole::text AS grantee,a.privilege_type,a.is_grantable
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace,
      LATERAL aclexplode(coalesce(c.relacl,acldefault(CASE WHEN c.relkind='S' THEN 'S'::"char" ELSE 'r'::"char" END,c.relowner))) a
    WHERE n.nspname IN ('public','auth','storage') AND c.relkind IN ('r','p','S','v','m','f')) g),
  'sequences',(SELECT coalesce(json_agg(s ORDER BY schemaname,sequencename),'[]'::json) FROM pg_sequences s WHERE schemaname IN ('public','auth','storage'))
);`;

export const canonical = (value) => JSON.stringify(Array.isArray(value) ? value.map((item) => JSON.parse(canonical(item))) : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, JSON.parse(canonical(value[key]))])) : value);
