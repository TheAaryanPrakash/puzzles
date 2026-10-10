import type { DataSource } from "./types";
import { localDataSource } from "./local";
import { supabaseDataSource } from "./supabase";

const adapter = import.meta.env.VITE_DATA_SOURCE ?? "local";

export const dataSource: DataSource = adapter === "supabase" ? supabaseDataSource : localDataSource;
