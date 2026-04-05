import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { db } from '../lib/db'
import { fromJson, toJson } from '../lib/jsonUtils'
import { enqueueMutation, isNetworkError } from '../lib/mutationQueue'
import type { MealPlan, MealPlanTemplate } from '../types'

// ─── Query keys ──────────────────────────────────────────────────────────────

export const mealPlanKeys = {
  all: (userId: string) => ['meal-plans', userId] as const,
  detail: (planId: string) => ['meal-plan', planId] as const,
  week: (userId: string, weekStartDate: string) =>
    ['meal-plan-week', userId, weekStartDate] as const,
  templates: (userId: string) => ['meal-plan-templates', userId] as const,
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function now(): string {
  return new Date().toISOString()
}

function id(): string {
  return crypto.randomUUID()
}

async function fetchMealPlans(userId: string): Promise<MealPlan[]> {
  const { data, error } = await supabase
    .from('meal_plans_cloud')
    .select('id, data')
    .eq('owner_id', userId)
    .order('created_at', { ascending: true })

  if (error) {
    // Fallback to Dexie on network error
    return db.mealPlans.orderBy('weekStartDate').toArray()
  }

  const plans = data.map((row) => fromJson<MealPlan>(row.data))
  await db.mealPlans.bulkPut(plans)
  return plans
}

async function fetchMealPlan(planId: string, userId: string): Promise<MealPlan | null> {
  const { data, error } = await supabase
    .from('meal_plans_cloud')
    .select('id, data')
    .eq('id', planId)
    .eq('owner_id', userId)
    .single()

  if (error) {
    const local = await db.mealPlans.get(planId)
    return local ?? null
  }

  const plan = fromJson<MealPlan>(data.data)
  await db.mealPlans.put(plan)
  return plan
}

// ─── Read hooks ───────────────────────────────────────────────────────────────

export function useMealPlans() {
  const { user } = useAuth()
  const userId = user!.id

  return useQuery({
    queryKey: mealPlanKeys.all(userId),
    queryFn: () => fetchMealPlans(userId),
  })
}

export function useMealPlan(planId: string) {
  const { user } = useAuth()
  const userId = user!.id

  return useQuery({
    queryKey: mealPlanKeys.detail(planId),
    queryFn: () => fetchMealPlan(planId, userId),
    enabled: !!planId,
  })
}

export function useMealPlanForWeek(weekStartDate: string) {
  const { user } = useAuth()
  const userId = user!.id

  return useQuery({
    queryKey: mealPlanKeys.week(userId, weekStartDate),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meal_plans_cloud')
        .select('id, data')
        .eq('owner_id', userId)
        .filter('data->>weekStartDate', 'eq', weekStartDate)
        .maybeSingle()

      if (error) {
        // Fallback to Dexie
        const local = await db.mealPlans.where('weekStartDate').equals(weekStartDate).first()
        return local ?? null
      }

      if (!data) return null

      const plan = fromJson<MealPlan>(data.data)
      await db.mealPlans.put(plan)
      return plan
    },
    enabled: !!weekStartDate,
  })
}

// ─── Mutation hooks ───────────────────────────────────────────────────────────

export function useCreateMealPlan() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (data: Omit<MealPlan, 'id' | 'createdAt' | 'updatedAt'>) => {
      const plan: MealPlan = { ...data, id: id(), createdAt: now(), updatedAt: now() }

      // Always apply locally first
      await db.mealPlans.put(plan)

      if (!navigator.onLine) {
        await enqueueMutation({
          userId: user!.id,
          entityType: 'mealPlan',
          operation: 'create',
          entityId: plan.id,
          payload: plan,
        })
        return plan
      }

      const { error } = await supabase.from('meal_plans_cloud').insert({
        id: plan.id,
        owner_id: user!.id,
        data: toJson(plan),
      })

      if (error) {
        if (isNetworkError(new Error(error.message))) {
          await enqueueMutation({
            userId: user!.id,
            entityType: 'mealPlan',
            operation: 'create',
            entityId: plan.id,
            payload: plan,
          })
          return plan
        }
        throw new Error(error.message)
      }

      return plan
    },
    onSuccess: (plan) => {
      qc.setQueryData(mealPlanKeys.detail(plan.id), plan)
      qc.invalidateQueries({ queryKey: mealPlanKeys.all(user!.id) })
      qc.invalidateQueries({
        queryKey: mealPlanKeys.week(user!.id, plan.weekStartDate),
      })
    },
  })
}

export function useUpdateMealPlan() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({
      planId,
      data,
    }: {
      planId: string
      data: Partial<Omit<MealPlan, 'id' | 'createdAt'>>
    }) => {
      const existing = await db.mealPlans.get(planId)
      if (!existing) throw new Error('Meal plan not found')

      const updated: MealPlan = { ...existing, ...data, updatedAt: now() }

      // Always apply locally first
      await db.mealPlans.put(updated)

      if (!navigator.onLine) {
        await enqueueMutation({
          userId: user!.id,
          entityType: 'mealPlan',
          operation: 'update',
          entityId: planId,
          payload: updated,
        })
        return updated
      }

      const { error } = await supabase
        .from('meal_plans_cloud')
        .update({ data: toJson(updated), updated_at: now() })
        .eq('id', planId)
        .eq('owner_id', user!.id)

      if (error) {
        if (isNetworkError(new Error(error.message))) {
          await enqueueMutation({
            userId: user!.id,
            entityType: 'mealPlan',
            operation: 'update',
            entityId: planId,
            payload: updated,
          })
          return updated
        }
        throw new Error(error.message)
      }

      return updated
    },
    onSuccess: (plan) => {
      qc.setQueryData(mealPlanKeys.detail(plan.id), plan)
      qc.invalidateQueries({ queryKey: mealPlanKeys.all(user!.id) })
      qc.invalidateQueries({
        queryKey: mealPlanKeys.week(user!.id, plan.weekStartDate),
      })
    },
  })
}

export function useDeleteMealPlan() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (planId: string) => {
      // Always apply locally first
      await db.mealPlans.delete(planId)

      if (!navigator.onLine) {
        await enqueueMutation({
          userId: user!.id,
          entityType: 'mealPlan',
          operation: 'delete',
          entityId: planId,
          payload: null,
        })
        return
      }

      const { error } = await supabase
        .from('meal_plans_cloud')
        .delete()
        .eq('id', planId)
        .eq('owner_id', user!.id)

      if (error) {
        if (isNetworkError(new Error(error.message))) {
          await enqueueMutation({
            userId: user!.id,
            entityType: 'mealPlan',
            operation: 'delete',
            entityId: planId,
            payload: null,
          })
          return
        }
        throw new Error(error.message)
      }
    },
    onSuccess: (_v, planId) => {
      qc.removeQueries({ queryKey: mealPlanKeys.detail(planId) })
      qc.invalidateQueries({ queryKey: mealPlanKeys.all(user!.id) })
    },
  })
}

// ─── Meal plan templates (Dexie-only — no cloud table) ────────────────────────

export function useMealPlanTemplates() {
  const { user } = useAuth()
  const userId = user!.id

  return useQuery({
    queryKey: mealPlanKeys.templates(userId),
    queryFn: () => db.mealPlanTemplates.orderBy('createdAt').toArray(),
  })
}

export function useCreateMealPlanTemplate() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (data: Omit<MealPlanTemplate, 'id' | 'createdAt' | 'updatedAt'>) => {
      const template: MealPlanTemplate = { ...data, id: id(), createdAt: now(), updatedAt: now() }
      await db.mealPlanTemplates.add(template)
      return template
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: mealPlanKeys.templates(user!.id) })
    },
  })
}

export function useDeleteMealPlanTemplate() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (templateId: string) => db.mealPlanTemplates.delete(templateId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: mealPlanKeys.templates(user!.id) })
    },
  })
}
