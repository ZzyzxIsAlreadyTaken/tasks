import { createFileRoute, redirect } from '@tanstack/react-router'
import { getTodayIsoDate } from '~/lib/dates'

export const Route = createFileRoute('/')({
  beforeLoad: () => {
    throw redirect({
      to: '/day/$date',
      params: {
        date: getTodayIsoDate(),
      },
    })
  },
})
