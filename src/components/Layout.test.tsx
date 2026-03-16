import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Layout from './Layout'

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockNavigate, mockSignOut } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockSignOut: vi.fn().mockResolvedValue({ error: null }),
}))

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({ user: null, signOut: mockSignOut })),
}))

vi.mock('../contexts/ProfileContext', () => ({
  useProfile: vi.fn(() => ({ profile: null })),
}))

vi.mock('../lib/supabase', () => ({
  isSupabaseAvailable: vi.fn(() => false),
  supabase: null,
}))

vi.mock('./OnboardingWizard', () => ({
  default: ({ onDone }: { onDone: () => void }) => (
    <div data-testid="onboarding-wizard">
      <button onClick={onDone}>Done</button>
    </div>
  ),
  isOnboardingDone: vi.fn(() => true),
}))

vi.mock('./MigrationPrompt', () => ({ default: () => null }))
vi.mock('./AppUpdateBanner', () => ({ default: () => null }))
vi.mock('./PWAInstallBanner', () => ({ default: () => null }))
vi.mock('./OfflineBanner', () => ({ default: () => null }))
vi.mock('./ToastContainer', () => ({ default: () => null }))
vi.mock('./KeyboardShortcutsDialog', () => ({
  default: ({ onClose }: { onClose: () => void }) => (
    <div role="dialog" aria-label="Keyboard shortcuts">
      <button onClick={onClose}>Close</button>
    </div>
  ),
}))
vi.mock('../hooks/useKeyboardShortcuts', () => ({
  useKeyboardShortcuts: vi.fn(),
}))
vi.mock('../lib/notificationService', () => ({
  getUnreadCount: vi.fn().mockResolvedValue(0),
  subscribeToNotifications: vi.fn().mockReturnValue(() => {}),
}))
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

import * as AuthContext from '../contexts/AuthContext'
import * as ProfileContext from '../contexts/ProfileContext'
import * as supabaseLib from '../lib/supabase'
import * as OnboardingWizard from './OnboardingWizard'

function renderLayout(initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Layout />
    </MemoryRouter>,
  )
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Layout', () => {
  beforeEach(() => {
    vi.mocked(AuthContext.useAuth).mockReturnValue(
      { user: null, signOut: mockSignOut } as unknown as ReturnType<typeof AuthContext.useAuth>,
    )
    vi.mocked(ProfileContext.useProfile).mockReturnValue(
      { profile: null } as unknown as ReturnType<typeof ProfileContext.useProfile>,
    )
    vi.mocked(supabaseLib.isSupabaseAvailable).mockReturnValue(false)
    vi.mocked(OnboardingWizard.isOnboardingDone).mockReturnValue(true)
    mockNavigate.mockClear()
    mockSignOut.mockClear()
  })

  // ── App branding ────────────────────────────────────────────────────────────

  describe('app branding', () => {
    it('renders the app name in the sidebar', () => {
      renderLayout()
      // The sidebar h1 (desktop)
      const headings = screen.getAllByRole('heading', { name: 'Mise' })
      expect(headings.length).toBeGreaterThanOrEqual(1)
    })
  })

  // ── Navigation items ────────────────────────────────────────────────────────

  describe('navigation items', () => {
    const expectedItems = [
      { label: 'Recipes', href: '/' },
      { label: 'Collections', href: '/collections' },
      { label: 'Meal Plan', href: '/meal-plan' },
      { label: 'Shopping', href: '/shopping' },
      { label: 'Pantry', href: '/pantry' },
      { label: 'Discover', href: '/discover' },
      { label: 'Friends', href: '/friends' },
      { label: 'Groups', href: '/groups' },
      { label: 'Alerts', href: '/notifications' },
      { label: 'Settings', href: '/settings' },
    ]

    it('renders all navigation links in the mobile tab bar', () => {
      renderLayout()
      // Mobile bottom nav has one set; desktop sidebar has another.
      // getAllByRole returns both — check that each label appears at least once.
      for (const item of expectedItems) {
        const links = screen.getAllByRole('link', { name: item.label })
        expect(links.length).toBeGreaterThanOrEqual(1)
      }
    })

    it('each navigation link points to the correct path', () => {
      renderLayout()
      for (const item of expectedItems) {
        const links = screen.getAllByRole('link', { name: item.label })
        for (const link of links) {
          expect(link).toHaveAttribute('href', item.href)
        }
      }
    })

    it('renders exactly 9 navigation items in the mobile tab bar', () => {
      const { container } = renderLayout()
      // The mobile bottom tab bar is the fixed nav at the bottom (md:hidden)
      const mobileNav = container.querySelector('nav.md\\:hidden.fixed')
      expect(mobileNav).toBeInTheDocument()
      const links = mobileNav!.querySelectorAll('a')
      expect(links).toHaveLength(10)
    })

    it('renders exactly 11 navigation items in the desktop sidebar', () => {
      const { container } = renderLayout()
      const sidebar = container.querySelector('aside')
      expect(sidebar).toBeInTheDocument()
      // sidebar may contain auth link too — count only nav links inside <nav>
      const sidebarNav = sidebar!.querySelector('nav')
      expect(sidebarNav).toBeInTheDocument()
      const navLinks = sidebarNav!.querySelectorAll('a')
      expect(navLinks).toHaveLength(11)
    })
  })

  // ── Active route highlighting ────────────────────────────────────────────────

  describe('active route highlighting', () => {
    it('applies active styles to the Recipes link when on the home route', () => {
      renderLayout('/')
      // The active class contains "green" for active items
      const recipeLinks = screen.getAllByRole('link', { name: 'Recipes' })
      // At least one link should have the active (green) class
      const hasActive = recipeLinks.some((link) => link.className.includes('green'))
      expect(hasActive).toBe(true)
    })

    it('applies active styles to the Meal Plan link when on /meal-plan', () => {
      renderLayout('/meal-plan')
      const mealPlanLinks = screen.getAllByRole('link', { name: 'Meal Plan' })
      const hasActive = mealPlanLinks.some((link) => link.className.includes('green'))
      expect(hasActive).toBe(true)
    })

    it('does not apply active styles to Recipes when on /meal-plan', () => {
      renderLayout('/meal-plan')
      const recipeLinks = screen.getAllByRole('link', { name: 'Recipes' })
      const allInactive = recipeLinks.every((link) => !link.className.includes('green'))
      expect(allInactive).toBe(true)
    })

    it('applies active styles to the Shopping link when on /shopping', () => {
      renderLayout('/shopping')
      const shoppingLinks = screen.getAllByRole('link', { name: 'Shopping' })
      const hasActive = shoppingLinks.some((link) => link.className.includes('green'))
      expect(hasActive).toBe(true)
    })
  })

  // ── Responsive structure ─────────────────────────────────────────────────────

  describe('responsive structure', () => {
    it('renders the mobile header element', () => {
      const { container } = renderLayout()
      const mobileHeader = container.querySelector('header.md\\:hidden')
      expect(mobileHeader).toBeInTheDocument()
    })

    it('renders the desktop sidebar element', () => {
      const { container } = renderLayout()
      const sidebar = container.querySelector('aside.hidden')
      expect(sidebar).toBeInTheDocument()
    })

    it('renders the mobile bottom tab bar', () => {
      const { container } = renderLayout()
      const mobileNav = container.querySelector('nav.md\\:hidden')
      expect(mobileNav).toBeInTheDocument()
    })

    it('renders the main content outlet area', () => {
      const { container } = renderLayout()
      const main = container.querySelector('main')
      expect(main).toBeInTheDocument()
    })
  })

  // ── Auth section — Supabase unavailable ─────────────────────────────────────

  describe('when Supabase is not available', () => {
    it('does not show the sign in link in the sidebar', () => {
      vi.mocked(supabaseLib.isSupabaseAvailable).mockReturnValue(false)
      renderLayout()
      const signInLinks = screen.queryAllByRole('link', { name: /sign in/i })
      expect(signInLinks).toHaveLength(0)
    })

    it('does not show the sign out button in the sidebar', () => {
      vi.mocked(supabaseLib.isSupabaseAvailable).mockReturnValue(false)
      renderLayout()
      expect(screen.queryByRole('button', { name: /sign out/i })).not.toBeInTheDocument()
    })
  })

  // ── Auth section — unauthenticated ──────────────────────────────────────────

  describe('when Supabase is available and user is signed out', () => {
    beforeEach(() => {
      vi.mocked(supabaseLib.isSupabaseAvailable).mockReturnValue(true)
      vi.mocked(AuthContext.useAuth).mockReturnValue(
        { user: null, signOut: mockSignOut } as unknown as ReturnType<typeof AuthContext.useAuth>,
      )
    })

    it('shows sign in links (sidebar + mobile header)', () => {
      renderLayout()
      const links = screen.getAllByRole('link', { name: /sign in/i })
      expect(links.length).toBeGreaterThanOrEqual(1)
    })

    it('all sign in links point to /auth/login', () => {
      renderLayout()
      const links = screen.getAllByRole('link', { name: /sign in/i })
      for (const link of links) {
        expect(link).toHaveAttribute('href', '/auth/login')
      }
    })

    it('does not show sign out button', () => {
      renderLayout()
      expect(screen.queryByRole('button', { name: /sign out/i })).not.toBeInTheDocument()
    })
  })

  // ── Auth section — authenticated ─────────────────────────────────────────────

  describe('when Supabase is available and user is signed in', () => {
    const mockUser = { id: 'user-1', email: 'test@example.com' } as ReturnType<
      typeof AuthContext.useAuth
    >['user']

    beforeEach(() => {
      vi.mocked(supabaseLib.isSupabaseAvailable).mockReturnValue(true)
      vi.mocked(AuthContext.useAuth).mockReturnValue(
        { user: mockUser, signOut: mockSignOut } as unknown as ReturnType<typeof AuthContext.useAuth>,
      )
    })

    it('shows the sign out button', () => {
      renderLayout()
      expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument()
    })

    it('does not show the sign in link', () => {
      renderLayout()
      expect(screen.queryByRole('link', { name: /sign in/i })).not.toBeInTheDocument()
    })

    it('shows the user email', () => {
      renderLayout()
      expect(screen.getByText('test@example.com')).toBeInTheDocument()
    })

    it('shows the profile display name when profile is loaded', () => {
      vi.mocked(ProfileContext.useProfile).mockReturnValue({
        profile: { display_name: 'Alice', id: 'user-1' },
      } as unknown as ReturnType<typeof ProfileContext.useProfile>)
      renderLayout()
      expect(screen.getByText('Alice')).toBeInTheDocument()
    })

    it('calls signOut and navigates to / when sign out button is clicked', async () => {
      const user = userEvent.setup()
      renderLayout()
      await user.click(screen.getByRole('button', { name: /sign out/i }))
      expect(mockSignOut).toHaveBeenCalled()
      await vi.waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true })
      })
    })
  })

  // ── Onboarding wizard ────────────────────────────────────────────────────────

  describe('onboarding wizard', () => {
    it('does not show the wizard when onboarding is done', () => {
      vi.mocked(OnboardingWizard.isOnboardingDone).mockReturnValue(true)
      renderLayout()
      expect(screen.queryByTestId('onboarding-wizard')).not.toBeInTheDocument()
    })

    it('shows the wizard on first visit when onboarding is not done', () => {
      vi.mocked(OnboardingWizard.isOnboardingDone).mockReturnValue(false)
      renderLayout()
      expect(screen.getByTestId('onboarding-wizard')).toBeInTheDocument()
    })

    it('hides the wizard after completion', async () => {
      const user = userEvent.setup()
      vi.mocked(OnboardingWizard.isOnboardingDone).mockReturnValue(false)
      renderLayout()
      await user.click(screen.getByRole('button', { name: 'Done' }))
      expect(screen.queryByTestId('onboarding-wizard')).not.toBeInTheDocument()
    })
  })

  // ── Keyboard shortcuts dialog ────────────────────────────────────────────────

  describe('keyboard shortcuts dialog', () => {
    it('shows the keyboard shortcuts hint button in the sidebar', () => {
      renderLayout()
      expect(screen.getByRole('button', { name: /keyboard shortcuts/i })).toBeInTheDocument()
    })

    it('opens the keyboard shortcuts dialog when the hint button is clicked', async () => {
      const user = userEvent.setup()
      renderLayout()
      await user.click(screen.getByRole('button', { name: /keyboard shortcuts/i }))
      expect(screen.getByRole('dialog', { name: /keyboard shortcuts/i })).toBeInTheDocument()
    })

    it('closes the keyboard shortcuts dialog when onClose is called', async () => {
      const user = userEvent.setup()
      renderLayout()
      await user.click(screen.getByRole('button', { name: /keyboard shortcuts/i }))
      await user.click(screen.getByRole('button', { name: 'Close' }))
      expect(screen.queryByRole('dialog', { name: /keyboard shortcuts/i })).not.toBeInTheDocument()
    })
  })
})
