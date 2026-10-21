import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type { User } from '@/types'

export const useUserStore = defineStore('user', () => {

  const user = ref<User>({
    id: Number(localStorage.getItem('id')),
    username:  localStorage.getItem('username') || "",
    email: localStorage.getItem('email') || "",
    role: {
      name: localStorage.getItem('role') || ""
    },
    image: {
      url: localStorage.getItem('image') || ""
    }
  })

  const jwt = ref(localStorage.getItem("jwt") || "")

  const role = computed(() => user.value?.role?.name)
  const username = computed(() => user.value.username)
  const id = computed(() => user.value.id)
  const email = computed(() => user.value.email)
  const image = computed(() => user.value?.image?.url)
  const isAuthenticated = computed(() => jwt.value !== "")

  function authenticaded(authUser: User, token: string, image?: string) {
    user.value = authUser
    jwt.value = token

    localStorage.setItem('username', authUser.username)
    localStorage.setItem('id', authUser.id.toString())
    localStorage.setItem('email', authUser.email)
    localStorage.setItem('role', authUser.role.name)
    localStorage.setItem('jwt', token)
    if(image){
      localStorage.setItem('image', image)
    } else {
      user.value.image = { url: "" }
    }
  }

  function changeImage(url : string) {
    user.value.image.url = url
    localStorage.setItem('image', url)
  }
  
  function changeUsername(username : string) {
    user.value.username = username
    localStorage.setItem('username', username)
  }

  function logout() {
    jwt.value = ""
    user.value = {} as User

    localStorage.clear()
  }


  return { 
    user, 
    username, 
    id, 
    email, 
    image, 
    jwt, 
    role, 
    isAuthenticated,  
    changeImage, 
    changeUsername,
    authenticaded, 
    logout
  }
})