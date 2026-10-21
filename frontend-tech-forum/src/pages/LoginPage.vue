<script setup lang="ts">
import { PhUserCircle, PhEnvelope, PhKey } from '@phosphor-icons/vue';
import { ref } from 'vue';
import { useRouter } from 'vue-router'
import { api } from '@/api/'
import { useUserStore } from '@/stores/userStore'
import { isApplicationError } from '@/composables/useApplicationError';
import type { ApplicationError } from '@/types';
import { isAxiosError } from 'axios';

const email = ref('')
const password = ref('')
const loading = ref(false)
const exception = ref<ApplicationError>()
const router = useRouter()
const userStore = useUserStore()

async function haddleSubmit() {
  try {
    console.log("Email:", email.value)
    console.log("Password:", password.value)

    loading.value = true
    exception.value = undefined

    const { data } = await api.post('/auth/local', {
      identifier: email.value,
      password: password.value
    })

    const { jwt } = data

    const res = await api.get('/users/me', {
      headers: {
        Authorization: `Bearer ${jwt}`
      },
      params: {
        populate: 'role,image'
      }
    })

    const role = res.data.role.type
    const image = res.data.image?.url

    userStore.authenticaded(res.data, jwt, image)

    if (role == 'admin') {
      router.push('/admin')
    } else {
      router.push('/')
    }
  } catch (e) {
    if (isAxiosError(e) && isApplicationError(e.response?.data)) {
      exception.value = e.response?.data
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main :class="{ 'mt-5': !exception }">
    <div v-if="exception" class="alert alert-danger mt-3" role="alert">
      {{ exception.error.message }}
    </div>
    <div class="d-flex flex-column justify-content-center align-items-center">
      <div class="border rounded p-3 col-lg-3 bg-light shadow">
        <div class="row p-3 p-lg-0">
          <div class="col-sm-12">
            <div class="border-bottom border-dark p-3 mb-3 d-flex align-items-center justify-content-center">
              <PhUserCircle :size="32" class="me-2" />
              <div class="lexend-font">
                Login
              </div>
            </div>
          </div>
          <div class="col-12">
            <form class="w-100" action="/login" method="POST" @submit.prevent="haddleSubmit">
              <div class="form-group mb-3">
                <PhEnvelope :size="20" class="me-2" />
                <label for="email" class="pb-2">Email</label>
                <input type="email" name="email" v-model="email" class="form-control" id="email"
                  aria-describedby="emailHelp" placeholder="Enter email" required>
              </div>
              <div class="form-group">
                <PhKey :size="20" class="me-2" />
                <label for="password" class="pb-1">Password</label>
                <input type="password" name="password" v-model="password" class="form-control" id="password"
                  placeholder="Password" required>
              </div>
              <div class="text-center pt-4">
                <button type="submit" class="btn btn-dark pe-4 ps-4">Enter</button>
              </div>
            </form>
          </div>
        </div>
      </div>
      <button @click="router.push('/register')" class="btn btn-dark col-lg-3 h-100 mt-3">
        I don't have an account 😔
      </button>
    </div>
  </main>
</template>