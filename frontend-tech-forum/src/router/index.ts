import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '@/stores/userStore'
import PublicHomePage from '@/pages/PublicHomePage.vue'
import LoginPage from '@/pages/LoginPage.vue'
import PublicThreadSetPage from '@/pages/PublicThreadSetPage.vue'
import NotFoundPage from '@/pages/NotFoundPage.vue'
import AdminHomePage from '@/pages/admin/AdminHomePage.vue'
import UserPage from '@/pages/UserPage.vue'
import RegisterPage from '@/pages/RegisterPage.vue'
import FormEditThreadSetPage from '@/pages/admin/FormEditThreadSetPage.vue'
import FormCreateThreadSetPage from '@/pages/admin/FormCreateThreadSetPage.vue'
import AdminThreadSetPage from '@/pages/admin/AdminThreadSetPage.vue'
import FormEditThreadPage from '@/pages/admin/FormEditThreadPage.vue'
import FormCreateThreadPage from '@/pages/admin/FormCreateThreadPage.vue'
import PublicThreadPage from '@/pages/PublicThreadPage.vue'
import AdminThreadPage from '@/pages/admin/AdminThreadPage.vue'
import FormCreateResponsePage from '@/pages/FormCreateResponsePage.vue'
import AdminUsersPage from '@/pages/admin/AdminUsersPage.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: PublicHomePage
    },
    {
      path: '/login',
      name: 'login',
      component: LoginPage
    },
    {
      path: '/register',
      name: 'register',
      component: RegisterPage
    },
    {
      path: '/threadset/:id',
      name: 'threadset',
      component: PublicThreadSetPage
    },
    {
      path: '/admin/threadset/:id',
      name: 'admin-threadset',
      component: AdminThreadSetPage,
      meta: {
        requiresAdminAuth: true
      }
    },
    {
      path: '/admin',
      component: AdminHomePage,
      meta: {
        requiresAdminAuth: true
      }
    },
    {
      path: '/edit/threadset/:id',
      component: FormEditThreadSetPage,
      meta: {
        requiresAdminAuth: true
      }
    },
    {
      path: '/create/threadset/',
      component: FormCreateThreadSetPage,
      meta: {
        requiresAdminAuth: true
      }
    },
    {
      path: '/thread/:id',
      component: PublicThreadPage,
    },
    {
      path: '/admin/thread/:id',
      component: AdminThreadPage,
      meta: {
        requiresAuth: true
      }
    },
    {
      path: '/create/thread/',
      component: FormCreateThreadPage,
      meta: {
        requiresAuth: true
      }
    },
    {
      path: '/edit/thread/:id',
      component: FormEditThreadPage,
      meta: {
        requiresAdminAuth: true
      }
    },
    {
      path: '/admin/users',
      component: AdminUsersPage,
      meta: {
        requiresAdminAuth: true
      }
    },
    {
      path: '/create/thread/',
      component: FormCreateThreadPage,
      meta: {
        requiresAuth: true
      }
    },
    {
      path: '/create/response/:id',
      component: FormCreateResponsePage,
      meta: {
        requiresAuth: true
      }
    },
    {
      path: '/user/me',
      component: UserPage,
      meta: {
        requiresAuth: true
      }
    },
    { path: '/:pathMatch(.*)*', component: NotFoundPage }
  ]
})

export default router

router.beforeEach((to) => {
  const userStore = useUserStore()
  if (to.meta.requiresAuth && !userStore.isAuthenticated) {
    return '/login'
  }
  if (
    to.meta.requiresAdminAuth &&
    (!userStore.isAuthenticated || userStore.role.toLocaleLowerCase() !== 'admin')
  ) {
    return '/'
  }
})
