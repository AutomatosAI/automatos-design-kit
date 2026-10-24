// HUD's lint (`npm run lint`, in this folder): the Marketplace review's JS rules over src/, the folder HUD's
// package carries as source/, through @automatos/eslint-plugin. It fails on a warning too, so HUD ships with no
// finding the review would list.
import automatos from '@automatos/eslint-plugin'

export default [automatos.configs.recommended]
