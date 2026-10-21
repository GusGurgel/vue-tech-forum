<script setup>
import { RouterView } from 'vue-router'
import NavBar from '@/components/NavBar.vue';
</script>

<template>
  <NavBar />
  <div class="container-lg container-fluid p-4 p-lg-0">
    <RouterView />
  </div>
</template>