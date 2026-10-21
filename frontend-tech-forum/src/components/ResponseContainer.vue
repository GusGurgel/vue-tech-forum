<script setup lang="ts">
import type { ApplicationError, Thread, Response } from "@/types/index.js"

import BootstrapModal from '@/components/BootstrapModal.vue';
import ResponseEntry from "./ResponseEntry.vue";
import { PhWarningOctagon, PhPlus } from '@phosphor-icons/vue';

import { useRouter, useRoute } from 'vue-router';
import { api } from '@/api';
import { onMounted, ref } from 'vue';
import { isAxiosError } from 'axios';
import { isApplicationError } from '@/composables/useApplicationError';
import { useUserStore } from '@/stores/userStore';

defineProps<{ editButtons: boolean }>();

const thread = ref<Pick<Thread, "title">>({} as Thread)
const responses = ref<Response[]>([] as Response[])

const bodyTextRemoveModal = ref<string>('')
const toRemoveResponseAuthor = ref<string>('')
const toRemoveIdResponse = ref<number>()

const exception = ref<ApplicationError>()
const loading = ref(true)
const router = useRouter()
const route = useRoute()

const idThread = route.params.id

const userStore = useUserStore()

function handleError(e: any) {
  if (isAxiosError(e) && isApplicationError(e.response?.data)) {
    exception.value = e.response?.data
  }
}

async function removeThread() {
  await api.delete(`/responses/${toRemoveIdResponse.value}`, {
    headers: {
      Authorization: `Bearer ${userStore.jwt}`
    }
  })
  responses.value = responses.value.filter(val => val.id !== toRemoveIdResponse.value)
}

async function handleRemove(idReponse: number, authorReponse: string) {
  try {
    exception.value = undefined
    loading.value = true
    toRemoveIdResponse.value = idReponse
    toRemoveResponseAuthor.value = authorReponse

    bodyTextRemoveModal.value = `Confirm response of "${toRemoveResponseAuthor.value}" deletion`;
  } catch (e) {
    handleError(e)
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  try {
    loading.value = true
    const { data: threadData } = (await api.get(`/threads/${idThread}`)).data
    const { data: responsesData } = (await api.get(`/responses/`, {
      params: {
        "filters[thread][id][$eq]": idThread,
        "populate": "author.image",
        "sort": ["createdAt:asc"]
      }
    })).data

    thread.value = {
      title: threadData.title
    }

    for (const responseData of responsesData) {
      responses.value.push({
        ...responseData,
        createdAt: new Date(responseData.createdAt),
        author: {
          username: responseData.author?.username,
          image: responseData.author?.image?.url
        }
      })
    }

    console.log(responses.value)
  } catch (e) {
    handleError(e)
  } finally {
    loading.value = false
  }
})

</script>

<template>
  <BootstrapModal :idModal="'remove-modal'" :labelModal="'modal'">
    <template v-slot:header>
      <h1 class="modal-title fs-5">Remove <strong>Thread</strong>
        <PhTrash class="ms-2" />
      </h1>
      <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
    </template>
    <template v-slot:body>
      {{ bodyTextRemoveModal }}
    </template>
    <template v-slot:footer>
      <button type="button" class="btn btn-danger" data-bs-dismiss="modal">Cancel</button>
      <button type="button" class="btn btn-primary" data-bs-dismiss="modal" @click="removeThread">Confirm</button>
    </template>
  </BootstrapModal>

  <div v-if="exception" class="alert alert-danger mt-2 d-flex align-items-center" role="alert">
    <PhWarningOctagon :size="32" />
    <div class="ms-3">
      Error trying to fetch <strong>Reponses</strong>: {{ exception.error.message }}
    </div>
  </div>
  <div v-if="loading" class="vh-80 d-flex justify-content-center align-items-center">
    <div class="spinner-border text-dark" role="status">
      <span class="sr-only"></span>
    </div>
  </div>
  <main v-else class="bg-light-subtle shadow row m-0 mt-3">
    <div
      class="text-center overflow-hidden col-10 p-2 bg-dark d-flex align-items-center justify-content-center text-light shadow"
      :class="{'col-12': !userStore.isAuthenticated}">
      <div>
        {{ thread.title }}
      </div>
    </div>
    <button v-if="userStore.isAuthenticated" @click="router.push(`/create/response/${idThread}`)"
      class="btn btn-dark rounded-0 text-center col-2 col-lg-2 shadow">
      <span class="d-none d-lg-inline me-2">New Response</span>
      <PhPlus :size="20" />
    </button>
    <ResponseEntry v-for="response in responses" :key="response.id" :response="{ ...response }"
      :editButtons="editButtons" @handleRemove="handleRemove"/>
  </main>
</template>