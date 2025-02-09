<template>
  <StatefulComponent v-for="i in count" :key="i"/>
  <button @click="increment">Increment</button>
</template>

<script setup lang="ts">
  import StatefulComponent from './components/StatefulComponent.vue'
  import {ref} from 'vue'

  const count = ref(5)

  function increment() {
    count.value++
  }
</script>
