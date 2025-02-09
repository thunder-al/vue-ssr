import './style.css'
import {createApp} from './index.ts'

const rootElement = document.getElementById('app')!
const shouldHydrate = rootElement.dataset.hydrate === 'true'

const {app} = createApp(!shouldHydrate)

app.mount('#app')
