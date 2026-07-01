import path from 'path'
import type { ProfileMeta } from '../types'
import { getContentStore } from './storage'
import type { ProfileDocument, ProfileSections } from './storage'

export type { ProfileDocument, ProfileSections } from './storage'

export async function listProfiles(profilesDir: string): Promise<ProfileMeta[]> {
  void profilesDir
  return getContentStore().listProfiles()
}

export async function loadProfileSections(profileDir: string): Promise<ProfileSections> {
  return getContentStore().loadProfileSections(path.basename(profileDir))
}

export async function loadProfileMeta(profileDir: string): Promise<ProfileMeta> {
  return getContentStore().loadProfileMeta(path.basename(profileDir))
}

export async function loadBasePrompt(profileDir: string): Promise<string> {
  return getContentStore().loadBasePrompt(path.basename(profileDir))
}

export async function loadProfileDocuments(profileDir: string): Promise<ProfileDocument[]> {
  return getContentStore().loadProfileDocuments(path.basename(profileDir))
}
