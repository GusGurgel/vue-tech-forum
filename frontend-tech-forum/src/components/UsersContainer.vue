<script setup lang="ts">
import type { ApplicationError, User } from "@/types/index.js"

import UsersEntry from "./UsersEntry.vue";
import { PhWarningOctagon } from '@phosphor-icons/vue';

import { api } from '@/api';
import { onMounted, ref } from 'vue';
import { isAxiosError } from 'axios';
import { isApplicationError } from '@/composables/useApplicationError';
import { useUserStore } from "@/stores/userStore";

const userStore = useUserStore()

const users = ref<User[]>([] as User[])

const exception = ref<ApplicationError>()
const loading = ref(true)

function handleError(e: any) {
  if (isAxiosError(e) && isApplicationError(e.response?.data)) {
    exception.value = e.response?.data
  } else {
    console.log(e)
  }
}

onMounted(async () => {
  try {
    loading.value = true
    const { data: usersData } = await api.get(`/users/`, {
      params: {
        "populate": "role,image",
      },
      headers: {
        Authorization: `Bearer ${userStore.jwt}`
      }
    })

    for (const userData of usersData) {
      users.value.push({
        ...userData,
        createdAt: new Date(userData.createdAt),
        image: {
          url: userData?.image?.url
        }
      })
    }
  } catch (e) {
    handleError(e)
  } finally {
    loading.value = false
  }
})

async function handleBanChange(userId: number, event: any) {
  const user = users.value.find(val => val.id === userId)

  try {
    const formData = new FormData();
    formData.append("blocked", event.target.checked)

    loading.value = true

    const { data: userData } = (await api.put(`/users/${userId}`, formData, {
      headers: {
        Authorization: `Bearer ${userStore.jwt}`
      }
    })).data

    const user = users.value.find(val => val.id === userId)

    if(user) {
      user.blocked = event.target.checked
    }
  } catch(error : any){
    handleError(error)
  } finally {
    loading.value = false
  }
}

</script>

<template>
  <div v-if="exception" class="alert alert-danger mt-2 d-flex align-items-center" role="alert">
    <PhWarningOctagon :size="32" />
    <div class="ms-3">
      Error trying to fetch <strong>Users</strong>: {{ exception.error.message }}
    </div>
  </div>
  <div v-if="loading" class="vh-80 d-flex justify-content-center align-items-center">
    <div class="spinner-border text-dark" role="status">
      <span class="sr-only"></span>
    </div>
  </div>
  <main v-else class="row justify-content-center m-0 mt-3">
    <div class="col-10">
      <div class="row bg-light-subtle">
        <div class="d-none d-lg-block col-2 shadow bg-dark text-light p-0 py-2 text-center">
          Image
        </div>
        <div class="col-8 col-lg-4 shadow bg-dark text-light p-0 py-2 text-center">
          Identification
        </div>
        <div class="shadow d-none d-lg-block col-3 bg-dark text-light p-0 py-2 text-center">
          Register Data
        </div>
        <div class="shadow d-lg-block col-4 col-lg-3 bg-dark text-light p-0 py-2 text-center">
          Banned
        </div>
        <UsersEntry v-for="user in users" :key="user.id" :user="{ ...user }" @handleBanChange="handleBanChange" />
      </div>
    </div>
  </main>
</template>