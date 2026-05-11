"use client"

import { api } from "./client"
import { Scope } from "./storage"

export const fetcher = (key: string) => api(key)

export const adminFetcher = (key: string) => api(key, { scope: "admin" })

export function makeFetcher(scope: Scope) {
  return (key: string) => api(key, { scope })
}
