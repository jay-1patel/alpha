'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'

import { cn } from '@/lib/utils'

import {
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
  AlertCircle,
  ShoppingCart,
  LayoutList,
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

import FilesTab from '@/components/files/files-tab'
import ChatTab from '@/components/chat/chat-tab'
import ChatHistoryTab from '@/components/chat-history/chat-history-tab'
import ProductsTab from '@/components/products/products-tab'
import ChangePasswordPage from '@/components/auth/change-password'
import ManageAdminsPage from '@/components/admins/manage-admins'
import InboxTab from '@/components/inbox/inbox-tab'
import CampaignsTab from '@/components/campaigns/campaigns-tab'
import DistributorsTab from '@/components/distributors/distributors-tab'
import ComplaintsTab from '@/components/complaints/complaints-tab'
import AnalyticsTab from '@/components/analytics/analytics-tab'
import OrdersTab from '@/components/orders/orders-tab'
import CustomersTab from '@/components/customers/customers-tab'
import MenusTab from '@/components/menus/menus-tab'

import LoginPage from '@/components/auth/login'
import ForgotPasswordPage from '@/components/auth/forgot-password'

/* -------------------------------------------------------------------------- */
/* TYPES                                                                      */
/* -------------------------------------------------------------------------- */

type TabType =
  | 'files'
  | 'chat'
  | 'chat-history'
  | 'products'
  | 'inbox'
  | 'campaigns'
  | 'distributors'
  | 'complaints'
  | 'analytics'
  | 'orders'
  | 'customers'
  | 'menus'
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
  chat?: boolean
  chat_history?: boolean
  catalogue_new_arrival?: boolean
  view_orders?: boolean
  manage_orders?: boolean
  view_complaints?: boolean
  manage_complaints?: boolean
  view_customers?: boolean
  view_analytics?: boolean
  view_inbox?: boolean
  view_campaigns?: boolean
  view_distributors?: boolean
}

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
    id: 'analytics',
    label: 'Overview & Analytics',
    icon: BarChart3,
    permission: 'view_analytics',
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
    permission: 'view_inbox',
  },
  {
    id: 'campaigns',
    label: 'Campaigns',
    icon: Megaphone,
    permission: 'view_campaigns',
  },
  {
    id: 'distributors',
    label: 'Distributors',
    icon: Building2,
    permission: 'view_distributors',
  },
  {
    id: 'orders',
    label: 'Orders',
    icon: ShoppingCart,
    permission: 'view_orders',
  },
  {
    id: 'complaints',
    label: 'Complaints',
    icon: AlertCircle,
    permission: 'view_complaints',
  },
  {
    id: 'customers',
    label: 'Customers',
    icon: Users,
    permission: 'view_customers',
  },
  {
    id: 'menus',
    label: 'Menu Editor',
    icon: LayoutList,
    permission: 'edit_delete_products',
  },
  {
    id: 'manage-admins',
    label: 'Manage Admins',
    icon: Users,
    permission: 'manage_admins',
  },
]

const TAB_IDS: TabType[] = [
  'analytics',
  'products',
  'files',
  'chat',
  'chat-history',
  'inbox',
  'campaigns',
  'distributors',
  'orders',
  'complaints',
  'customers',
  'menus',
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
      return permissions.view_inbox === true

    case 'campaigns':
      return permissions.view_campaigns === true

    case 'distributors':
      return permissions.view_distributors === true

    case 'orders':
      return permissions.view_orders === true

    case 'complaints':
      return permissions.view_complaints === true

    case 'customers':
      return permissions.view_customers === true

    case 'menus':
      return permissions.edit_delete_products === true

    case 'analytics':
      return permissions.view_analytics === true

    case 'manage-admins':
      return permissions.manage_admins === true

    default:
      return false
  }
}

/**
 * Pick the first tab the current admin is allowed to see.
 * Used as a safe fallback for invalid/unauthorized routes.
 */
function firstAccessibleTab(
  permissions: PermissionMap
): TabType {
  const fallback = navItems.find((item) =>
    canAccessTab(item.id, permissions)
  )
  return fallback?.id ?? 'change-password'
}

/**
 * Resolve a URL to an accessible tab.
 *
 * Valid + permitted route:
 * /chat-history -> chat-history
 *
 * Invalid or unauthorized route:
 * /something -> first accessible tab
 */
function resolvePathToTab(
  path: string,
  permissions: PermissionMap
): TabType {
  if (!isTabRoute(path)) {
    return firstAccessibleTab(permissions)
  }

  if (!canAccessTab(path, permissions)) {
    return firstAccessibleTab(permissions)
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
    useState<TabType>('analytics')

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
       * into /analytics before permissions have loaded.
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
    setActiveTab('analytics')

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
      <div className="flex min-h-screen items-center justify-center bg-primary-50">
        <div className="flex items-center gap-3 text-primary-600">

          <div
            className="
              h-5 w-5
              animate-spin
              rounded-full
              border-2
              border-primary-500
              border-t-transparent
            "
          />

          <span className="text-base font-medium">
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
    if (
      authView === 'forgot-password'
    ) {
      return <ForgotPasswordPage />
    }

    return <LoginPage />
  }

  /* ---------------------------------------------------------------------- */
  /* TAB CONTENT                                                            */
  /* ---------------------------------------------------------------------- */

  const renderTab = () => {
    switch (activeTab) {
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

      case 'orders':
        return <OrdersTab />

      case 'complaints':
        return <ComplaintsTab />

      case 'customers':
        return <CustomersTab />

      case 'menus':
        return <MenusTab />

      case 'analytics':
        return <AnalyticsTab />

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
        return <AnalyticsTab />
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
        className="leeway-toast"
      />

      {/* react-hot-toast — used by Inbox & Campaigns modules */}
      <HotToaster
        position="bottom-right"
        toastOptions={{
          style: {
            borderRadius: '10px',
            background: '#FFFFFF',
            color: '#000000', 
            boxShadow: '0 16px 24px 15px rgba(19, 76, 188, 0.1)', 
            fontFamily: 'Poppins, sans-serif',
          },
          success: {
            style: {
              border: '2px solid #139C32',
              background: 'rgba(19, 156, 50, 0.1)',
              color: '#139C32',
            },
          },
          error: {
            style: {
              border: '2px solid #E31E25',
              background: 'rgba(227, 30, 37, 0.1)',
              color: '#E31E25',
            },
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

            <div className="relative flex flex-col items-center gap-2 border-b p-6 bg-primary-50">

              <Button
                variant="ghost"
                size="icon"
                className="
                  absolute
                  right-4
                  top-4
                  h-8 w-8
                  lg:hidden
                  text-primary-500 hover:bg-primary-100
                "
                onClick={() =>
                  setSidebarOpen(false)
                }
              >
                <X className="h-4 w-4" />
              </Button>

              <img
                src="/leeway_logo.png"
                alt="Leeway Softech"
                className="
                  h-28 w-28
                  rounded-full
                  object-contain
                  border-2 border-primary-500
                  bg-white
                  p-1
                  shadow-lg shadow-primary-500/25
                "
              />

              <div className="text-center">

                <h1 className="text-xl font-bold text-primary-500">
                  Leeway Softech
                </h1>

                <p className="text-sm text-gray-600">
                  WhatsApp Chatbot Admin
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

                            `,
                          isActive
                            ? `
                              bg-primary-500
                              text-white
                              shadow-sm

                              hover:bg-primary-600
                            `
                            : 'text-gray-600'
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

                      `,
                    activeTab ===
                      'change-password'
                      ? `
                        bg-primary-500 text-white shadow-sm

                        hover:bg-primary-600
                      `
                      : 'text-gray-600'
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

            <div className="border-t p-4 bg-primary-50">

              <div className="flex items-center gap-3">

                {/* Avatar */}

                <div
                  className="
                    flex
                    h-10 w-10
                    items-center
                    justify-center
                    rounded-full
                    bg-primary-500
                    text-lg
                    font-bold text-white
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

                  <p className="truncate text-sm text-gray-600">
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
                bg-white/95
                backdrop-blur
                leeway-header
                supports-[backdrop-filter]:
                bg-white/60
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

                    <currentNavItem.icon className="h-5 w-5 text-primary-500" />

                    <h2 className="text-xl font-bold text-primary-500">
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

                    <Settings className="h-5 w-5 text-primary-500" />

                    <h2 className="text-xl font-bold text-primary-500">
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
              {renderTab()}
            </div>

          </main>
        </div>
      </TooltipProvider>
      </QueryClientProvider>
    </>
  )
}