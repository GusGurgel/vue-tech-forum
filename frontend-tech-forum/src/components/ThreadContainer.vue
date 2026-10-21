<script setup lang="ts">
import type { ThreadSet, ApplicationError, Thread, Response } from "@/types/index.js"

import BootstrapModal from '@/components/BootstrapModal.vue';
import ThreadEntry from './ThreadEntry.vue'
import { PhWarningOctagon, PhPlus, PhTrash } from '@phosphor-icons/vue';

import { useRouter, useRoute } from 'vue-router';
import { api } from '@/api';
import { onMounted, ref } from 'vue';
import { isAxiosError } from 'axios';
import { isApplicationError } from '@/composables/useApplicationError';
import { useUserStore } from '@/stores/userStore';

defineProps<{ editButtons: boolean }>();

const threads = ref<Thread[]>([] as Thread[])
const threadSet = ref<Pick<ThreadSet, "name">>()

const bodyTextRemoveModal = ref<string>('')
const bodyComplementeTextRemoveModal = ref<string>('')
const toRemoveTitleThread = ref<string>('')
const toRemoveIdThread = ref<number>()

const exception = ref<ApplicationError>()
const loading = ref(true)
const router = useRouter()
const route = useRoute()

const idThreadSet = route.params.id

const userStore = useUserStore()

function handleError(e: any) {
  if (isAxiosError(e) && isApplicationError(e.response?.data)) {
    exception.value = e.response?.data
  }
}

async function removeThread() {
  const { data: childsThread } = (await api.get('/responses', {
    params: {
      "filters[thread][id][$eq]": toRemoveIdThread.value
    }
  })).data

  for (const reponse of childsThread) {
    await api.delete(`/responses/${reponse.id}`, {
      headers: {
        Authorization: `Bearer ${userStore.jwt}`
      }
    })
  }

  await api.delete(`/threads/${toRemoveIdThread.value}`, {
    headers: {
      Authorization: `Bearer ${userStore.jwt}`
    }
  })
  threads.value = threads.value.filter(val => val.id !== toRemoveIdThread.value)
}

async function handleRemove(idThread: number, titleThread: string) {
  try {
    exception.value = undefined
    loading.value = true
    toRemoveTitleThread.value = titleThread
    toRemoveIdThread.value = idThread

    const { data: childsThreads } = (await api.get('/responses', {
      params: {
        "filters[thread][id][$eq]": idThread
      }
    })).data

    let messageComplemente = ""

    if (childsThreads.length > 0) {
      messageComplemente = `\n\nThis Thread has ${childsThreads.length} Response that will be removed with this action.`
    }

    bodyTextRemoveModal.value = `Confirm Thread "${toRemoveTitleThread.value}" deletion`;
    bodyComplementeTextRemoveModal.value = messageComplemente;
  } catch (e) {
    handleError(e)
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  try {
    loading.value = true
    const { data: threadSetData } = (await api.get(`/thread-sets/${idThreadSet}`)).data
    const { data: threadsData } = (await api.get(`/threads/`, {
      params: {
        "filters[thread_set][id][$eq]": idThreadSet,
        "populate": "author",
        "sort": ["isFixed:desc", "createdAt:desc"]
      }
    })).data

    threadSet.value = {
      name: threadSetData.name
    }

    for (const threadData of threadsData) {
      // Pegar dados das reponses contidas na thread
      const { data: reponsesData } = (await api.get('/responses', {
        params: {
          "filters[thread][id][$eq]": threadData.id,
        }
      })).data

      // Pegar dados da última thread do threadset
      const { data: lastResponseData } = (await api.get('/responses', {
        params: {
          "filters[thread][id][$eq]": threadData.id,
          "populate": "author",
          "sort": "createdAt:desc",
          "pagination[limit]": 1
        }
      })).data

      let lastResponse: Response | null = null

      if (lastResponseData.length > 0) {
        lastResponseData[0].createdAt = new Date(lastResponseData[0].createdAt)
        lastResponse = lastResponseData[0]
      }

      threads.value.push({
        id: threadData.id,
        title: threadData.title,
        createdAt: new Date(threadData.createdAt),
        isFixed: threadData.isFixed,
        reponsesCount: reponsesData.length,
        lastResponse,
        author: {
          username: threadData.author.username
        }
      })
    }
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
        <PhTrash class="ms-2"/>
      </h1>
      <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
    </template>
    <template v-slot:body>
      <div class="text-break">
        {{ bodyTextRemoveModal }}
        <div class="fw-bold mt-3 text-break">
          {{ bodyComplementeTextRemoveModal }}
        </div>
      </div>
    </template>
    <template v-slot:footer>
      <button type="button" class="btn btn-danger" data-bs-dismiss="modal">Cancel</button>
      <button type="button" class="btn btn-primary" data-bs-dismiss="modal" @click="removeThread">Confirm</button>
    </template>
  </BootstrapModal>

  <div v-if="exception" class="alert alert-danger mt-2 d-flex align-items-center" role="alert">
    <PhWarningOctagon :size="32" />
    <div class="ms-3">
      Error trying to fetch <strong>Threads</strong>: {{ exception.error.message }}
    </div>
  </div>
  <div v-if="loading" class="vh-80 d-flex justify-content-center align-items-center">
    <div class="spinner-border text-dark" role="status">
      <span class="sr-only"></span>
    </div>
  </div>
  <main v-else class="bg-light-subtle shadow row m-0 mt-3">
    <div class="text-center p-2 bg-dark text-light shadow mb-3" :class="userStore.isAuthenticated ? 'col-10 col-lg-11' : 'col-12'
      ">
      {{ threadSet?.name }}
    </div>
    <button v-if="userStore.isAuthenticated" @click="router.push(`/create/thread?threadSet=${idThreadSet}`)"
      class="btn btn-dark mb-3 rounded-0 text-center col-2 col-lg-1 shadow">
      <PhPlus :size="20" />
    </button>
    <div class="shadow bg-dark text-light p-0 py-2 text-center" :class="editButtons ? 'col-12 col-lg-5' : 'col-12 col-lg-5'
      ">
      Title
    </div>
    <div class="shadow d-none d-lg-block col-2 bg-dark text-light p-0 py-2 text-center">
      Thread Responses
    </div>
    <div class="shadow d-none d-lg-block bg-dark text-light p-0 py-2 text-center col-lg-5">
      Last Response
    </div>
    <ThreadEntry v-for="thread in threads" :key="thread.id" :thread="{ ...thread }" :editButtons="editButtons" @handleRemove="handleRemove"/>
  </main>
</template>