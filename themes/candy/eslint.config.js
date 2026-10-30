// Candy's lint (`npm run lint`): the Marketplace review's JS rules over src/, the folder the package carries as
// source/, through @automatos/eslint-plugin. It fails on a warning too, so the theme ships with no finding the
// review would list.
import automatos from '@automatos/eslint-plugin'

export default [automatos.configs.recommended]
