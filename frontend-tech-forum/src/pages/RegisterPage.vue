<script setup lang="ts">
import { PhUserCirclePlus, PhEnvelope, PhKey, PhIdentificationCard } from '@phosphor-icons/vue';
import { ref } from 'vue';
import { useRouter } from 'vue-router'
import { api } from '@/api/'
import { isApplicationError } from '@/composables/useApplicationError';
import type { ApplicationError } from '@/types';
import { isAxiosError } from 'axios';

const email = ref('')
const password = ref('')
const username = ref('')
const loading = ref(false)
const exception = ref<ApplicationError>()
const router = useRouter()

async function haddleSubmit() {
  try {
    loading.value = true
    exception.value = undefined

    await api.post('/auth/local/register', {
      username: username.value,
      email: email.value,
      password: password.value
    })

    router.push('/login')
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
  <main :class="{ 'mt-4': !exception }">
    <div v-if="exception" class="alert alert-danger mt-3" role="alert">
      {{ exception.error.message }}
    </div>
    <div class="d-flex flex-column justify-content-center align-items-center">
      <div class="border rounded p-3 col-lg-4 bg-light shadow">
        <div class="row p-3 p-lg-0">
          <div class="col-sm-12">
            <div class="border-bottom border-dark p-3 mb-3 d-flex align-items-center justify-content-center">
              <PhUserCirclePlus :size="32" class="me-2" />
              <div class="lexend-font">
                Register
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
              <div class="form-group mb-3">
                <PhIdentificationCard :size="20" class="me-2" />
                <label for="username" class="pb-2">Username</label>
                <input type="text" name="username" v-model="username" class="form-control" id="email"
                  aria-describedby="emailHelp" placeholder="Enter email" required>
              </div>
              <div class="form-group mb-3">
                <PhKey :size="20" class="me-2" />
                <label for="password" class="pb-1">Password</label>
                <input type="password" name="password" v-model="password" class="form-control" id="password"
                  placeholder="Password" required>
              </div>
              <div class="text-center pt-2">
                <button type="submit" class="btn btn-dark pe-4 ps-4">Register</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>