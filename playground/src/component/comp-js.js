import { defineComponent, h } from 'vue';

export default defineComponent({
  name: 'CompJs',
  props: {
    msg: {
      type: String,
      default: 'Hello World',
    },
  },
  setup(props) {
    return () => {
      return h('div', { class: 'comp-js' },  [
        h('div', 'Fast to js - h 2 parameter'),
        h('div', { color: 'red' }, 'Fast to js - h 3 parameter' ),
        h('div', { class: 'blue' }, [
            h('div', 'Fast to js - children1'),
            h('div', 'Fast to js - children2'),
        ]),
      ])
    }
  }
})
