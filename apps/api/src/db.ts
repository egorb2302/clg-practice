import postgres from "postgres";

export type Sql = postgres.Sql<{ bigint: number }>;
export type Tx = postgres.TransactionSql<{ bigint: number }>;
export type Db = Sql | Tx;

export function createDb(url: string, opts: { max?: number } = {}): Sql {
  const local = /@(127\.0\.0\.1|localhost)[:/]/.test(url);
  return postgres(url, {
    max: opts.max ?? 1,
    prepare: false,
    ssl: local ? false : "require",
    idle_timeout: 20,
    connect_timeout: 10,
    connection: { search_path: "app" },
    types: {
      bigint: {
        to: 20,
        from: [20],
        serialize: (x: number) => String(x),
        parse: (x: string) => Number(x),
      },
    },
    transform: { undefined: null },
    onnotice: () => {},
  });
}
