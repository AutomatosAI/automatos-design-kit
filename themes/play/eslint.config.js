// Play's lint (`npm run lint`, in this folder): the Marketplace review's JS rules over src/, the folder Play's
// package carries as source/, through @automatos/eslint-plugin. Its lint script fails on a warning too, so
// Play ships with no finding the review would list.
import automatos from '@automatos/eslint-plugin'

export default [automatos.configs.recommended]
