import { api } from "./client"
import type { Scope } from "./storage"

export const fetcher = (key: string) => api(key)

export function makeFetcher(scope: Scope) {
  return (key: string) => api(key, { scope })
}
