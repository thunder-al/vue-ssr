<template>
  <h1>{{ data }}</h1>
</template>

<script setup lang="ts">
  import {useApi} from '../services/api.ts'

  const {data} = useApi({url: 'hello'}) // GET /api/hello

</script>
