import { createPortal } from 'react-dom'
import { X, LayoutTemplate, Trash2 } from 'lucide-react'
import type { MealPlan, MealPlanTemplate } from '../../types'

function formatWeekRange(monday: Date): string {
  const sunday = new Date(monday)
  sunday.setDate(sunday.getDate() + 6)
  const start = monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const end = sunday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return `${start} – ${end}`
}

function countMeals(plan: MealPlan): number {
  let count = 0
  for (const dayPlan of Object.values(plan.days)) {
    for (const slot of Object.values(dayPlan)) {
      if (slot && typeof slot === 'object' && 'recipes' in slot) {
        count += (slot as { recipes: unknown[] }).recipes.length
      } else if (slot) {
        count += 1
      }
    }
  }
  return count
}

// ── Copy Week Modal ───────────────────────────────────────────────────────────

interface CopyWeekModalProps {
  copyTarget: string
  copyTargetPlan: MealPlan | null | undefined
  copyTargetMonday: Date | null
  sourceHasMeals: boolean
  weekStart: string
  onClose: () => void
  onNavigate: (delta: -1 | 1) => void
  onExecute: () => void
}

export function CopyWeekModal({
  copyTarget, copyTargetPlan, copyTargetMonday, sourceHasMeals, weekStart,
  onClose, onNavigate, onExecute,
}: CopyWeekModalProps) {
  const copyTargetHasMeals = copyTargetPlan != null && Object.values(copyTargetPlan.days).some((d) => Object.keys(d).length > 0)
  return createPortal(
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center sm:p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl animate-slide-up sm:animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 className="font-bold text-gray-800 dark:text-gray-100">Copy week to…</h3>
          <button onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors" aria-label="Close"><X size={20} strokeWidth={2} aria-hidden="true" /></button>
        </div>
        <div className="p-4 space-y-4">
          <div className="flex items-center gap-2">
            <button onClick={() => onNavigate(-1)} className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 text-xl font-bold leading-none" aria-label="Previous week">‹</button>
            <div className="text-center flex-1 min-w-0">
              {copyTargetMonday && <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{formatWeekRange(copyTargetMonday)}</p>}
              {copyTargetPlan === undefined && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Checking…</p>}
              {copyTargetHasMeals && <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">Already has meals — will be replaced</p>}
              {copyTargetPlan !== undefined && !copyTargetHasMeals && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Empty week</p>}
            </div>
            <button onClick={() => onNavigate(1)} className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 text-xl font-bold leading-none" aria-label="Next week">›</button>
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">Cancel</button>
            <button onClick={onExecute} disabled={!sourceHasMeals || copyTarget === weekStart || copyTargetPlan === undefined} className="flex-1 px-4 py-2.5 rounded-xl bg-green-700 text-white text-sm font-medium hover:bg-green-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              {copyTargetHasMeals ? 'Copy anyway' : 'Copy'}
            </button>
          </div>
          {!sourceHasMeals && <p className="text-xs text-center text-gray-400 dark:text-gray-500">This week has no meals to copy.</p>}
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── Template Gallery Modal ────────────────────────────────────────────────────

interface TemplateGalleryModalProps {
  templates: MealPlanTemplate[]
  sourceHasMeals: boolean
  onClose: () => void
  onApply: (t: MealPlanTemplate) => void
  onDelete: (id: string) => void
  onSaveNew: () => void
}

export function TemplateGalleryModal({ templates, sourceHasMeals, onClose, onApply, onDelete, onSaveNew }: TemplateGalleryModalProps) {
  return createPortal(
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center sm:p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl flex flex-col max-h-[80vh] animate-slide-up sm:animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 className="font-bold text-gray-800 dark:text-gray-100">Meal plan templates</h3>
          <button onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors" aria-label="Close"><X size={20} strokeWidth={2} aria-hidden="true" /></button>
        </div>
        <div className="overflow-y-auto flex-1">
          {templates.length === 0 ? (
            <div className="flex flex-col items-center text-center py-10 px-4">
              <LayoutTemplate size={32} strokeWidth={1.5} className="text-gray-300 dark:text-gray-600 mb-3" aria-hidden="true" />
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">No templates yet</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Save a week as a template to reuse it later.</p>
            </div>
          ) : templates.map((t) => (
            <div key={t.id} className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700 last:border-0">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{t.name}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{Object.keys(t.days).length} day{Object.keys(t.days).length !== 1 ? 's' : ''}</p>
              </div>
              <div className="flex items-center gap-2 ml-3 shrink-0">
                <button onClick={() => onApply(t)} className="text-xs font-medium text-green-600 dark:text-green-400 border border-green-600 dark:border-green-500 px-2.5 py-1 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors">Apply</button>
                <button onClick={() => onDelete(t.id)} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 dark:text-gray-500 hover:text-red-500 transition-colors" aria-label={`Delete ${t.name}`}><Trash2 size={14} strokeWidth={2} aria-hidden="true" /></button>
              </div>
            </div>
          ))}
        </div>
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <button onClick={onSaveNew} disabled={!sourceHasMeals} className="w-full bg-green-700 text-white text-sm font-semibold py-3 rounded-xl hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">Save this week as template</button>
          {!sourceHasMeals && <p className="text-xs text-gray-400 dark:text-gray-500 text-center mt-2">Add meals to save as a template.</p>}
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── Save Template Dialog ──────────────────────────────────────────────────────

interface SaveTemplateDialogProps {
  templateName: string
  isPending: boolean
  onChange: (v: string) => void
  onSave: () => void
  onClose: () => void
}

export function SaveTemplateDialog({ templateName, isPending, onChange, onSave, onClose }: SaveTemplateDialogProps) {
  return createPortal(
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 max-w-sm w-full shadow-xl animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-1">Save as template</h4>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Give this week's meals a name so you can reuse them.</p>
        <input type="text" placeholder="e.g. High-protein week" value={templateName} onChange={(e) => onChange(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && templateName.trim()) onSave() }} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 mb-4" autoFocus />
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-sm font-medium py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">Cancel</button>
          <button onClick={onSave} disabled={!templateName.trim() || isPending} className="flex-1 bg-green-700 text-white text-sm font-medium py-2 rounded-lg hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">{isPending ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── History Modal ─────────────────────────────────────────────────────────────

interface HistoryModalProps {
  histMealPlans: MealPlan[]
  onClose: () => void
  onView: (weekStart: string) => void
  onCopyHere: (plan: MealPlan) => void
}

export function HistoryModal({ histMealPlans, onClose, onView, onCopyHere }: HistoryModalProps) {
  return createPortal(
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center sm:p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl flex flex-col max-h-[80vh] animate-slide-up sm:animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 className="font-bold text-gray-800 dark:text-gray-100">Meal plan history</h3>
          <button onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors" aria-label="Close"><X size={20} strokeWidth={2} aria-hidden="true" /></button>
        </div>
        <div className="overflow-y-auto flex-1">
          {histMealPlans.length === 0 ? (
            <div className="flex flex-col items-center text-center py-10 px-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">No history yet</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Past weeks with meals will appear here.</p>
            </div>
          ) : histMealPlans.map((plan) => {
            const monday = new Date(plan.weekStartDate + 'T00:00:00')
            const mealCount = countMeals(plan)
            return (
              <div key={plan.id} className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700 last:border-0">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{formatWeekRange(monday)}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{mealCount} meal{mealCount !== 1 ? 's' : ''}</p>
                </div>
                <div className="flex items-center gap-2 ml-3 shrink-0">
                  <button onClick={() => onView(plan.weekStartDate)} className="text-xs font-medium text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 px-2.5 py-1 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">View</button>
                  <button onClick={() => onCopyHere(plan)} className="text-xs font-medium text-green-600 dark:text-green-400 border border-green-600 dark:border-green-500 px-2.5 py-1 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors">Copy here</button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── Apply Template Confirm ────────────────────────────────────────────────────

interface ApplyTemplateConfirmProps {
  template: MealPlanTemplate
  onConfirm: () => void
  onCancel: () => void
}

export function ApplyTemplateConfirm({ template, onConfirm, onCancel }: ApplyTemplateConfirmProps) {
  return createPortal(
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onCancel}>
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 max-w-sm w-full shadow-xl animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">Apply "{template.name}"?</h4>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">This will replace all meals in the current week with meals from this template.</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-sm font-medium py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">Cancel</button>
          <button onClick={onConfirm} className="flex-1 bg-green-700 text-white text-sm font-medium py-2 rounded-lg hover:bg-green-800 transition-colors">Apply</button>
        </div>
      </div>
    </div>,
    document.body
  )
}
