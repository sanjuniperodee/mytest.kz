"use client"

import useSWR from "swr"

export type LandingCampaign = {
  enabled: boolean
  eyebrow: string
  title: string
  description: string
  ctaLabel: string
  ctaHref: string
  endsAt: string | null
}

export type LandingSettings = {
  instructionVideoUrl: string
  instagramUrl: string
  tiktokUrl: string
  whatsappUrl: string
  campaign: LandingCampaign
}

export type LandingProof = {
  registeredStudents: number
  completedTrials: number
  completedTrials30d: number
  activeQuestions: number
  updatedAt: string
}

export function useLandingSettings() {
  return useSWR<LandingSettings>("/public/landing-settings")
}

export function useLandingProof() {
  return useSWR<LandingProof>("/public/landing-proof", {
    refreshInterval: 5 * 60_000,
  })
}
