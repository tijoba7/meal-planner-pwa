import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import type { Profile, Updates } from '../types/supabase'

interface ProfileContextValue {
  profile: Profile | null
  loading: boolean
  updateProfile: (updates: Updates<'profiles'>) => Promise<{ error: Error | null }>
  uploadAvatar: (file: File) => Promise<{ error: Error | null }>
  refreshProfile: () => Promise<void>
}

const ProfileContext = createContext<ProfileContextValue | null>(null)

// ─── Image resize helper ──────────────────────────────────────────────────────

async function resizeToJpeg(file: File, maxSize = 400): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(maxSize / img.width, maxSize / img.height, 1)
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
      canvas.toBlob(
        blob =>
          blob
            ? resolve(new File([blob], 'avatar.jpg', { type: 'image/jpeg' }))
            : reject(new Error('Canvas resize failed')),
        'image/jpeg',
        0.85,
      )
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image'))
    }
    img.src = url
  })
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchProfile = useCallback(async (userId: string) => {
    if (!supabase) return
    setLoading(true)
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    setProfile((data as Profile | null) ?? null)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (user) {
      fetchProfile(user.id)
    } else {
      setProfile(null)
    }
  }, [user, fetchProfile])

  const refreshProfile = useCallback(async () => {
    if (user) await fetchProfile(user.id)
  }, [user, fetchProfile])

  async function updateProfile(updates: Updates<'profiles'>): Promise<{ error: Error | null }> {
    if (!supabase || !user) return { error: new Error('Not authenticated') }
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single()
    if (!error && data) setProfile(data as Profile)
    return { error }
  }

  async function uploadAvatar(file: File): Promise<{ error: Error | null }> {
    if (!supabase || !user) return { error: new Error('Not authenticated') }

    let resized: File
    try {
      resized = await resizeToJpeg(file, 400)
    } catch {
      return { error: new Error('Failed to process image') }
    }

    const path = `${user.id}/avatar.jpg`
    const { error: uploadError } = await supabase.storage
      .from('recipe-images')
      .upload(path, resized, { upsert: true, contentType: 'image/jpeg' })
    if (uploadError) return { error: uploadError }

    const { data } = supabase.storage.from('recipe-images').getPublicUrl(path)
    // Append cache-buster so browser reloads the updated image
    const avatarUrl = `${data.publicUrl}?t=${Date.now()}`

    const { data: updated, error: dbError } = await supabase
      .from('profiles')
      .update({ avatar_url: avatarUrl })
      .eq('id', user.id)
      .select()
      .single()
    if (!dbError && updated) setProfile(updated as Profile)
    return { error: dbError }
  }

  return (
    <ProfileContext.Provider value={{ profile, loading, updateProfile, uploadAvatar, refreshProfile }}>
      {children}
    </ProfileContext.Provider>
  )
}

export function useProfile() {
  const ctx = useContext(ProfileContext)
  if (!ctx) throw new Error('useProfile must be used within ProfileProvider')
  return ctx
}
