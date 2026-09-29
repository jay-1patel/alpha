'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  lazy,
  Suspense,
} from 'react'

import { cn } from '@/lib/utils'

import {
  LayoutDashboard,
  FileText,
  MessageSquare,
  History,
  Package,
  Settings,
  Users,
  Menu,
  X,
  ChevronRight,
  LogOut,
  Inbox,
  Megaphone,
  Building2,
  BarChart3,
  Bot,
  ListTree,
} from 'lucide-react'

import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query'
import { Toaster as HotToaster } from 'react-hot-toast'

import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { TooltipProvider } from '@/components/ui/tooltip'

import { toast, Toaster } from 'sonner'

import {
  getToken,
  clearToken,
  getCurrentUsername,
  setCurrentUsername,
  clearCurrentUsername,
  api,
} from '@/lib/api'

const DashboardTab = lazy(() => import('@/components/dashboard/dashboard-tab'))
const FilesTab = lazy(() => import('@/components/files/files-tab'))
const ChatTab = lazy(() => import('@/components/chat/chat-tab'))
const ChatHistoryTab = lazy(() => import('@/components/chat-history/chat-history-tab'))
const ProductsTab = lazy(() => import('@/components/products/products-tab'))
const ChangePasswordPage = lazy(() => import('@/components/auth/change-password'))
const ManageAdminsPage = lazy(() => import('@/components/admins/manage-admins'))
const InboxTab = lazy(() => import('@/components/inbox/inbox-tab'))
const CampaignsTab = lazy(() => import('@/components/campaigns/campaigns-tab'))
const DistributorsTab = lazy(() => import('@/components/distributors/distributors-tab'))
const AnalyticsTab = lazy(() => import('@/components/analytics/analytics-tab'))
const WhatsAppTester = lazy(() => import('@/components/tester/whatsapp-tester'))
const MenuManagerTab = lazy(() => import('@/components/menu-manager/menu-manager-tab'))

const LoginPage = lazy(() => import('@/components/auth/login'))
const ForgotPasswordPage = lazy(() => import('@/components/auth/forgot-password'))

/* -------------------------------------------------------------------------- */
/* TYPES                                                                      */
/* -------------------------------------------------------------------------- */

type TabType =
  | 'dashboard'
  | 'files'
  | 'chat'
  | 'chat-history'
  | 'products'
  | 'inbox'
  | 'campaigns'
  | 'distributors'
  | 'analytics'
  | 'tester'
  | 'menu-manager'
  | 'change-password'
  | 'manage-admins'

interface PermissionMap {
  manage_admins?: boolean
  upload_faq?: boolean
  upload_kb?: boolean
  view_files?: boolean
  delete_files?: boolean
  view_products?: boolean
  edit_delete_products?: boolean
  manage_operations?: boolean
  chat?: boolean
  chat_history?: boolean
  catalogue_new_arrival?: boolean
}

/* -------------------------------------------------------------------------- */
/* PERMISSIONS                                                                */
/* -------------------------------------------------------------------------- */

const ALL_PERMISSIONS: {
  key: keyof PermissionMap
  label: string
  tabId: TabType
}[] = [
  {
    key: 'view_products',
    label: 'View Products',
    tabId: 'products',
  },
  {
    key: 'edit_delete_products',
    label: 'Edit/Delete Products',
    tabId: 'products',
  },
  {
    key: 'manage_operations',
    label: 'Manage Operations (publish products, menus, prices, schemes)',
    tabId: 'products',
  },
  {
    key: 'chat',
    label: 'Chat',
    tabId: 'chat',
  },
  {
    key: 'chat_history',
    label: 'Chat History',
    tabId: 'chat-history',
  },
  {
    key: 'view_files',
    label: 'Files',
    tabId: 'files',
  },
  {
    key: 'manage_admins',
    label: 'Manage Admins',
    tabId: 'manage-admins',
  },
]

/* -------------------------------------------------------------------------- */
/* NAVIGATION                                                                 */
/* -------------------------------------------------------------------------- */

const navItems: {
  id: TabType
  label: string
  icon: React.ComponentType<{
    className?: string
  }>
  permission?: keyof PermissionMap
}[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
  },
  {
    id: 'products',
    label: 'Products & Catalogue',
    icon: Package,
    permission: 'view_products',
  },
  {
    id: 'files',
    label: 'Files',
    icon: FileText,
    permission: 'view_files',
  },
  {
    id: 'chat',
    label: 'Chat',
    icon: MessageSquare,
    permission: 'chat',
  },
  {
    id: 'chat-history',
    label: 'Chat History',
    icon: History,
    permission: 'chat_history',
  },
  {
    id: 'inbox',
    label: 'Live Inbox',
    icon: Inbox,
  },
  {
    id: 'campaigns',
    label: 'Campaigns',
    icon: Megaphone,
  },
  {
    id: 'distributors',
    label: 'Distributors',
    icon: Building2,
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: BarChart3,
  },
  {
    id: 'tester',
    label: 'WhatsApp Tester',
    icon: Bot,
  },
  {
    id: 'menu-manager',
    label: 'Menu Manager',
    icon: ListTree,
    permission: 'view_files',
  },
  {
    id: 'manage-admins',
    label: 'Manage Admins',
    icon: Users,
    permission: 'manage_admins',
  },
]

const TAB_IDS: TabType[] = [
  'dashboard',
  'products',
  'files',
  'chat',
  'chat-history',
  'inbox',
  'campaigns',
  'distributors',
  'analytics',
  'tester',
  'menu-manager',
  'manage-admins',
  'change-password',
]

/* -------------------------------------------------------------------------- */
/* HELPERS                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Returns the route without leading/trailing slashes.
 *
 * /chat-history      -> chat-history
 * /chat-history/     -> chat-history
 * /                  -> ""
 */
function currentPath(): string {
  if (typeof window === 'undefined') {
    return ''
  }

  return window.location.pathname.replace(
    /^\/+|\/+$/g,
    ''
  )
}

/**
 * Check whether the supplied route is one of our valid app routes.
 */
function isTabRoute(path: string): path is TabType {
  return TAB_IDS.includes(path as TabType)
}

/**
 * Determine whether a user can access a particular tab.
 *
 * This accepts permissions explicitly instead of depending on React state.
 * That's important during initial authentication because the permissions
 * returned from /me are available before setPermissions() has completed.
 */
function canAccessTab(
  tab: TabType,
  permissions: PermissionMap
): boolean {
  switch (tab) {
    case 'dashboard':
      return true

    case 'change-password':
      return true

    case 'products':
      return (
        permissions.view_products === true ||
        permissions.edit_delete_products === true ||
        permissions.catalogue_new_arrival === true
      )

    case 'files':
      return permissions.view_files === true

    case 'chat':
      return permissions.chat === true

    case 'chat-history':
      return permissions.chat_history === true

    case 'inbox':
    case 'campaigns':
    case 'distributors':
    case 'analytics':
    case 'tester':
      return true

    case 'menu-manager':
      return permissions.view_files === true

    case 'manage-admins':
      return permissions.manage_admins === true

    default:
      return false
  }
}

/**
 * Resolve a URL to an accessible tab.
 *
 * Valid + permitted route:
 * /chat-history -> chat-history
 *
 * Invalid route:
 * /something -> dashboard
 *
 * Valid but unauthorized route:
 * /manage-admins -> dashboard
 */
function resolvePathToTab(
  path: string,
  permissions: PermissionMap
): TabType {
  if (!isTabRoute(path)) {
    return 'dashboard'
  }

  if (!canAccessTab(path, permissions)) {
    return 'dashboard'
  }

  return path
}

/* -------------------------------------------------------------------------- */
/* REACT QUERY                                                                */
/* -------------------------------------------------------------------------- */

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

/* -------------------------------------------------------------------------- */
/* COMPONENT                                                                  */
/* -------------------------------------------------------------------------- */

export default function App() {
  const [activeTab, setActiveTab] =
    useState<TabType>('dashboard')

  const [sidebarOpen, setSidebarOpen] =
    useState(false)

  const [authed, setAuthed] =
    useState(false)

  const [checking, setChecking] =
    useState(true)

  const [username, setUsername] =
    useState<string | null>(null)

  const [permissions, setPermissions] =
    useState<PermissionMap>({})

  const [authView, setAuthView] =
    useState<'login' | 'forgot-password'>(
      'login'
    )

  /**
   * References allow popstate/hashchange handlers to always have the
   * latest authentication state and permissions without recreating
   * the browser listeners.
   */
  const authedRef = useRef(false)

  const permissionsRef =
    useRef<PermissionMap>({})

  useEffect(() => {
    authedRef.current = authed
  }, [authed])

  useEffect(() => {
    permissionsRef.current = permissions
  }, [permissions])

  /* ---------------------------------------------------------------------- */
  /* NAVIGATE                                                               */
  /* ---------------------------------------------------------------------- */

  const navigate = useCallback(
    (tab: TabType) => {
      if (!canAccessTab(tab, permissions)) {
        toast.error(
          'You do not have permission to access this page'
        )
        return
      }

      setActiveTab(tab)

      if (currentPath() !== tab) {
        window.history.pushState(
          null,
          '',
          `/${tab}`
        )
      }

      setSidebarOpen(false)
    },
    [permissions]
  )

  /* ---------------------------------------------------------------------- */
  /* BROWSER BACK / FORWARD + HASH                                          */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    const handleUrl = () => {
      const path = currentPath()

      /* Forgot Password */
      if (
        window.location.hash ===
          '#forgot-password' ||
        path === 'forgot-password'
      ) {
        setAuthView('forgot-password')
        return
      }

      setAuthView('login')

      /*
       * Don't resolve authenticated routes until authentication has
       * completed. This prevents /chat-history from being converted
       * into /dashboard before permissions have loaded.
       */
      if (!authedRef.current) {
        return
      }

      const tab = resolvePathToTab(
        path,
        permissionsRef.current
      )

      setActiveTab(tab)

      /*
       * Only replace the URL if the original URL is invalid or
       * inaccessible.
       */
      if (path !== tab) {
        window.history.replaceState(
          null,
          '',
          `/${tab}`
        )
      }
    }

    window.addEventListener(
      'popstate',
      handleUrl
    )

    window.addEventListener(
      'hashchange',
      handleUrl
    )

    return () => {
      window.removeEventListener(
        'popstate',
        handleUrl
      )

      window.removeEventListener(
        'hashchange',
        handleUrl
      )
    }
  }, [])

  /* ---------------------------------------------------------------------- */
  /* INITIAL AUTHENTICATION                                                  */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    let cancelled = false

    const initializeAuth = async () => {
      const token = getToken()

      if (!token) {
        if (!cancelled) {
          setAuthed(false)
          setChecking(false)
        }

        return
      }

      try {
        const data = await api.getAdminMe()

        if (cancelled) {
          return
        }

        /*
         * IMPORTANT:
         * Use the permissions returned directly from the API here.
         *
         * Do not call resolvePathToTab(path, permissions), because
         * React's permissions state may still contain {} at this point.
         */
        const loadedPermissions: PermissionMap =
          data.permissions || {}

        const loadedUsername =
          data.username || ''

        /* Update refs immediately */
        permissionsRef.current =
          loadedPermissions

        authedRef.current = true

        /* Update React state */
        setPermissions(loadedPermissions)
        setUsername(loadedUsername)
        setAuthed(true)

        /* Username storage */
        const saved =
          getCurrentUsername()

        if (
          saved &&
          saved !== loadedUsername
        ) {
          clearCurrentUsername()
        }

        if (
          !saved ||
          saved !== loadedUsername
        ) {
          setCurrentUsername(
            loadedUsername
          )
        }

        /*
         * Preserve the current route after refresh.
         *
         * Example:
         * Browser URL = /chat-history
         *
         * If chat_history === true:
         * activeTab becomes chat-history
         * URL stays /chat-history
         */
        const path = currentPath()

        const tab = resolvePathToTab(
          path,
          loadedPermissions
        )

        setActiveTab(tab)

        /*
         * Only redirect when the current route isn't valid/accessible.
         */
        if (path !== tab) {
          window.history.replaceState(
            null,
            '',
            `/${tab}`
          )
        }
      } catch {
        if (cancelled) {
          return
        }

        clearToken()
        clearCurrentUsername()

        permissionsRef.current = {}
        authedRef.current = false

        setPermissions({})
        setUsername(null)
        setAuthed(false)
      } finally {
        if (!cancelled) {
          setChecking(false)
        }
      }
    }

    initializeAuth()

    return () => {
      cancelled = true
    }
  }, [])

  /* ---------------------------------------------------------------------- */
  /* LOGOUT                                                                 */
  /* ---------------------------------------------------------------------- */

  const handleLogout = () => {
    clearToken()
    clearCurrentUsername()

    authedRef.current = false
    permissionsRef.current = {}

    setAuthed(false)
    setUsername(null)
    setPermissions({})
    setActiveTab('dashboard')

    /*
     * Optional but useful:
     * don't leave /chat-history etc. in the URL after logout.
     */
    window.history.replaceState(
      null,
      '',
      '/login'
    )

    setAuthView('login')

    toast.success('Logged out')
  }

  /* ---------------------------------------------------------------------- */
  /* PERMISSION HELPERS                                                      */
  /* ---------------------------------------------------------------------- */

  const hasPermission = (
    permission: keyof PermissionMap
  ) => {
    return permissions[permission] === true
  }

  const hasTabAccess = (
    id: TabType
  ) => {
    return canAccessTab(
      id,
      permissions
    )
  }

  const visibleNavItems =
    navItems.filter((item) =>
      hasTabAccess(item.id)
    )

  /* ---------------------------------------------------------------------- */
  /* LOADING                                                                */
  /* ---------------------------------------------------------------------- */

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-3 text-muted-foreground">

          <div
            className="
              h-5 w-5
              animate-spin
              rounded-full
              border-2
              border-primary
              border-t-transparent
            "
          />

          <span className="text-base">
            Loading...
          </span>

        </div>
      </div>
    )
  }

  /* ---------------------------------------------------------------------- */
  /* AUTH SCREENS                                                           */
  /* ---------------------------------------------------------------------- */

  if (!authed) {
    return (
      <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-background"><div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>}>
        {authView === 'forgot-password' ? <ForgotPasswordPage /> : <LoginPage />}
      </Suspense>
    )
  }

  /* ---------------------------------------------------------------------- */
  /* TAB CONTENT                                                            */
  /* ---------------------------------------------------------------------- */

  const renderTab = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardTab />

      case 'files':
        return (
          <FilesTab
            permissions={permissions}
          />
        )

      case 'chat':
        return (
          <ChatTab
            currentUsername={
              username || 'admin'
            }
          />
        )

      case 'chat-history':
        return <ChatHistoryTab />

      case 'inbox':
        return <InboxTab />

      case 'campaigns':
        return <CampaignsTab />

      case 'distributors':
        return <DistributorsTab />

      case 'analytics':
        return <AnalyticsTab />

      case 'tester':
        return <WhatsAppTester />

      case 'menu-manager':
        return <MenuManagerTab />

      case 'products':
        return (
          <ProductsTab
            permissions={permissions}
          />
        )

      case 'change-password':
        return <ChangePasswordPage />

      case 'manage-admins':
        return <ManageAdminsPage />

      default:
        return <DashboardTab />
    }
  }

  /* ---------------------------------------------------------------------- */
  /* CURRENT PAGE INFORMATION                                               */
  /* ---------------------------------------------------------------------- */

  const currentNavItem =
    navItems.find(
      (item) =>
        item.id === activeTab
    )

  /* ---------------------------------------------------------------------- */
  /* APP                                                                    */
  /* ---------------------------------------------------------------------- */

  return (
    <>
      <Toaster
        position="top-right"
        richColors
      />

      {/* react-hot-toast — used by Inbox & Campaigns modules */}
      <HotToaster
        position="bottom-right"
        toastOptions={{
          style: {
            borderRadius: '10px',
            background: '#1e293b',
            color: '#f8fafc',
          },
        }}
      />

      <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={0}>
        <div className="flex min-h-screen bg-background">

          {/* -------------------------------------------------------------- */}
          {/* MOBILE OVERLAY                                                 */}
          {/* -------------------------------------------------------------- */}

          {sidebarOpen && (
            <div
              className="
                fixed inset-0
                z-40
                bg-black/50
                lg:hidden
              "
              onClick={() =>
                setSidebarOpen(false)
              }
            />
          )}

          {/* -------------------------------------------------------------- */}
          {/* SIDEBAR                                                        */}
          {/* -------------------------------------------------------------- */}

          <aside
            className={cn(
              `
                fixed
                left-0
                top-0
                z-50
                flex
                h-screen
                w-64
                flex-col
                border-r
                bg-card
                transition-transform
                duration-300
                ease-in-out

                lg:sticky
                lg:translate-x-0
              `,
              sidebarOpen
                ? 'translate-x-0'
                : '-translate-x-full'
            )}
          >

            {/* SIDEBAR HEADER */}

            <div className="relative flex flex-col items-center gap-2 border-b p-6">

              <Button
                variant="ghost"
                size="icon"
                className="
                  absolute
                  right-4
                  top-4
                  h-8 w-8
                  lg:hidden
                "
                onClick={() =>
                  setSidebarOpen(false)
                }
              >
                <X className="h-4 w-4" />
              </Button>

              <img
                src="/troogood_logo.png"
                alt="TrooGood"
                className="
                  h-34 w-24
                  rounded-xl
                  object-contain
                "
              />

              <div className="text-center">

                <h1 className="text-lg font-semibold">
                  Admin Panel
                </h1>

                <p className="text-sm text-muted-foreground">
                  WhatsApp Bot
                </p>

              </div>
            </div>

            {/* ------------------------------------------------------------ */}
            {/* NAVIGATION                                                   */}
            {/* ------------------------------------------------------------ */}

            <div className="min-h-0 flex-1 overflow-hidden">
              <ScrollArea className="h-full py-4">
              <nav className="space-y-1 px-3">

                {visibleNavItems.map(
                  (item) => {
                    const Icon =
                      item.icon

                    const isActive =
                      activeTab ===
                      item.id

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() =>
                          navigate(
                            item.id
                          )
                        }
                        className={cn(
                          `
                            flex
                            w-full
                            items-center
                            gap-3
                            rounded-lg
                            px-3
                            py-3
                            text-base
                            font-medium
                            transition-all
                            duration-150

                            hover:bg-accent
                            hover:text-accent-foreground
                          `,
                          isActive
                            ? `
                              bg-gradient-to-r
                              from-sky-500
                              to-blue-600
                              text-white
                              shadow-sm
                              shadow-blue-500/25

                              hover:from-sky-600
                              hover:to-blue-700
                              hover:text-white
                            `
                            : 'text-muted-foreground'
                        )}
                      >

                        <Icon className="h-5 w-5 shrink-0" />

                        <span className="flex-1 text-left">
                          {item.label}
                        </span>

                        {isActive && (
                          <ChevronRight className="h-5 w-5 shrink-0" />
                        )}

                      </button>
                    )
                  }
                )}

                <Separator className="my-3" />

                {/* ACCOUNT SETTINGS */}

                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      'change-password'
                    )
                  }
                  className={cn(
                    `
                      flex
                      w-full
                      items-center
                      gap-3
                      rounded-lg
                      px-3
                      py-3
                      text-base
                      font-medium
                      transition-all
                      duration-150

                      hover:bg-accent
                      hover:text-accent-foreground
                    `,
                    activeTab ===
                      'change-password'
                      ? `
                        bg-gradient-to-r
                        from-sky-500
                        to-blue-600
                        text-white
                        shadow-sm
                        shadow-blue-500/25

                        hover:from-sky-600
                        hover:to-blue-700
                        hover:text-white
                      `
                      : 'text-muted-foreground'
                  )}
                >

                  <Settings className="h-5 w-5 shrink-0" />

                  <span className="flex-1 text-left">
                    Account Settings
                  </span>

                  {activeTab ===
                    'change-password' && (
                    <ChevronRight className="h-5 w-5 shrink-0" />
                  )}

                </button>

              </nav>
            </ScrollArea>
            </div>

            {/* ------------------------------------------------------------ */}
            {/* SIDEBAR FOOTER                                               */}
            {/* ------------------------------------------------------------ */}

            <div className="border-t p-4">

              <div className="flex items-center gap-3">

                {/* Avatar */}

                <div
                  className="
                    flex
                    h-10 w-10
                    items-center
                    justify-center
                    rounded-full
                    bg-gradient-to-br
                    from-sky-500
                    to-blue-600
                    text-lg
                    font-medium
                    text-white
                  "
                >
                  {username
                    ? username
                        .charAt(0)
                        .toUpperCase()
                    : 'A'}
                </div>

                {/* User */}

                <div className="min-w-0 flex-1">

                  <p className="truncate text-base font-medium">
                    {username ||
                      'Admin User'}
                  </p>

                  <p className="truncate text-sm text-muted-foreground">
                    Administrator
                  </p>

                </div>

                {/* Logout */}

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  onClick={
                    handleLogout
                  }
                  title="Logout"
                >
                  <LogOut className="h-5 w-5" />
                </Button>

              </div>
            </div>

          </aside>

          {/* -------------------------------------------------------------- */}
          {/* MAIN                                                           */}
          {/* -------------------------------------------------------------- */}

          <main className="min-w-0 flex-1">

            {/* TOP BAR */}

            <header
              className="
                sticky
                top-0
                z-30
                border-b
                bg-background/95
                backdrop-blur

                supports-[backdrop-filter]:
                bg-background/60
              "
            >
              <div className="flex h-16 items-center gap-4 px-4 lg:px-6">

                {/* MOBILE MENU */}

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 lg:hidden"
                  onClick={() =>
                    setSidebarOpen(
                      true
                    )
                  }
                >
                  <Menu className="h-5 w-5" />
                </Button>

                {/* CURRENT PAGE */}

                {currentNavItem && (
                  <div className="flex items-center gap-2">

                    <currentNavItem.icon className="h-5 w-5 text-muted-foreground" />

                    <h2 className="text-lg font-semibold">
                      {
                        currentNavItem.label
                      }
                    </h2>

                  </div>
                )}

                {/* SETTINGS PAGE */}

                {activeTab ===
                  'change-password' && (
                  <div className="flex items-center gap-2">

                    <Settings className="h-5 w-5 text-muted-foreground" />

                    <h2 className="text-lg font-semibold">
                      Account Settings
                    </h2>

                  </div>
                )}

              </div>
            </header>

            {/* ------------------------------------------------------------ */}
            {/* PAGE CONTENT                                                 */}
            {/* ------------------------------------------------------------ */}

            <div className="p-6 lg:p-8">
              <Suspense fallback={<div className="flex items-center justify-center py-12"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>}>
                {renderTab()}
              </Suspense>
            </div>

          </main>
        </div>
      </TooltipProvider>
      </QueryClientProvider>
    </>
  )
}