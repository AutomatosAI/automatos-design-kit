// Delete on the LOOK page (lookEditor@1), on the harness's look runtime. A saved look is the user's own data and a
// delete can't be undone, so Delete asks first and deletes nothing yet: the question takes the focus on Keep it, the
// safe choice. Keep it keeps the look and hands the focus back to Delete. Delete look drops the look through the SDK,
// the host goes back to ARC, and the focus lands on Save as new look, which every look has, never on the page.
// Another look made the active one closes the question. Roles, attributes and text only.
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { ARC } from '../../src/lib/looks/presets.ts'
import { deleteQuestion, DELETE_LOOK_LABEL, KEEP_IT_LABEL } from '../../src/looks/delete-confirm.tsx'
import { DELETE_LABEL, SAVE_AS_LABEL } from '../../src/looks/look-drawer.tsx'
import { card, drawer, lookHeld, looksRow, myLook, renderEditor, savedLooks, startLooksTest, type User } from './looks-harness.tsx'

const MINE = myLook()
const OTHER = myLook({ id: 'mine-2', name: 'MINE 2' })

const actionButton = (name: string) => drawer().getByRole('button', { name })
const savedIds = () => savedLooks().map((look) => look.id)
const question = () => screen.getByRole('group', { name: deleteQuestion(MINE.name) })
const noQuestion = () => screen.queryByRole('group', { name: /^Delete .+\?/ })

async function onMyLook(): Promise<User> {
  const user = userEvent.setup()
  renderEditor({ look: MINE, saved: [MINE, OTHER] })
  await lookHeld(MINE)
  return user
}

beforeEach(() => {
  startLooksTest()
})

describe('Delete on a saved look', () => {
  it('asks first, deletes nothing yet, and puts the focus on Keep it', async () => {
    const user = await onMyLook()
    expect(actionButton(DELETE_LABEL)).toHaveAttribute('aria-expanded', 'false')
    await user.click(actionButton(DELETE_LABEL))
    expect(within(question()).getByRole('button', { name: KEEP_IT_LABEL })).toHaveFocus()
    expect(within(question()).getByRole('button', { name: DELETE_LOOK_LABEL })).toBeInTheDocument()
    expect(actionButton(DELETE_LABEL)).toHaveAttribute('aria-expanded', 'true')
    expect(savedIds()).toEqual([MINE.id, OTHER.id])
  })

  it('Keep it keeps the look and hands the focus back to Delete', async () => {
    const user = await onMyLook()
    await user.click(actionButton(DELETE_LABEL))
    await user.click(within(question()).getByRole('button', { name: KEEP_IT_LABEL }))
    expect(noQuestion()).toBeNull()
    expect(savedIds()).toEqual([MINE.id, OTHER.id])
    expect(actionButton(DELETE_LABEL)).toHaveFocus()
    expect(actionButton(DELETE_LABEL)).toHaveAttribute('aria-expanded', 'false')
  })

  it('Delete look drops it, the host goes back to ARC, and the focus lands on Save as new look', async () => {
    const user = await onMyLook()
    await user.click(actionButton(DELETE_LABEL))
    await user.click(within(question()).getByRole('button', { name: DELETE_LOOK_LABEL }))
    expect(savedIds()).toEqual([OTHER.id])
    await lookHeld(ARC)
    expect(looksRow().queryByRole('button', { name: MINE.name })).toBeNull()
    expect(drawer().queryByRole('button', { name: DELETE_LABEL })).toBeNull()
    expect(noQuestion()).toBeNull()
    expect(actionButton(SAVE_AS_LABEL)).toHaveFocus()
  })

  it('closes the question once another look is the active one', async () => {
    const user = await onMyLook()
    await user.click(actionButton(DELETE_LABEL))
    expect(question()).toBeInTheDocument()
    await user.click(card(OTHER.name))
    await lookHeld(OTHER)
    expect(noQuestion()).toBeNull()
    expect(actionButton(DELETE_LABEL)).toHaveAttribute('aria-expanded', 'false')
    expect(savedIds()).toEqual([MINE.id, OTHER.id])
  })
})
