<script setup lang="ts">
import { api } from '@/api';
import { isApplicationError } from '@/composables/useApplicationError';
import { useUserStore } from '@/stores/userStore';
import { PhPencil } from '@phosphor-icons/vue';
import { isAxiosError } from 'axios';
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import type { ApplicationError } from '@/types';


const route = useRoute()
const threadSetId = ref(route.params.id)
const name = ref('');
const oldName = ref('');
const description = ref('')
const odlDescription = ref('')
const userStore = useUserStore()
const loading = ref(false)
const exception = ref<ApplicationError>()

const inputEnter = computed<boolean>(() => (name.value !== oldName.value) || (description.value !== odlDescription.value))

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

    const { data: threadSetData } = (await api.get(`/thread-sets/${threadSetId.value}`, {
      headers: {
        Authorization: `Bearer ${userStore.jwt}`
      }
    })).data

    loading.value = false

    name.value = threadSetData.name
    oldName.value = threadSetData.name
    description.value = threadSetData.description
    odlDescription.value = threadSetData.description
  }catch(e) {
      handleError(e)
  } finally {
    loading.value = false
  }
})

async function handleUpdate(e: Event) {
  e.preventDefault()

  try {
    exception.value = undefined;
    if (!inputEnter.value) {
      return
    }
    const formData = new FormData();
    formData.append("data", JSON.stringify({
      "name": name.value.trim(),
      "description": description.value.trim()
    }))

    loading.value = true

    const { data: threadSetData } = (await api.put(`/thread-sets/${threadSetId.value}`, formData, {
      headers: {
        Authorization: `Bearer ${userStore.jwt}`
      }
    })).data

    name.value = threadSetData.name
    oldName.value = threadSetData.name
    description.value = threadSetData.description
    odlDescription.value = threadSetData.description
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
  <main class="row justify-content-center">
    <div v-if="exception" class="alert alert-danger mt-3" role="alert">
      {{ exception.error.message }}
    </div>
    <div v-if="loading" class="vh-80 d-flex justify-content-center align-items-center">
      <div class="spinner-border text-dark" role="status">
        <span class="sr-only"></span>
      </div>
    </div>
    <form v-else @submit="handleUpdate" class="p-0 mt-3 col-12 col-lg-6 bg-light-subtle shadow top-rouded">
      <div class="bg-dark text-light p-3 text-center top-rouded">
        <h4 class="m-0 p-0">
          <div class="d-flex align-items-center justify-content-center">
            Edit - Thread Set
            <PhPencil class="ms-2" />
          </div>
        </h4>
      </div>
      <div class="p-3">
        <div class="form-group mt-3">
          <label for="name">Name</label>
          <input v-model="name" type="text" id="name" class="form-control">
        </div>
        <div class="form-group mt-3">
          <label for="description">Description</label>
          <textarea v-model="description" class="form-control" id="description" rows="3"></textarea>
        </div>
        <div class="text-center mt-3">
          <button :disabled="!inputEnter" class="btn btn-primary">
            Update
          </button>
        </div>
      </div>
    </form>
  </main>
</template>

<style scoped>
button {
  transition: opacity 0.5s;
}
</style>